import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getCandidate } from '@/lib/supabase';
import { cleanJsonResponse, parseJsonSafely } from '../upload-resume/utils';
import type { ResumePatch } from '@/types/resume-patch';
import type { StructuredResumeData } from '@/types/resume';

export const runtime = 'nodejs';

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  patch?: ResumePatch;
}

/**
 * Generates general ATS-optimized resume suggestions using Gemini
 * This version provides general improvements without targeting a specific startup
 */
async function generateGeneralResumeSuggestions(
  resumeBuffer: Buffer,
  resumeMimeType: string,
  resumeFileName: string,
  structuredResumeData: StructuredResumeData | null
): Promise<ResumeSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  // Build structured data context for AI
  const structuredDataContext = structuredResumeData
    ? `\n\nSTRUCTURED RESUME DATA (for reference - use this to determine exact paths):
${JSON.stringify(structuredResumeData, null, 2)}

IMPORTANT: Use this structured data to identify the EXACT JSONPath where each change should be made.
For example:
- To edit the first bullet point of the first experience: "experience[0].description[0]"
- To edit a skill: "skills[2]"
- To edit a project description bullet: "projects[1].description[0]"
- To edit personal info: "personal.name" or "personal.email"
- To edit summary: "summary"`
    : '\n\nNote: Structured resume data is not available. You will need to infer paths from the resume content.';

  const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer and career coach focused on helping candidates stand out at tech startups.

${structuredDataContext}

CRITICAL RULES:
1. ONLY suggest improvements using technologies, skills, and experiences that ALREADY EXIST in the candidate's resume
2. DO NOT add skills, technologies, or experiences the candidate doesn't have
3. DO NOT fabricate achievements or metrics; never invent numbers. If metrics are missing, say: "Include real metrics to showcase real-world impact at this company/role."
4. Never propose specific numeric values unless they already appear in the resume; instead, prompt the candidate to add their real numbers.
5. When you want the candidate to add a metric or keyword that you cannot know, ALWAYS use a clear placeholder wrapped in square brackets, e.g. "Include real metrics such as [reduced API latency by X%] to showcase real-world impact" or "Add relevant keyword [insert framework/technology here] if it matches your actual experience."
6. Focus on REFRAMING and REPHRASING existing content to make it more impactful, ATS-friendly, and aligned with startup expectations (initiative, ownership, real-world impact, skill depth, quantified results)
7. Provide general improvements that would make this resume stronger for technical roles at startups

TASK:
Analyze this resume and suggest 5-7 general improvements that:

1. **Add Quantifiable Impact (with real metrics)**: Convert vague statements into specific, measurable results from their actual work.
   - If metrics are missing, suggest something like: "Include real metrics such as [reduced API response time by X%] to showcase real-world impact at this company/role."
   - Never invent or guess numbers; keep any variable parts the candidate must fill in inside square brackets [like this].

2. **Emphasize Initiative and Ownership**: Highlight where the candidate led, drove, or self-started work; surface scrappy, end-to-end execution common at startups.

3. **Show Real-World Impact and Scope**: Tie work to user, revenue, performance, or reliability outcomes; include scale where real (users, throughput, latency, uptime).

4. **Strengthen Action Verbs and Skill Depth**: Use strong verbs and clarify depth of skills already present (frameworks, databases, cloud, tooling) without adding new tech.

5. **Improve Clarity and Readability**: Make bullets concise, scannable, and front-load the most important info.

GOOD SUGGESTIONS:
- Candidate has: "Built web application with JavaScript"
  Suggestion: "Architected full-stack web application using React.js and Node.js, serving 5,000+ monthly active users with 99.9% uptime"
  ✓ Uses existing JavaScript experience
  ✓ Adds specificity (React, Node.js)
  ✓ Adds metrics (5,000+ users, 99.9% uptime)
  ✓ Uses stronger action verb (Architected)

- Candidate has: "Helped improve database queries"
  Suggestion: "Optimized PostgreSQL database queries, reducing average query time by 60% and improving application response time for 10,000+ daily transactions"
  ✓ Specifies database technology they likely used
  ✓ Adds quantifiable metrics
  ✓ Shows business impact
  ✓ Stronger verb (Optimized vs Helped)

BAD SUGGESTIONS:
- Candidate has: "Built Python backend API"
  Suggestion: "Deployed microservices on Kubernetes with auto-scaling and service mesh"
  ✗ Adds Kubernetes/cloud experience candidate doesn't have
  ✗ Changes the nature of their work
  ✗ Better to enhance what they actually did with the Python API

CRITICAL REQUIREMENTS:
- Each suggestion MUST include the exact JSONPath to the field being modified
- Each suggestion MUST include the exact original value from the structured data
- Each suggestion MUST include the new improved value
- The "reason" field MUST be exactly ONE sentence (max 15 words) summarizing what needs improvement - keep it brief and actionable
- Use JSONPath notation: "experience[0].description[1]" for arrays, "personal.name" for objects
- For array items, use bracket notation: "skills[2]", "experience[0].description[0]"
- For object properties, use dot notation: "personal.email", "summary"

