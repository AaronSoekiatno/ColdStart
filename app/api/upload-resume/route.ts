import { NextRequest, NextResponse, after } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  validateFile,
  extractDocxText,
  extractPdfText,
  isPdfFile,
  type ResumeExtractionResult,
  type ResumeProcessingResult,
} from './utils';
import { upsertCandidate, findMatchingStartups } from '@/lib/pinecone';
import { saveCandidate, saveMatches, saveStartup, findStartupIdsByNames, getResumeCountForCandidate, createResume, updateResume } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { convertResumeToLaTeX } from '@/lib/pdf-to-latex';
import { parseResumeToStructured } from '@/lib/parse-resume';

export const runtime = 'nodejs';

// Get Gemini clients - initialized lazily to ensure env vars are loaded
function getGeminiClients() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return {
    genAI: new GoogleGenerativeAI(apiKey),
  };
}

/**
 * Extracts full text content from a PDF using pdf-parse
 * Used to store the complete resume text for email generation context
 * This is much faster and cheaper than using Gemini for text extraction
 */
async function extractFullTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const text = await extractPdfText(buffer);
    return text.trim();
  } catch (error) {
    console.warn('Failed to extract full text from PDF:', error);
    return ''; // Return empty string if extraction fails - we'll continue with structured data
  }
}

// NOTE: We previously used Gemini's File API to extract fields directly from the
// uploaded file. To reduce costs and avoid uploading user files to Gemini, we now:
// - Extract full text locally using pdf-parse/mammoth
// - Parse that text into structured data with parseResumeToStructured
// - Derive high-level fields (name, email, skills, experience, etc.) from the structured data

/**
 * Generates LaTeX source code from resume text using local template-based conversion
 * This is a free alternative to using Gemini API
 */
function generateLatexFromResumeText(fullText: string): string {
  try {
    if (!fullText || fullText.trim().length === 0) {
      console.warn('No text provided for LaTeX generation');
      return '';
    }

    const latexCode = convertResumeToLaTeX(fullText);
    console.log(`Successfully generated ${latexCode.length} characters of LaTeX code`);
    return latexCode;
  } catch (error) {
    console.error('Failed to generate LaTeX from resume text:', error);
    return ''; // Return empty string if generation fails
  }
}

/**
 * Generates an embedding for the candidate profile using Gemini
 * Combines skills and additional context for richer matching
 */
async function generateEmbedding(
  extractionResult: ResumeExtractionResult
): Promise<number[]> {
  const { genAI } = getGeminiClients();
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Build a comprehensive text representation for better embedding quality
  const combinedText = `
Technical Skills: ${extractionResult.skills.join(', ')}
Location: ${extractionResult.location || 'Not specified'}
Education: ${extractionResult.education_level || 'Not specified'} from ${extractionResult.university || 'Not specified'}
Experience: ${extractionResult.experience.length > 0 ? extractionResult.experience.join('; ') : 'None listed'}
Technical Projects: ${extractionResult.technical_projects.length > 0 ? extractionResult.technical_projects.join('; ') : 'None listed'}
  `.trim();

  const result = await model.embedContent({
    content: {
      role: 'user',
      parts: [{ text: combinedText }],
    },
  });

  if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
    throw new Error('Failed to generate embedding: Invalid response structure');
  }

  return result.embedding.values;
}

