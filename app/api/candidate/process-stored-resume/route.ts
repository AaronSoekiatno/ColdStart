import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, getCandidate, saveCandidate, upsertCandidate, saveMatches, findStartupIdsByNames, saveStartup, createResume, getResumeCountForCandidate } from '@/lib/supabase';
import { parseResumeToStructured } from '@/lib/parse-resume';
import { convertResumeToLaTeX } from '@/lib/pdf-to-latex';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { resumeData } = await request.json();

    if (!resumeData || !resumeData.extraction) {
      return NextResponse.json(
        { error: 'Invalid resume data' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const extraction = resumeData.extraction;
    const embedding = resumeData.embedding;
    const rawText = resumeData.rawText || '';
    const fileName = resumeData.fileName || 'resume.pdf';
    const fileBase64 = resumeData.fileBase64;

    // Get candidate (should exist from onboarding)
    let candidate = await getCandidate(user.email);
    
    if (!candidate) {
      // Create candidate with resume data (shouldn't happen if onboarding completed, but handle it)
      candidate = await saveCandidate({
        email: user.email,
        name: extraction.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        summary: extraction.summary || '',
        skills: extraction.skills?.join(', ') || '',
        location: extraction.location || '',
        education_level: extraction.education_level || '',
        university: extraction.university || '',
        past_internships: extraction.past_internships?.join(', ') || '',
        technical_projects: extraction.technical_projects?.join(', ') || '',
      });
    } else {
      // Update candidate with resume data (prioritize resume data, but keep job_type and role_type from onboarding)
      await saveCandidate({
        email: user.email,
        name: extraction.name || candidate.name,
        summary: extraction.summary || candidate.summary || '',
        skills: extraction.skills?.join(', ') || candidate.skills || '',
        location: extraction.location || candidate.location || '',
        education_level: extraction.education_level || candidate.education_level || '',
        university: extraction.university || candidate.university || '',
        past_internships: extraction.past_internships?.join(', ') || candidate.past_internships || '',
        technical_projects: extraction.technical_projects?.join(', ') || candidate.technical_projects || '',
        job_type: candidate.job_type, // Preserve from onboarding
        role_type: candidate.role_type, // Preserve from onboarding
      });
    }

    // Upload resume file to Supabase Storage if we have the base64 data
    let resumePath: string | undefined;
    if (fileBase64 && supabaseAdmin) {
      try {
        const userId = user.id;
        const folderPath = `resumes/${userId}`;
        const timestamp = Date.now();
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
        const safeExt = ext || 'pdf';
        const uniqueFileName = `${timestamp}-${sanitizedName}`;
        const objectPath = `${folderPath}/${uniqueFileName}`;

        // Convert base64 to buffer
        const base64Data = fileBase64.split(',')[1] || fileBase64;
        const buffer = Buffer.from(base64Data, 'base64');

        const { error: uploadError } = await supabaseAdmin.storage
          .from('resumes')
          .upload(objectPath, buffer, {
            contentType: resumeData.fileType || 'application/pdf',
            upsert: false,
          });

        if (!uploadError) {
          resumePath = objectPath;
          console.log('Uploaded stored resume file to Storage at path:', objectPath);
        } else {
          console.error('Failed to upload stored resume file:', uploadError);
        }
      } catch (error) {
        console.error('Error uploading stored resume file:', error);
      }
    }

    // Generate LaTeX and structured data from raw text
    let latexCode = '';
    let structuredResumeData: any = null;
    
    if (rawText && rawText.trim().length > 0) {
      try {
        latexCode = convertResumeToLaTeX(rawText);
        structuredResumeData = await parseResumeToStructured(rawText);
      } catch (error) {
        console.error('Error generating LaTeX/structured data:', error);
      }
    }

    // Save resume to resumes table
    if (candidate.id) {
      const resumeCount = await getResumeCountForCandidate(candidate.id);
      const shouldSetAsPrimary = resumeCount === 0;

      await createResume({
        candidate_id: candidate.id,
        name: `${extraction.name || 'User'} Resume`,
        file_name: fileName,
        resume_path: resumePath,
        resume_full_text: rawText,
        is_active: true,
        is_primary: shouldSetAsPrimary,
      });
    }

    // Upsert to Pinecone with embedding
    if (embedding && Array.isArray(embedding)) {
      try {
        await upsertCandidate(
          user.email,
          embedding,
          {
            name: extraction.name || candidate.name,
            email: user.email,
            summary: extraction.summary || '',
            skills: extraction.skills?.join(', ') || '',
            location: extraction.location || '',
            education_level: extraction.education_level || '',
            university: extraction.university || '',
            past_internships: extraction.past_internships?.join(', ') || '',
            technical_projects: extraction.technical_projects?.join(', ') || '',
          }
        );
      } catch (error) {
        console.error('Failed to save candidate to Pinecone:', error);
      }
    }

    // Save matches if available
    if (resumeData.matches && Array.isArray(resumeData.matches) && candidate.id) {
      try {
        const startupNames = resumeData.matches.map((m: any) => m.startup?.name || 'Unknown');
        const startupIdMap = await findStartupIdsByNames(startupNames);
        
        const matchMappings: Array<{ startup_id: string; score: number }> = [];
        const startupsToCreate: Array<{ match: any }> = [];

        for (const match of resumeData.matches) {
          const startupName = match.startup?.name || 'Unknown';
          const supabaseStartupId = startupIdMap.get(startupName);

          if (supabaseStartupId) {
            matchMappings.push({
              startup_id: supabaseStartupId,
              score: match.score || 0,
            });
          } else {
            startupsToCreate.push({ match });
          }
        }

        // Create missing startups
        if (startupsToCreate.length > 0) {
          const createPromises = startupsToCreate.map(async ({ match }) => {
            try {
              const startupName = match.startup?.name || 'Unknown';
              await saveStartup({
                id: match.id || startupName.toLowerCase().replace(/\s+/g, '-'),
                name: startupName,
                industry: match.startup?.industry || '',
                description: match.startup?.description || '',
                funding_stage: match.startup?.funding_stage || '',
                funding_amount: match.startup?.funding_amount || '',
                location: match.startup?.location || '',
                website: match.startup?.website || '',
                keywords: match.startup?.keywords || match.startup?.tags || '',
              });
              return { match, startupId: match.id };
            } catch (error) {
              console.warn(`Failed to create startup "${match.startup?.name}":`, error);
              return null;
            }
          });

          const createdStartups = await Promise.all(createPromises);
          createdStartups.forEach((result) => {
            if (result) {
              matchMappings.push({
                startup_id: result.startupId,
                score: result.match.score || 0,
              });
            }
          });
        }

        // Save matches
        if (matchMappings.length > 0) {
          await saveMatches(candidate.id, matchMappings);
        }
      } catch (error) {
        console.error('Failed to save matches:', error);
      }
    }

    return NextResponse.json({
      success: true,
      candidateId: candidate.id,
    });
  } catch (error) {
    console.error('Exception processing stored resume:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

