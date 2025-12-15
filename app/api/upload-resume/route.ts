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
import type { StructuredResumeData } from '@/types/resume';
import { upsertCandidate, findMatchingStartups } from '@/lib/pinecone';
import { saveCandidate, saveMatches, saveStartup, isSubscribed, findStartupIdByName, findStartupIdsByNames, getCandidate, getResumeCountForCandidate, createResume } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { convertResumeToLaTeX } from '@/lib/pdf-to-latex';

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

/**
 * Extracts name, email, skills, and summary from resume using Gemini
 * Supports both PDF (sent directly as base64) and DOCX (text extracted first)
 * Also extracts full text for storage
 */
async function extractResumeDataWithGemini(
  file: File,
  buffer: Buffer,
  arrayBuffer: ArrayBuffer
): Promise<{ extraction: ResumeExtractionResult; fullText: string; latexCode: string }> {
  const { genAI, fileManager } = getGeminiClients();
  let uploadedFileUri: string | null = null;
  let uploadedFileMimeType: string | null = null;
  let uploadedFileName: string | null = null;
  let docxFullText: string = ''; // Store DOCX text if we extract it

  const prompt = `Extract the following from this resume and return JSON only in this exact form:
{
  "name": "Full name of the candidate",
  "email": "Email address (or empty string if not found)",
  "skills": ["Array of 6-12 relevant technical and professional skills"],
  "summary": "A 2-3 sentence professional overview of the candidate",
  "location": "Current location or preferred location (city, state/country format, or empty string if not found)",
  "education_level": "Highest degree (e.g., 'Bachelor's', 'Master's', 'PhD', 'High School', or empty string if not found)",
  "university": "Name of the university/college for highest degree (or empty string if not found)",
  "past_internships": ["Array of past internship experiences with company names, or empty array if none found"],
  "technical_projects": ["Array of notable technical/personal projects with brief descriptions, or empty array if none found"]
}`;

  // Use gemini-2.0-flash-exp for fast, cost-effective resume extraction
  // This model is optimized for speed and cost while maintaining quality
  // No fallback loop to avoid excessive API calls
  const modelName = 'gemini-2.0-flash-exp';

  // Extract DOCX text once before processing (only needed for DOCX files)
  if (!isPdfFile(file)) {
    const docxText = await extractDocxText(buffer);
    if (docxText && docxText.trim().length > 0) {
      docxFullText = docxText;
    }
  }

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    let result;

    if (isPdfFile(file)) {
      // For PDFs: Upload to Gemini File API first, then use the file reference
      // This is the recommended approach for PDFs
      console.log(`[${modelName}] Uploading PDF to Gemini File API...`);
      const uploadResult = await fileManager.uploadFile(buffer, {
        mimeType: 'application/pdf',
        displayName: file!.name,
      });

      const uploadedFile = uploadResult.file;
      uploadedFileName = uploadedFile.name; // Store for cleanup
      console.log(`[${modelName}] PDF uploaded, state: ${uploadedFile.state}, name: ${uploadedFile.name}`);

      // Wait for the file to be processed with optimized polling
      let fileMetadata = uploadedFile;
      let pollCount = 0;
      const maxPolls = 20; // Max 5 seconds (20 * 250ms)
      while (fileMetadata.state === 'PROCESSING' && pollCount < maxPolls) {
        console.log(`[${modelName}] Waiting for PDF processing... (${pollCount + 1}/${maxPolls})`);
        await new Promise((resolve) => setTimeout(resolve, 250)); // Faster polling: 250ms instead of 1000ms
        fileMetadata = await fileManager.getFile(uploadedFile.name);
        pollCount++;
      }

      if (fileMetadata.state === 'PROCESSING') {
        console.warn(`[${modelName}] PDF processing timeout after ${maxPolls} polls`);
      }

      if (fileMetadata.state === 'FAILED') {
        throw new Error('PDF processing failed');
      }

      console.log(`[${modelName}] PDF ready, generating content with fileUri: ${fileMetadata.uri}`);

      // Store file URI for full text extraction
      uploadedFileUri = fileMetadata.uri;
      uploadedFileMimeType = fileMetadata.mimeType;

      // Now use the uploaded file in the request
      result = await model.generateContent([
        { text: prompt },
        {
          fileData: {
            fileUri: fileMetadata.uri,
            mimeType: fileMetadata.mimeType,
          },
        },
      ]);
    } else {
      // For DOCX: Use the text we already extracted
      if (!docxFullText || docxFullText.trim().length === 0) {
        throw new Error('Could not extract text from DOCX file. The file may be corrupted or empty.');
      }

      result = await model.generateContent(`${prompt}\n\nHere is the resume text:\n\n${docxFullText}`);
    }

    // Process the response
    const response = result.response;
    const responseText = response.text();
    const cleanedResponse = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleanedResponse) as ResumeExtractionResult;

    // Validate the response structure
    if (typeof parsed.name !== 'string') {
      throw new Error('Invalid response: name must be a string');
    }
    if (typeof parsed.email !== 'string') {
      throw new Error('Invalid response: email must be a string');
    }
    if (!Array.isArray(parsed.skills)) {
      throw new Error('Invalid response: skills must be an array');
    }
    if (typeof parsed.summary !== 'string') {
      throw new Error('Invalid response: summary must be a string');
    }
    if (typeof parsed.location !== 'string') {
      throw new Error('Invalid response: location must be a string');
    }
    if (typeof parsed.education_level !== 'string') {
      throw new Error('Invalid response: education_level must be a string');
    }
    if (typeof parsed.university !== 'string') {
      throw new Error('Invalid response: university must be a string');
    }
    if (!Array.isArray(parsed.past_internships)) {
      throw new Error('Invalid response: past_internships must be an array');
    }
    if (!Array.isArray(parsed.technical_projects)) {
      throw new Error('Invalid response: technical_projects must be an array');
    }

    // Ensure skills count is between 6-12
    if (parsed.skills.length < 6) {
      console.warn(
        `Gemini returned fewer than 6 skills (${parsed.skills.length})`
      );
    }
    if (parsed.skills.length > 12) {
      parsed.skills = parsed.skills.slice(0, 12);
    }

    // Extract full text - for PDFs use pdf-parse, for DOCX we already have it
    let fullText = '';
    let latexCode = '';

    if (isPdfFile(file)) {
      // Extract full text from PDF using pdf-parse (local, fast, free)
      console.log('Extracting full text from PDF using pdf-parse...');
      fullText = await extractFullTextFromPdf(buffer);
      console.log(`Extracted ${fullText.length} characters of full text from PDF`);

      // Clean up: delete the uploaded file from Gemini (no longer needed for text extraction)
      if (uploadedFileName) {
        try {
          await fileManager.deleteFile(uploadedFileName);
          console.log(`[${modelName}] Deleted uploaded file from Gemini`);
        } catch (error) {
          console.warn('Failed to delete uploaded file:', error);
          // Continue even if deletion fails
        }
      }

      // Generate LaTeX from extracted text (local conversion, no API cost)
      console.log('Generating LaTeX from extracted text...');
      latexCode = generateLatexFromResumeText(fullText);
    } else if (!isPdfFile(file) && docxFullText) {
      // For DOCX, use the text we already extracted
      fullText = docxFullText;
      console.log(`Using extracted ${fullText.length} characters of full text from DOCX`);

      // Generate LaTeX from DOCX text (local conversion, no API cost)
      console.log('Generating LaTeX from DOCX text...');
      latexCode = generateLatexFromResumeText(fullText);
    }

    return { extraction: parsed, fullText, latexCode };
  } catch (error: any) {
    // Re-throw error with helpful context
    console.error(`Failed to extract resume data with ${modelName}:`, error);
    throw new Error(
      `Failed to process resume: ${error?.message || 'Unknown error'}. ` +
      `Please ensure the file is a valid PDF or DOCX and try again.`
    );
  }
}

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
 * Combines summary, skills, and additional context for richer matching
 */
