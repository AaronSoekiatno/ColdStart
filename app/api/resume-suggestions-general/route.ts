import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getCandidate } from '@/lib/supabase';
import type { ResumePatch } from '@/types/resume-patch';
import type { StructuredResumeData } from '@/types/resume';

export const runtime = 'nodejs';

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
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

  const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer and career coach.

${structuredDataContext}

CRITICAL RULES:
1. ONLY suggest improvements using technologies, skills, and experiences that ALREADY EXIST in the candidate's resume
2. DO NOT add skills, technologies, or experiences the candidate doesn't have
3. DO NOT fabricate achievements or metrics
4. Focus on REFRAMING and REPHRASING existing content to make it more impactful and ATS-friendly
5. Provide general improvements that would make this resume stronger for any technical/professional role

TASK:
Analyze this resume and suggest 5-7 general improvements that:

1. **Add Quantifiable Impact**: Convert vague statements into specific, measurable results
   - Add percentages, numbers, scale metrics from their actual work
   - Example: "Improved performance" → "Reduced API response time by 40%, handling 10k requests/sec"
   - Only use metrics that could reasonably be inferred or should be added from their actual work

2. **Strengthen Action Verbs**: Replace weak verbs with stronger, more impactful ones
   - "Worked on" → "Architected", "Engineered", "Designed", "Led"
   - "Helped with" → "Collaborated on", "Contributed to", "Facilitated"
   - Keep the same meaning, just make it more powerful

3. **Add Technical Specificity**: Make technology mentions more specific and detailed
   - If they mention "JavaScript" and built web apps → specify frameworks they likely used
   - If they mention "databases" → specify the actual database technology
   - ONLY if the technology is already mentioned or clearly implied in their resume

4. **Highlight Leadership and Impact**: Emphasize ownership, initiative, and results
   - Add context about team size if they worked with others
   - Emphasize outcomes and business impact
   - Show scope and scale of their work

5. **Improve Clarity and Readability**: Make descriptions clearer and more concise
   - Remove jargon that doesn't add value
   - Make bullet points more scannable
   - Front-load the most important information

6. **Optimize for ATS Keywords**: Ensure important technical skills and concepts are mentioned
   - Make sure key technologies are spelled out (not just acronyms)
   - Add industry-standard terminology where appropriate
   - Only use keywords that align with their actual experience

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
      "newValue": "improved version with stronger verbs, metrics, and ATS keywords",
      "reason": "brief explanation of why this helps (e.g., 'adds quantifiable metrics and stronger action verb')",
      "keywords": ["keyword1", "keyword2"],
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
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });

    // Retry logic with exponential backoff for rate limits
    let result;
    let retries = 5;
    let delay = 2000;

    for (let i = 0; i < retries; i++) {
      try {
        result = await model.generateContent([
          { text: prompt },
          {
            fileData: {
              fileUri: fileMetadata.uri,
              mimeType: fileMetadata.mimeType,
            },
          },
        ]);
        break;
      } catch (error: any) {
        if (error?.status === 429 && i < retries - 1) {
          console.log(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error('Failed to generate content after retries');
    }

    // Clean up
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (error) {
      console.warn('Failed to delete uploaded file:', error);
    }

    // Parse response
    const responseText = result.response.text();
    console.log('Gemini response:', responseText);

    // Clean markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(cleanedResponse);

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
        keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords : [],
        section: suggestion.section || 'General',
      };

      // Return both patch and legacy format for backward compatibility
      return {
        id,
        section: patch.section,
        original: typeof patch.oldValue === 'string' ? patch.oldValue : JSON.stringify(patch.oldValue),
        suggested: typeof patch.newValue === 'string' ? patch.newValue : JSON.stringify(patch.newValue),
        reason: patch.reason,
        keywords: patch.keywords || [],
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

    // Get the specific resume
    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('*')
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

    // Get structured resume data
    const structuredResumeData = (resume.structured_data || candidate.structured_resume_data) as StructuredResumeData | null;

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
