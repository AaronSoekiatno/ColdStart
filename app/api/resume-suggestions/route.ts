import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getStartup, getCandidate } from '@/lib/supabase';
import type { ResumePatch } from '@/types/resume-patch';
import type { StructuredResumeData } from '@/types/resume';
import { getCandidate, getPrimaryResumeForCandidate } from '@/lib/supabase';

export const runtime = 'nodejs';

// Legacy interface for backward compatibility during migration
interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
  // New patch-based fields
  patch?: ResumePatch;
}

/**
 * Generates ATS-optimized resume suggestions using Gemini
 * Returns patches with explicit JSONPath locations
 */
async function generateResumeSuggestionsWithGemini(
  resumeBuffer: Buffer,
  resumeMimeType: string,
  resumeFileName: string,
  structuredResumeData: StructuredResumeData | null,
  startupInfo: {
    name: string;
    industry: string;
    keywords: string;
    description: string;
    business_type?: string;
    hiring_roles?: string;
    team_size?: string;
    job_openings?: string;
  }
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

  // Build rich startup context from available fields
  const startupContext = `
STARTUP CONTEXT:
Company: ${startupInfo.name}
Industry: ${startupInfo.industry}
What They Build: ${startupInfo.description || 'Not specified'}
${startupInfo.business_type ? `Business Model: ${startupInfo.business_type}` : ''}
${startupInfo.team_size ? `Team Size: ${startupInfo.team_size}` : ''}
${startupInfo.keywords ? `Focus Areas: ${startupInfo.keywords} (use for high-level alignment only, not for adding skills)` : ''}

INSTRUCTIONS:
- Extract technical themes from "What They Build" to understand what experience to emphasize
- Use industry to determine appropriate terminology and framing
- Use focus areas only to understand priorities, NOT to add skills the candidate doesn't have
`.trim();

  const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer.

${startupContext}${structuredDataContext}

CRITICAL RULES:
1. ONLY suggest improvements using technologies, skills, and experiences that ALREADY EXIST in the candidate's resume
2. DO NOT add skills, technologies, or experiences the candidate doesn't have
3. DO NOT fabricate achievements or metrics
4. Focus on REFRAMING and REPHRASING existing content to better align with the startup
5. If the candidate lacks relevant experience for this startup, suggest fewer or no changes rather than inventing experience

TASK:
Based on the startup's description and industry, analyze this resume and suggest 3-5 improvements that:

1. **Reframe Existing Experience**: Highlight aspects of the candidate's actual experience that align with what this startup builds
   - If startup builds AI tools → emphasize any ML/data work from resume
   - If startup is B2B SaaS → emphasize scalability, enterprise features
   - If startup is early-stage → emphasize scrappy, full-stack, ownership examples
   - Use terminology from the startup's description

2. **Add Measurable Impact**: Convert vague statements into specific, quantifiable results
   - Add percentages, numbers, scale metrics from their actual work
   - Example: "Improved performance" → "Reduced API response time by 40%, handling 10k requests/sec"
   - Only use metrics that could reasonably be inferred or should be added from their actual work

3. **Specify Technologies**: Make technology mentions more specific where the candidate already uses them
   - If they mention "JavaScript" and built web apps → specify "React.js" if that's what they likely used
   - If they mention "databases" → specify "PostgreSQL" or whatever they actually used
   - ONLY if the technology is already mentioned or clearly implied in their resume

4. **Industry-Specific Terminology**: Use domain language matching the startup's industry
   - Healthcare startup → emphasize "compliance", "patient data", "HIPAA" if relevant to their work
   - FinTech → emphasize "security", "transactions", "regulatory" if relevant
   - Only apply if the candidate has relevant experience

GOOD SUGGESTIONS:
- Candidate has: "Built web application with JavaScript"
  Startup builds: "React-based dashboard tools"
  Suggestion: "Architected React.js web application with TypeScript, implementing 15+ dashboard components and real-time data visualization"
  ✓ Uses existing JavaScript experience
  ✓ Adds specificity (React, TypeScript)
  ✓ Adds metrics (15+ components)
  ✓ Aligns with startup's focus on dashboards

BAD SUGGESTIONS:
- Candidate has: "Built Python backend API"
  Startup builds: "Kubernetes-based infrastructure"
  Suggestion: "Deployed microservices on Kubernetes with auto-scaling"
  ✗ Adds Kubernetes experience candidate doesn't have
  ✗ Better to emphasize their actual Python API work instead

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
      "newValue": "improved version with ATS keywords and quantifiable metrics",
      "reason": "brief explanation of why this helps (mention specific keywords added)",
      "keywords": ["keyword1", "keyword2"],
      "section": "Experience"
    }
  ]
}

PATH EXAMPLES:
- Experience bullet: "experience[0].description[0]" (first experience, first bullet)
- Project description: "projects[1].description[2]" (second project, third bullet)
- Skill: "skills[3]" (fourth skill in array)
- Summary: "summary"
- Personal info: "personal.name", "personal.email"

If the resume is already well-optimized, return fewer suggestions or an empty array.`;

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

    // Generate suggestions with Gemini 2.0 Flash (latest stable model)
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
    let retries = 5; // Increased from 3 to 5 attempts
    let delay = 2000; // Start with 2 seconds (increased from 1s)

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
        break; // Success, exit loop
      } catch (error: any) {
        if (error?.status === 429 && i < retries - 1) {
          console.log(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error; // Re-throw if not rate limit or out of retries
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
        patch, // Include the patch object
      };
    });
  } catch (error) {
    console.error('Error generating resume suggestions:', error);
    throw error;
  }
}

// Simple in-memory cache for suggestions (resets on server restart)
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
    const { startupId } = body;

    if (!startupId) {
      return NextResponse.json(
        { error: 'Missing startupId in request body' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${user.email}-${startupId}`;
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

    // Fetch candidate info including structured resume data
    const candidate = await getCandidate(user.email);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    // Get primary/current resume
    const resume = await getPrimaryResumeForCandidate(candidate.id);

    if (!resume || !resume.resume_path) {
      return NextResponse.json(
        { error: 'No resume file found. Please upload your resume again.' },
        { status: 404 }
      );
    }

    // Fetch startup info using the same method as the preview endpoint
    const startup = await getStartup(startupId);

    if (!startup) {
      console.error('Startup lookup error:', {
        startupId,
        message: 'Startup not found in database'
      });
      return NextResponse.json(
        { error: `Startup not found. Searched for ID: ${startupId}` },
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

    // Get structured resume data for AI context
    const structuredResumeData = candidate.structured_resume_data as StructuredResumeData | null;

    // Generate suggestions using Gemini with rich startup context
    const suggestions = await generateResumeSuggestionsWithGemini(
      resumeBuffer,
      mimeType,
      resume.resume_path,
      structuredResumeData,
      {
        name: startup.name,
        industry: startup.industry || '',
        keywords: startup.keywords || '',
        description: startup.description || '',
        business_type: startup.business_type,
        hiring_roles: startup.hiring_roles,
        team_size: startup.team_size,
        job_openings: startup.job_openings,
      }
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
    console.error('Error in resume-suggestions API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate resume suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