PATH EXAMPLES:
- Experience bullet: "experience[0].description[0]" (first experience, first bullet)
- Project description: "projects[1].description[2]" (second project, third bullet)
- Skill: "skills[3]" (fourth skill in array)
- Education degree: "education[0].degree"
- Education major: "education[0].major"
- Education minor: "education[0].minor"
- Relevant course: "education[0].relevantCourses[0]" (first course)
- Summary: "summary"
- Personal info: "personal.name", "personal.email"

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "suggestions": [
    {
      "type": "edit",
      "path": "experience[0].description[1]",
      "oldValue": "exact original text/value from the structured data",
      "newValue": "improved version with stronger verbs and metrics",
      "reason": "ONE concise sentence (max 15 words) summarizing what needs improvement (e.g., 'Add quantifiable metrics to showcase impact' or 'Use stronger action verb to emphasize leadership'). Keep it brief and actionable.",
      "section": "Experience"
    }
  ]
}

Focus on the most impactful changes that would make the biggest difference to this candidate's resume.`;

  try {
    // Upload file to Gemini File API
    const uploadResult = await fileManager.uploadFile(resumeBuffer, {
      mimeType: resumeMimeType,
      displayName: resumeFileName,
    });

    // Wait for processing
    let fileMetadata = uploadResult.file;
    let attempts = 0;
    while (fileMetadata.state === 'PROCESSING' && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fileMetadata = await fileManager.getFile(uploadResult.file.name);
      attempts++;
    }

    if (fileMetadata.state === 'FAILED') {
      throw new Error('File processing failed');
    }

    // Generate suggestions with Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });

    // Generate suggestions without retry logic to reduce API costs
    // If rate limited, fail fast and let the user know to try again later
    const result = await model.generateContent([
      { text: prompt },
      {
        fileData: {
          fileUri: fileMetadata.uri,
          mimeType: fileMetadata.mimeType,
        },
      },
    ]);

    // Clean up
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (error) {
      console.warn('Failed to delete uploaded file:', error);
    }

    // Parse response
    const responseText = result.response.text();
    const cleanedResponse = cleanJsonResponse(responseText);
    const parsed = parseJsonSafely<{ suggestions: any[] }>(cleanedResponse, 'AI response');

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid response format: missing suggestions array');
    }

    // Convert AI response to patches and legacy format
    const timestamp = Date.now();
    return parsed.suggestions.map((suggestion: any, index: number) => {
      const id = `suggestion-${timestamp}-${index}`;

      // Create patch object
      const patch: ResumePatch = {
        id,
        type: suggestion.type || 'edit',
        path: suggestion.path || '',
        oldValue: suggestion.oldValue,
        newValue: suggestion.newValue,
        reason: suggestion.reason || '',
        section: suggestion.section || 'General',
      };

      // Return both patch and legacy format for backward compatibility
      return {
        id,
        section: patch.section || 'General',
        original: typeof patch.oldValue === 'string' ? patch.oldValue : JSON.stringify(patch.oldValue),
        suggested: typeof patch.newValue === 'string' ? patch.newValue : JSON.stringify(patch.newValue),
        reason: patch.reason,
        patch,
      };
    });
  } catch (error) {
    console.error('Error generating resume suggestions:', error);
    throw error;
  }
}

// Simple in-memory cache for suggestions
const suggestionCache = new Map<string, { suggestions: ResumeSuggestion[], timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function POST(request: NextRequest) {
  try {
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
              // Cookie setting might fail in route handlers
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { resumeId } = body;

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Missing resumeId in request body' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `general-${user.email}-${resumeId}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Returning cached suggestions for', cacheKey);
      return NextResponse.json({
        success: true,
        suggestions: cached.suggestions,
        cached: true,
      });
    }

    // Get service role client for storage access
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Fetch candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    // Get the specific resume (exclude large fields to reduce egress)
    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('id, candidate_id, name, file_name, resume_path, structured_data, is_active, is_primary, created_at, updated_at')
      .eq('id', resumeId)
      .eq('candidate_id', candidate.id)
      .single();

    if (resumeError || !resume || !resume.resume_path) {
      return NextResponse.json(
        { error: 'Resume not found or access denied' },
        { status: 404 }
      );
    }

    // Download resume from Supabase Storage
    const { data: resumeData, error: downloadError } = await supabaseAdmin.storage
      .from('resumes')
      .download(resume.resume_path);

    if (downloadError || !resumeData) {
      console.error('Failed to download resume:', downloadError);
      return NextResponse.json(
        { error: 'Failed to retrieve resume file' },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await resumeData.arrayBuffer();
    const resumeBuffer = Buffer.from(arrayBuffer);

    // Determine MIME type from file extension
    const fileExt = resume.resume_path.split('.').pop()?.toLowerCase();
    const mimeType = fileExt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Get structured resume data - prefer per-resume structured_data, fall back to candidate-level legacy field
    const structuredResumeData = (resume.structured_data ||
      (candidate as any).structured_resume_data ||
      null) as StructuredResumeData | null;

    // Generate general suggestions
    const suggestions = await generateGeneralResumeSuggestions(
      resumeBuffer,
      mimeType,
      resume.resume_path,
      structuredResumeData
    );

    // Cache the suggestions
    suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error in resume-suggestions-general API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate resume suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
