import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import {
  validateFile,
  extractDocxText,
  extractPdfText,
  isPdfFile,
  cleanJsonResponse,
  type ResumeExtractionResult,
  type ResumeProcessingResult,
} from './utils';
import { upsertCandidate, findMatchingStartups } from '@/lib/pinecone';
import { saveCandidate, saveMatches, saveStartup, findStartupIdByName, findStartupIdsByNames, getCandidate, getResumeCountForCandidate, createResume } from '@/lib/supabase';
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
    fileManager: new GoogleAIFileManager(apiKey),
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
    console.log('GEMINI_API_KEY length:', apiKey?.length);
    console.log('GEMINI_API_KEY first 10 chars:', apiKey?.substring(0, 10));

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

    // Resume upload limits temporarily removed - all users can upload multiple resumes
    // TODO: Re-implement premium-based resume limits if needed in the future

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

    // Extract full text locally and derive fields from structured parsing
    // No Gemini File API upload is used here.
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
            projectsCount: structuredResumeData?.projects?.length || 0,
            skillsCount: structuredResumeData?.skills?.length || 0,
          });
        } catch (parseError) {
          console.error('Failed to parse resume into structured format:', parseError);
          console.error('Parse error details:', parseError instanceof Error ? parseError.message : parseError);
          structuredResumeData = null;
        }
      }

      // 3) Derive high-level extraction fields from structured data, with sensible fallbacks
      const personal = structuredResumeData?.personal || {};
      const educationArr = Array.isArray(structuredResumeData?.education) ? structuredResumeData.education : [];
      const experienceArr = Array.isArray(structuredResumeData?.experience) ? structuredResumeData.experience : [];
      const projectsArr = Array.isArray(structuredResumeData?.projects) ? structuredResumeData.projects : [];
      const skillsArr = Array.isArray(structuredResumeData?.skills) ? structuredResumeData.skills : [];

      const primaryEducation = educationArr[0] || {};

      // Helper function to check if location is Remote
      const isRemoteLocation = (location: string): boolean => {
        if (!location) return false;
        const locLower = location.toLowerCase().trim();
        // Check for common remote patterns
        return locLower === 'remote' || 
               locLower.startsWith('r emote,') ||
               (locLower.includes('remote') && locLower.length < 20); // "Remote" or "Remote, US" but not "Remote Office Location"
      };

      // Helper function to get location with fallbacks (excluding Remote)
      const getLocationWithFallbacks = (): string => {
        // 1. Try personal location first
        const personalLoc = (personal.location as string) || '';
        if (personalLoc && !isRemoteLocation(personalLoc)) {
          return personalLoc;
        }
        
        // 2. Try most recent experience location (excluding Remote)
        // Experience array is usually ordered most recent first
        for (const exp of experienceArr) {
          const expLocation = (exp.location as string) || '';
          if (expLocation && !isRemoteLocation(expLocation)) {
            return expLocation;
          }
        }
        
        // 3. Try education location as last resort
        const eduLocation = (primaryEducation.location as string) || '';
        if (eduLocation && !isRemoteLocation(eduLocation)) {
          return eduLocation;
        }
        
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

      // 4) Generate LaTeX locally from full text
      if (resumeFullText && resumeFullText.trim().length > 0) {
        console.log('Generating LaTeX from extracted text...');
        resumeLatex = generateLatexFromResumeText(resumeFullText);
      } else {
        resumeLatex = '';
      }

      // Raw text for response
      rawText = resumeFullText || 'Resume text extraction completed';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Gemini skills extraction error:', {
        message: errorMessage,
        stack: errorStack,
        fileType: file!.type,
        fileName: file!.name,
        fileSize: file!.size,
      });
      
      // Return more helpful error messages based on the error type
      let userMessage = 'Failed to analyze resume content.';
      let statusCode = 500;
      
      if (errorMessage.includes('API key')) {
        userMessage = 'Server configuration error: Invalid or missing Gemini API key.';
        statusCode = 500;
      } else if (errorMessage.includes('quota')) {
        userMessage = 'API quota exceeded. Please try again later.';
        statusCode = 429;
      } else if (errorMessage.includes('safety')) {
        userMessage = 'Content was blocked by safety filters. Please try a different resume.';
        statusCode = 400;
      } else if (errorMessage.includes('too large')) {
        userMessage = 'File is too large. Maximum file size is 10MB.';
        statusCode = 400;
      } else if (errorMessage.includes('extract text')) {
        userMessage = 'Could not read the file. Please ensure it is a valid PDF or DOCX file.';
        statusCode = 400;
      } else {
        userMessage = `Failed to analyze resume: ${errorMessage}`;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: userMessage,
          details: errorMessage,
        },
        { status: statusCode }
      );
    }

    // Generate embedding for the candidate profile (includes all extracted fields)
    let embedding: number[];
    try {
      embedding = await generateEmbedding(extractionResult);
    } catch (error) {
      console.error('Embedding generation error:', error);
      return NextResponse.json(
        {
          success: false,
          error:
            'Failed to generate embedding. Please try again or contact support.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Save candidate to Pinecone (for vector search) and Supabase (for queries) - only if authenticated
    let savedToDatabase = false;
    let databaseError: string | undefined;
    let candidateId: string | null = null; // Declare at this scope level
    let subscriptionTier: 'free' | 'premium' = 'free';
    let subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing' = 'inactive';

    if (isAuthenticated && accountEmail) {
      // Upload raw resume file to Supabase Storage (resumes bucket)
      // Support multiple resumes per user - each resume gets a unique path
      // Strategy:
      // 1. Generate a unique filename using timestamp and original filename
      // 2. Upload to path: resumes/{userId}/{timestamp}-{sanitized-filename}
      // 3. This allows multiple resumes without overwriting previous ones
      let resumePath: string | undefined;
      try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );

          const userId = user!.id;
          const folderPath = `resumes/${userId}`;

          // Generate unique filename: timestamp-originalname
          const timestamp = Date.now();
          const originalName = file!.name || 'resume.pdf';
          // Sanitize filename: remove special chars, keep alphanumeric, dots, dashes, underscores
          const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const ext = originalName.includes('.') ? originalName.split('.').pop() : 'pdf';
          const safeExt = ext || 'pdf';
          const uniqueFileName = `${timestamp}-${sanitizedName}`;
          const objectPath = `${folderPath}/${uniqueFileName}`;

          console.log('Attempting to upload resume to Storage:', {
            objectPath,
            fileType: file!.type,
            bufferSize: buffer.length,
          });

          const { error: uploadError } = await supabaseAdmin.storage
            .from('resumes')
            .upload(objectPath, buffer, {
              contentType: file!.type || 'application/octet-stream',
              upsert: false, // Don't overwrite - each resume should be unique
            });

          if (uploadError) {
            console.error('Failed to upload resume file to Storage:', {
              error: uploadError,
              message: uploadError.message,
              objectPath,
            });
          } else {
            console.log('✓ Successfully uploaded resume file to Storage at path:', objectPath);
            resumePath = objectPath; // Store the path to attach when saving resume
          }
        } else {
          console.warn('SUPABASE_SERVICE_ROLE_KEY is not set; skipping resume file upload.');
        }
      } catch (error) {
        console.error('Unexpected error uploading resume to Storage:', error);
      }

      try {
        await upsertCandidate(accountEmail, embedding, {
          // Prioritize resume-extracted name over auth metadata
          name: extractionResult.name || accountName || 'Unknown',
          email: accountEmail,
          skills: extractionResult.skills.join(', '),
          location: extractionResult.location,
          education_level: extractionResult.education_level,
          university: extractionResult.university,
          experience: extractionResult.experience.join(', '),
          technical_projects: extractionResult.technical_projects.join(', '),
        });
        savedToDatabase = true;
        console.log('Successfully saved candidate to Pinecone:', {
          name: extractionResult.name,
          email: accountEmail,
        });
      } catch (error) {
        databaseError = error instanceof Error ? error.message : 'Unknown database error';
        console.error('Failed to save candidate to Pinecone:', {
          error: databaseError,
          candidate: {
            name: extractionResult.name,
            email: accountEmail,
          },
          fullError: error,
        });
        // Continue even if DB save fails - we still want to return the extracted data
      }

      // Save candidate to Supabase (for detailed queries) and get the UUID
      try {
        const savedCandidate = await saveCandidate({
          email: accountEmail,
          // Prioritize resume-extracted name over auth metadata
          name: extractionResult.name || accountName || 'Unknown',
          skills: extractionResult.skills.join(', '),
          location: extractionResult.location,
          education_level: extractionResult.education_level,
          university: extractionResult.university,
          experience: extractionResult.experience.join(', '),
          technical_projects: extractionResult.technical_projects.join(', '),
          // Note: resume_path and resume_full_text are deprecated - using resumes table instead
          resume_latex: resumeLatex, // Store LaTeX source for editing
          structured_resume_data: structuredResumeData, // Store structured data for template editing
        });
        candidateId = savedCandidate.id ?? null; // Get the UUID (handle undefined)
        subscriptionTier = savedCandidate.subscription_tier || 'free';
        subscriptionStatus = savedCandidate.subscription_status || 'inactive';

        // Save resume to the new resumes table
        // Use provided resume name, or generate one from candidate name
        const finalResumeName = resumeName?.trim() || `${extractionResult.name || 'Unknown'} Resume`;
        const resumeFileName = file!.name;
        
        // Ensure candidateId is valid before creating resume
        if (!candidateId) {
          throw new Error('Failed to get candidate ID after saving candidate');
        }
        
        // Check if this is the first resume (should be set as primary)
        const resumeCount = await getResumeCountForCandidate(candidateId);
        const shouldSetAsPrimary = resumeCount === 0; // First resume is automatically primary

        console.log('Creating resume with:', {
          candidateId,
          finalResumeName,
          resumeFileName,
          resumePath,
          resumePathDefined: resumePath !== undefined,
          resumeFullTextLength: resumeFullText?.length || 0,
        });

        await createResume({
          candidate_id: candidateId,
          name: finalResumeName,
          file_name: resumeFileName,
          resume_path: resumePath,
          resume_full_text: resumeFullText,
          structured_data: structuredResumeData, // Store structured data per-resume for template-based editing
          is_active: true, // New resumes are active by default
          is_primary: shouldSetAsPrimary, // First resume is automatically primary
        });

        console.log('Successfully saved candidate and resume to Supabase:', {
          name: extractionResult.name,
          email: accountEmail,
          candidateId,
          resumeName: finalResumeName,
          subscriptionTier,
          subscriptionStatus,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to save candidate/resume to Supabase:', {
          error: errorMessage,
          candidate: {
            name: extractionResult.name,
            email: accountEmail,
            candidateId,
          },
          fullError: error,
        });
        // Re-throw the error so it's properly handled by the outer error handler
        // This ensures the API returns an error response instead of silently failing
        throw new Error(`Failed to save resume: ${errorMessage}`);
      }
    } else {
      console.log('User not authenticated - skipping database save. Results will be returned for preview.');
    }

    // Find matching startups - no minimum score threshold, show all matches
    // Matches are ordered by score descending (highest to lowest)
    let matches: Array<{ id: string; score: number; metadata: any }> = [];
    let matchingError: string | undefined;
    try {
      // Find all matches - no minimum score threshold
      // Pinecone serverless free tier: max 100, paid tiers: up to 10000
      // Using 10000 to get all matches (will be limited by plan if needed)
      const maxMatches = 10000;
      matches = await findMatchingStartups(embedding, maxMatches);

      // Save matches to Supabase - only if authenticated and we have a candidate ID
      if (matches.length > 0 && isAuthenticated && candidateId) {
        try {
          // OPTIMIZED: Batch lookup all startup IDs at once instead of sequential queries
          // This reduces lookup time from 5-10 seconds to <1 second for large match sets
          const startupNames = matches.map(match => match.metadata.name || 'Unknown');
          const startupIdMap = await findStartupIdsByNames(startupNames);
          
          // Map Pinecone matches to Supabase startup IDs
          // This ensures we use existing Supabase data (with founder emails) instead of creating duplicates
          const matchMappings: Array<{ startup_id: string; score: number }> = [];
          const startupsToCreate: Array<{ match: typeof matches[0], index: number }> = [];

          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const startupName = match.metadata.name || 'Unknown';
            
            // Check if we found the startup ID in the batch lookup
            const supabaseStartupId = startupIdMap.get(startupName);

            if (supabaseStartupId) {
              // Startup exists in Supabase - use that ID
              matchMappings.push({
                startup_id: supabaseStartupId,
                score: match.score,
              });
            } else {
              // Startup doesn't exist - queue for creation
              // We'll create these in parallel after the batch lookup
              startupsToCreate.push({ match, index: i });
            }
          }

          // Create missing startups in parallel (if any)
          if (startupsToCreate.length > 0) {
            const createPromises = startupsToCreate.map(async ({ match }) => {
              try {
                const startupName = match.metadata.name || 'Unknown';
                await saveStartup({
                  id: match.id, // Use Pinecone ID for new startups
                  name: startupName,
                  industry: match.metadata.industry || '',
                  description: match.metadata.description || '',
                  funding_stage: match.metadata.funding_stage || '',
                  funding_amount: match.metadata.funding_amount || '',
                  location: match.metadata.location || '',
                  website: match.metadata.website || '',
                  keywords: match.metadata.keywords || match.metadata.tags || '',
                });
                return { match, startupId: match.id };
              } catch (error) {
                console.warn(`Failed to create startup "${match.metadata.name}":`, error instanceof Error ? error.message : 'Unknown error');
                return null;
              }
            });

            const createdStartups = await Promise.all(createPromises);
            
            // Add created startups to mappings
            createdStartups.forEach((result) => {
              if (result) {
                matchMappings.push({
                  startup_id: result.startupId,
                  score: result.match.score,
                });
              }
            });
          }

          // Now save the matches using Supabase startup IDs
          // Always save all quality matches so the UI can upsell based on hidden matches.
          // Free users will still only SEE the first match in the UI, but additional
          // matches are stored and counted for the Premium upgrade modal.
          await saveMatches(
            candidateId, // Use UUID instead of email
            matchMappings
          );
        } catch (error) {
          console.error('✗ Failed to save matches to Supabase:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            candidateId,
          });
          // Continue even if Supabase save fails
        }
      } else if (!isAuthenticated) {
        console.log('⚠ User not authenticated - matches will not be saved to database (preview only)');
      } else if (!candidateId) {
        console.log('⚠ Candidate ID not available - matches will not be saved to database');
      }
    } catch (error) {
      matchingError = error instanceof Error ? error.message : 'Unknown matching error';
      console.error('Failed to find matching startups:', {
        error: matchingError,
        fullError: error,
      });
      // Continue even if matching fails
    }

    // Build the successful response
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
      savedToDatabase,
      matches: matches.map((match) => ({
        startup: match.metadata,
        score: match.score,
        id: match.id,
      })),
      ...(databaseError && { databaseError }),
      ...(matchingError && { matchingError }),
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