async function generateEmbedding(
  extractionResult: ResumeExtractionResult
): Promise<number[]> {
  const { genAI } = getGeminiClients();
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Build a comprehensive text representation for better embedding quality
  const combinedText = `
Professional Summary: ${extractionResult.summary}
Technical Skills: ${extractionResult.skills.join(', ')}
Location: ${extractionResult.location || 'Not specified'}
Education: ${extractionResult.education_level || 'Not specified'} from ${extractionResult.university || 'Not specified'}
Past Internships: ${extractionResult.past_internships.length > 0 ? extractionResult.past_internships.join('; ') : 'None listed'}
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

    // Check resume upload limits for free users
    if (isAuthenticated && accountEmail) {
      const existingCandidate = await getCandidate(accountEmail);
      if (existingCandidate) {
        const isPremium = isSubscribed(existingCandidate);
        // Free users can only have 1 resume - check count in resumes table
        const resumeCount = await getResumeCountForCandidate(existingCandidate.id);
        if (!isPremium && resumeCount >= 1) {
          return NextResponse.json(
            {
              success: false,
              error: 'Free plan allows only one uploaded resume. Upgrade to Premium for unlimited resumes.',
              upgradeRequired: true,
            },
            { status: 403 }
          );
        }
      }
    }

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

    // Extract name, email, skills, and summary using Gemini
    // Also extract full text and generate LaTeX / structured data for storage in database
    // For PDFs: Gemini processes the file directly (no parsing needed!)
    // For DOCX: Text is extracted first, then sent to Gemini
    let extractionResult: ResumeExtractionResult;
    let resumeFullText: string = '';
    let resumeLatex: string = '';
    let rawText: string = '';
    let structuredResumeData: StructuredResumeData | null = null;

    try {
      const { extraction, fullText, latexCode } = await extractResumeDataWithGemini(file!, buffer, arrayBuffer);
      extractionResult = extraction;
      resumeFullText = fullText;
      resumeLatex = latexCode;
      
      // Build a minimal StructuredResumeData object from the Gemini extraction
      structuredResumeData = {
        personal: {
          name: extractionResult.name,
          email: accountEmail,
          location: extractionResult.location,
        },
        summary: extractionResult.summary,
        experience: [],
        education: [],
        projects: [],
        skills: extractionResult.skills,
        certifications: [],
      };
      
      // Extract raw text for response
      // For PDFs, use the extracted full text; for DOCX, it's already in resumeFullText
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

          const { error: uploadError } = await supabaseAdmin.storage
            .from('resumes')
            .upload(objectPath, buffer, {
              contentType: file!.type || 'application/octet-stream',
              upsert: false, // Don't overwrite - each resume should be unique
            });

          if (uploadError) {
            console.error('Failed to upload resume file to Storage:', uploadError);
          } else {
            console.log('Uploaded resume file to Storage at path:', objectPath);
            resumePath = objectPath; // Store the path to attach when saving resume
          }
        } else {
          console.warn('SUPABASE_SERVICE_ROLE_KEY is not set; skipping resume file upload.');
        }
      } catch (error) {
        console.error('Unexpected error uploading resume to Storage:', error);
      }

      try {
        await upsertCandidate(
          accountEmail,
          embedding,
          {
            // Prioritize resume-extracted name over auth metadata
            name: extractionResult.name || accountName || 'Unknown',
            email: accountEmail,
            summary: extractionResult.summary,
            skills: extractionResult.skills.join(', '),
            location: extractionResult.location,
            education_level: extractionResult.education_level,
            university: extractionResult.university,
            past_internships: extractionResult.past_internships.join(', '),
            technical_projects: extractionResult.technical_projects.join(', '),
          }
        );
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
          summary: extractionResult.summary,
          skills: extractionResult.skills.join(', '),
          location: extractionResult.location,
          education_level: extractionResult.education_level,
          university: extractionResult.university,
          past_internships: extractionResult.past_internships.join(', '),
          technical_projects: extractionResult.technical_projects.join(', '),
          // Note: resume_path and resume_full_text are deprecated on candidates - using resumes table instead
          resume_latex: resumeLatex, // Store LaTeX source for editing
          // structured_resume_data intentionally omitted for new uploads; structured data now lives on the resumes table
        });
        candidateId = savedCandidate.id; // Get the UUID
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
        
        await createResume({
          candidate_id: candidateId,
          name: finalResumeName,
          file_name: resumeFileName,
          resume_path: resumePath,
          resume_full_text: resumeFullText,
          // Store structured data on the resume as well for per-resume tailoring
          structured_data: structuredResumeData || undefined,
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
      summary: extractionResult.summary,
      location: extractionResult.location,
      education_level: extractionResult.education_level,
      university: extractionResult.university,
      past_internships: extractionResult.past_internships,
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