export async function POST(request: NextRequest) {
  try {
    // Import cookies at runtime (Next.js 15+ requirement)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookie setting might fail in route handlers - this is okay
            }
          },
        },
      }
    );

    // Authentication is optional - allow uploads without sign-in
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Debug authentication
    console.log('\n=== AUTHENTICATION DEBUG ===');
    console.log('Auth Error:', authError);
    console.log('User Object:', user ? {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    } : 'No user');
    console.log('Cookies:', request.cookies.getAll());
    console.log('============================\n');

    const isAuthenticated = !authError && user && user.email;
    const accountEmail = isAuthenticated ? user.email : null;
    const accountName = isAuthenticated
      ? ((user.user_metadata?.full_name as string | undefined) ?? undefined)
      : undefined;

    console.log('Is Authenticated:', isAuthenticated);
    console.log('Account Email:', accountEmail);

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('GEMINI_API_KEY exists:', !!apiKey);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error: Gemini API key not configured',
        },
        { status: 500 }
      );
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid request format. Please submit as multipart/form-data with a file field named "resume".',
        },
        { status: 400 }
      );
    }

    // Get optional resume name from form data
    const resumeName = formData.get('resumeName') as string | null;
    const file = formData.get('resume') as File | null;

    // Validate the uploaded file
    const validation = validateFile(file!);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Read file as buffer and also get ArrayBuffer for base64 encoding
    let buffer: Buffer;
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file!.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to read the uploaded file. Please try again.',
        },
        { status: 400 }
      );
    }

    // ==========================================================================================
    // AUTHENTICATED USERS: ASYNC PROCESSING (Wait-free)
    // ==========================================================================================
    if (isAuthenticated && accountEmail) {
      console.log('Authenticated user detected. Starting asynchronous processing...');

      // 1. Upload file to Supabase Storage Synchronously
      let resumePath: string | undefined;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );

          const userId = user!.id;
          const folderPath = `resumes/${userId}`;
          const timestamp = Date.now();
          const originalName = file!.name || 'resume.pdf';
          const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const uniqueFileName = `${timestamp}-${sanitizedName}`;
          const objectPath = `${folderPath}/${uniqueFileName}`;

          console.log('Uploading resume to Storage (Sync)...');
          const { error: uploadError } = await supabaseAdmin.storage
            .from('resumes')
            .upload(objectPath, buffer, {
              contentType: file!.type || 'application/octet-stream',
              upsert: false,
            });

          if (uploadError) {
             console.error('Failed to upload resume file to Storage:', uploadError);
             // We can proceed without storage, but warn
          } else {
             console.log('✓ Successfully uploaded resume file to Storage at path:', objectPath);
             resumePath = objectPath;
          }
        } catch (error) {
           console.error('Unexpected error uploading resume to Storage:', error);
        }
      }

      // 2. Save minimal Candidate record (Sync) to ensure ID exists
      let candidateId: string;
      try {
        const savedCandidate = await saveCandidate({
          email: accountEmail,
          name: accountName || 'Unknown',
          skills: '', // Will be updated async
          // Default/Empty values for now
          location: '',
          education_level: '',
          university: '',
          experience: '',
          technical_projects: '',
        });
        candidateId = savedCandidate.id!;
      } catch (error) {
        throw new Error(`Failed to initialize candidate record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 3. Create Resume record (Sync)
      let resumeId: string | undefined;
      try {
          const finalResumeName = resumeName?.trim() || `${accountName || 'New'} Resume`;
          const resumeFileName = file!.name;
          
          // Check if this is the first resume
          const resumeCount = await getResumeCountForCandidate(candidateId);
          const shouldSetAsPrimary = resumeCount === 0;

          const savedResume = await createResume({
            candidate_id: candidateId,
            name: finalResumeName,
            file_name: resumeFileName,
            resume_path: resumePath, // Might be undefined if upload failed, but usually defined
            is_active: true,
            is_primary: shouldSetAsPrimary,
            // structured_data and full_text will be updated async
          });
          resumeId = savedResume.id;
      } catch (error) {
         console.warn('Failed to create initial resume record:', error);
         // Proceeding, but async part will fail to update resume if ID missing
      }

      // 4. Return Early Response
      // Schedule heavy lifting in background
      after(async () => {
         console.log('>>> Starting background resume processing for:', accountEmail);
         try {
            // A. Extract Text & Parse
            let resumeFullText = '';
            let structuredResumeData: any = null;
            let resumeLatex = '';
            
            if (isPdfFile(file!)) {
                resumeFullText = await extractFullTextFromPdf(buffer);
            } else {
                const docxText = await extractDocxText(buffer);
                resumeFullText = docxText || '';
            }

            // B. Parse Structure & Latex
            if (resumeFullText && resumeFullText.trim().length > 0) {
               try {
                  structuredResumeData = await parseResumeToStructured(resumeFullText);
               } catch (e) {
                  console.error('Background: Failed to parse structured data', e);
               }
               try {
                  resumeLatex = generateLatexFromResumeText(resumeFullText);
               } catch (e) {
                  console.error('Background: Failed to generate latex', e);
               }
            }

            // C. Derive Extraction Result
             // 3) Derive high-level extraction fields from structured data, with sensible fallbacks
            const personal = structuredResumeData?.personal || {};
            const educationArr = Array.isArray(structuredResumeData?.education) ? structuredResumeData.education : [];
            const experienceArr = Array.isArray(structuredResumeData?.experience) ? structuredResumeData.experience : [];
            const projectsArr = Array.isArray(structuredResumeData?.projects) ? structuredResumeData.projects : [];
            const skillsArr = Array.isArray(structuredResumeData?.skills) ? structuredResumeData.skills : [];

            const primaryEducation = educationArr[0] || {};

            const isRemoteLocation = (location: string): boolean => {
                if (!location) return false;
                const locLower = location.toLowerCase().trim();
                return locLower === 'remote' || 
                       locLower.startsWith('r emote,') ||
                       (locLower.includes('remote') && locLower.length < 20);
            };

            const getLocationWithFallbacks = (): string => {
                const personalLoc = (personal.location as string) || '';
                if (personalLoc && !isRemoteLocation(personalLoc)) return personalLoc;
                
                for (const exp of experienceArr) {
                    const expLocation = (exp.location as string) || '';
                    if (expLocation && !isRemoteLocation(expLocation)) return expLocation;
                }
                
                const eduLocation = (primaryEducation.location as string) || '';
                if (eduLocation && !isRemoteLocation(eduLocation)) return eduLocation;
                
                return '';
            };

            const extractionResult: ResumeExtractionResult = {
                name: (personal.name as string) || accountName || 'Unknown',
                email: (personal.email as string) || accountEmail || '',
                skills: skillsArr.filter((s: string) => !!s && s.trim().length > 0),
                location: getLocationWithFallbacks(),
                education_level: (primaryEducation.degree as string) || '',
                university: (primaryEducation.school as string) || '',
                experience: experienceArr.map((exp: any) => {
                    const title = exp.title || '';
                    const company = exp.company || '';
                    const location = exp.location || '';
                    const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
                    const parts = [title, company, location, dateRange].filter((p) => !!p && String(p).trim().length > 0);
                    return parts.join(' | ');
                }).filter((s: string) => !!s && s.trim().length > 0),
                technical_projects: projectsArr.map((proj: any) => {
                    const name = proj.name || '';
                    const technologies = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '';
                    const descArray = Array.isArray(proj.description) ? proj.description : [];
                    const desc = descArray.join(' ');
                    const parts = [name, technologies, desc].filter((p) => !!p && String(p).trim().length > 0);
                    return parts.join(' | ');
                }).filter((s: string) => !!s && s.trim().length > 0),
            };

            // D. Generate Embedding
            let embedding: number[] = [];
            try {
                embedding = await generateEmbedding(extractionResult);
            } catch (e) {
                console.error('Background: Failed to generate embedding', e);
                // Can't proceed with matches if embedding failed, but can save other data
            }

            // E. Consolidate Updates (Candidate & Resume)
            // Save Candidate with full data
            await saveCandidate({
                email: accountEmail,
                name: extractionResult.name || accountName || 'Unknown',
                skills: extractionResult.skills.join(', '),
                location: extractionResult.location,
                education_level: extractionResult.education_level,
                university: extractionResult.university,
                experience: extractionResult.experience.join(', '),
                technical_projects: extractionResult.technical_projects.join(', '),
                // Keeping deprecated fields for now as per original code
                resume_latex: resumeLatex, 
                structured_resume_data: structuredResumeData, 
            });

            // Pinecone Upsert
            if (embedding.length > 0) {
                 await upsertCandidate(accountEmail, embedding, {
                    name: extractionResult.name || accountName || 'Unknown',
                    email: accountEmail,
                    skills: extractionResult.skills.join(', '),
                    location: extractionResult.location,
                    education_level: extractionResult.education_level,
                    university: extractionResult.university,
                    experience: extractionResult.experience.join(', '),
                    technical_projects: extractionResult.technical_projects.join(', '),
                 });
                 console.log('Background: Pinecone upsert success');
            }

            // Update Resume Record
            if (resumeId) {
                await updateResume(resumeId, {
                    resume_full_text: resumeFullText,
                    structured_data: structuredResumeData,
                });
            }

            // F. Find & Save Matches
             if (embedding.length > 0) {
                 const matches = await findMatchingStartups(embedding, 10000);
                 if (matches.length > 0 && candidateId) {
                      const startupNames = matches.map(match => match.metadata.name || 'Unknown');
                      const startupIdMap = await findStartupIdsByNames(startupNames);
                      
                      const matchMappings: Array<{ startup_id: string; score: number }> = [];
                      const startupsToCreate: Array<{ match: typeof matches[0], index: number }> = [];

                      for (let i = 0; i < matches.length; i++) {
                        const match = matches[i];
                        const startupName = match.metadata.name || 'Unknown';
                        const supabaseStartupId = startupIdMap.get(startupName);

                        if (supabaseStartupId) {
                           matchMappings.push({ startup_id: supabaseStartupId, score: match.score });
                        } else {
                           startupsToCreate.push({ match, index: i });
                        }
                      }

                      // Create missing startups
                      if (startupsToCreate.length > 0) {
                        const createPromises = startupsToCreate.map(async ({ match }) => {
                          try {
                            const startupName = match.metadata.name || 'Unknown';
                            await saveStartup({
                              id: match.id, 
                              name: startupName,
                              industry: match.metadata.industry || '',
                              description: match.metadata.description || '',
                              funding_stage: match.metadata.funding_stage || '',
                              funding_amount: match.metadata.funding_amount || '',
                              location: match.metadata.location || '',
                              website: match.metadata.website || '',
                              keywords: (match.metadata as any).keywords || match.metadata.tags || '',
                            });
                            return { match, startupId: match.id };
                          } catch (error) {
                            return null;
                          }
                        });
                        const createdStartups = await Promise.all(createPromises);
                        createdStartups.forEach((result) => {
                          if (result) {
                            matchMappings.push({ startup_id: result.startupId, score: result.match.score });
                          }
                        });
                      }

                      if (matchMappings.length > 0) {
                          await saveMatches(candidateId, matchMappings);
                          console.log(`Background: Saved ${matchMappings.length} matches.`);
                      }
                 }
            } else {
                console.warn('Background: No embedding, skipping matching.');
            }

            console.log('<<< Background resume processing completed successfully.');

         } catch (error) {
             console.error('CRITICAL: Background resume processing failed:', error);
             // Since we already responded 200, user won't know unless they check data.
         }
      });

      return NextResponse.json({
         success: true, 
         savedToDatabase: true, // Signal to frontend that we are done "uploading"
         message: 'Resume upload started. Processing in background.'
      }, { status: 200 });
    }

    // ==========================================================================================
    // UNAUTHENTICATED USERS: SYNC PROCESSING (Existing Behavior)
    // ==========================================================================================
    console.log('Unauthenticated Flow (Sync)...');
    
    // Extract full text locally and derive fields from structured parsing
    let extractionResult: ResumeExtractionResult;
    let resumeFullText: string = '';
    let resumeLatex: string = '';
    let rawText: string = '';
    let structuredResumeData: any = null;

    try {
      // 1) Get full text locally
      if (isPdfFile(file!)) {
        console.log('Extracting full text from PDF using pdf-parse...');
        resumeFullText = await extractFullTextFromPdf(buffer);
        console.log(`Extracted ${resumeFullText.length} characters of full text from PDF`);
      } else {
        console.log('Extracting full text from DOCX using mammoth...');
        const docxText = await extractDocxText(buffer);
        resumeFullText = docxText || '';
        console.log(`Extracted ${resumeFullText.length} characters of full text from DOCX`);
      }

      // 2) Parse into structured data using Gemini (text-only)
      if (resumeFullText && resumeFullText.trim().length > 0) {
        try {
          console.log('Starting structured resume parsing...');
          structuredResumeData = await parseResumeToStructured(resumeFullText);
          console.log('Successfully parsed resume into structured format:', {
            hasPersonal: !!structuredResumeData?.personal,
            experienceCount: structuredResumeData?.experience?.length || 0,
            educationCount: structuredResumeData?.education?.length || 0,
          });
        } catch (parseError) {
          console.error('Failed to parse resume into structured format:', parseError);
          structuredResumeData = null;
        }
      }

      // 3) Derive high-level extraction fields
      const personal = structuredResumeData?.personal || {};
      const educationArr = Array.isArray(structuredResumeData?.education) ? structuredResumeData.education : [];
      const experienceArr = Array.isArray(structuredResumeData?.experience) ? structuredResumeData.experience : [];
      const projectsArr = Array.isArray(structuredResumeData?.projects) ? structuredResumeData.projects : [];
      const skillsArr = Array.isArray(structuredResumeData?.skills) ? structuredResumeData.skills : [];

      const primaryEducation = educationArr[0] || {};

      const isRemoteLocation = (location: string): boolean => {
        if (!location) return false;
        const locLower = location.toLowerCase().trim();
        return locLower === 'remote' || 
               locLower.startsWith('r emote,') ||
               (locLower.includes('remote') && locLower.length < 20); 
      };

      const getLocationWithFallbacks = (): string => {
        const personalLoc = (personal.location as string) || '';
        if (personalLoc && !isRemoteLocation(personalLoc)) return personalLoc;
        
        for (const exp of experienceArr) {
          const expLocation = (exp.location as string) || '';
          if (expLocation && !isRemoteLocation(expLocation)) return expLocation;
        }
        
        const eduLocation = (primaryEducation.location as string) || '';
        if (eduLocation && !isRemoteLocation(eduLocation)) return eduLocation;
        
        return '';
      };

      extractionResult = {
        name: (personal.name as string) || accountName || 'Unknown',
        email: (personal.email as string) || accountEmail || '',
        skills: skillsArr.filter((s: string) => !!s && s.trim().length > 0),
        location: getLocationWithFallbacks(),
        education_level: (primaryEducation.degree as string) || '',
        university: (primaryEducation.school as string) || '',
        experience: experienceArr.map((exp: any) => {
          const title = exp.title || '';
          const company = exp.company || '';
          const location = exp.location || '';
          const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
          const parts = [title, company, location, dateRange].filter((p) => !!p && String(p).trim().length > 0);
          return parts.join(' | ');
        }).filter((s: string) => !!s && s.trim().length > 0),
        technical_projects: projectsArr.map((proj: any) => {
          const name = proj.name || '';
          const technologies = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '';
          const descArray = Array.isArray(proj.description) ? proj.description : [];
          const desc = descArray.join(' ');
          const parts = [name, technologies, desc].filter((p) => !!p && String(p).trim().length > 0);
          return parts.join(' | ');
        }).filter((s: string) => !!s && s.trim().length > 0),
      };

      // 4) Generate LaTeX locally
      if (resumeFullText && resumeFullText.trim().length > 0) {
        resumeLatex = generateLatexFromResumeText(resumeFullText);
      } else {
        resumeLatex = '';
      }

      rawText = resumeFullText || 'Resume text extraction completed';
    } catch (error) {
       // Simplified error handling for unauth flow as this is mostly legacy/demo
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { success: false, error: `Failed to analyze resume: ${errorMessage}`, details: errorMessage },
        { status: 500 }
      );
    }

    // Generate embedding (Unauth)
    let embedding: number[];
    try {
      embedding = await generateEmbedding(extractionResult);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate embedding.' },
        { status: 500 }
      );
    }

    // Find matches (Unauth)
    // Matches logic copied from original code (with 10000 limit)
    let matches: Array<{ id: string; score: number; metadata: any }> = [];
    try {
      matches = await findMatchingStartups(embedding, 10000);
    } catch (error) {
      console.error('Failed to find matching startups:', error);
    }

    // Build response
    const result: ResumeProcessingResult = {
      success: true,
      rawText,
      name: extractionResult.name,
      email: extractionResult.email,
      skills: extractionResult.skills,
      location: extractionResult.location,
      education_level: extractionResult.education_level,
      university: extractionResult.university,
      experience: extractionResult.experience,
      technical_projects: extractionResult.technical_projects,
      embedding,
      savedToDatabase: false,
      matches: matches.map((match) => ({
        startup: match.metadata,
        score: match.score,
        id: match.id,
      })),
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Unexpected error processing resume:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing the resume.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
