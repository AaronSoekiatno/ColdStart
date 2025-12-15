/**
 * Parses resume text into structured data using Gemini AI
 * 
 * IMPORTANT: This is a LOSSLESS NORMALIZATION step.
 * - Extracts content exactly as written (no rewriting, no improvements)
 * - Structures the data for template-based editing
 * - Preserves user's original wording, style, and meaning
 * - Zero editorial judgment - just parsing and structuring
 * 
 * This builds trust by showing users their exact content in a cleaner format
 * before any AI suggestions are applied.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StructuredResumeData } from '@/types/resume';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Parses resume text into structured data
 * 
 * This function performs lossless extraction - it structures the resume
 * without making any editorial changes or improvements.
 */
export async function parseResumeToStructured(
  resumeText: string
): Promise<StructuredResumeData> {
  // Use low temperature for deterministic, exact extraction (no creativity, no rewriting)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1, // Very low temperature for exact extraction, minimal rewriting
      topK: 1, // Most deterministic token selection
    },
  });

  const prompt = `You are a resume parser. Your ONLY job is to extract information from the resume text and structure it into JSON.

CRITICAL RULES - READ CAREFULLY:
1. EXTRACT EXACTLY AS WRITTEN - Do NOT rewrite, improve, or change any wording
2. PRESERVE ORIGINAL LANGUAGE - Keep the user's exact words, phrases, and style
3. NO EDITORIAL JUDGMENT - Do NOT fix grammar, improve clarity, or add missing words
4. NO IMPROVEMENTS - This is a normalization step, not an optimization step
5. EXACT EXTRACTION ONLY - Copy text verbatim from the resume

Resume Text:
${resumeText}

Return a JSON object with this exact structure:
{
  "personal": {
    "name": "Full Name (exact as written)",
    "email": "email@example.com (exact as written)",
    "phone": "phone number if available (exact as written)",
    "location": "City, State if available (exact as written)",
    "website": "website if available (exact as written)",
    "linkedin": "linkedin URL if available (exact as written)",
    "github": "github URL if available (exact as written)"
  },
  "summary": "Professional summary or objective if present (EXACT TEXT, no rewriting)",
  "experience": [
    {
      "id": "exp-0",
      "title": "Job Title (exact as written)",
      "company": "Company Name (exact as written)",
      "location": "City, State if available (exact as written)",
      "startDate": "Month Year (exact as written)",
      "endDate": "Month Year or 'Present' if currently employed, otherwise OMIT this field if end date is not specified",
      "description": ["bullet point 1 (EXACT TEXT)", "bullet point 2 (EXACT TEXT)"]
    }
  ],
  "education": [
    {
      "id": "edu-0",
      "degree": "Degree level only (e.g., 'B.S.', 'M.S.', 'Ph.D.', 'B.A.')",
      "major": "Major field of study if specified (e.g., 'Computer Science', 'Mechanical Engineering')",
      "minor": "Minor field of study if specified (e.g., 'Mathematics', 'Business')",
      "school": "School Name (exact as written)",
      "location": "City, State if available (exact as written)",
      "graduationDate": "Month Year if available (exact as written)",
      "gpa": "GPA if available (exact as written)",
      "honors": "Honors if available (exact as written)",
      "relevantCourses": ["Course 1", "Course 2"] // Array of course names if listed, otherwise omit this field
    }
  ],
  "projects": [
    {
      "id": "proj-0",
      "name": "Project Name (exact as written)",
      "description": ["bullet point 1 (EXACT TEXT)", "bullet point 2 (EXACT TEXT)"],
      "technologies": ["tech1 (exact as written)", "tech2 (exact as written)"],
      "link": "URL if available (exact as written)"
    }
  ],
  "skills": ["skill1 (exact as written)", "skill2 (exact as written)", "skill3 (exact as written)"],
  "certifications": ["cert1 (exact as written)", "cert2 (exact as written)"] if available
}

EXTRACTION RULES:
- Extract ALL information from the resume
- For experience and education, create unique IDs (use index-based like "exp-0", "edu-0", "proj-0")
- Include all bullet points in experience descriptions as an array (preserve exact wording)
- For projects, extract description as an array of bullet points (split by newlines or bullet characters, preserve exact wording)
- If a field is not present, omit it (don't use null or empty strings)
- For endDate: Use 'Present' for current positions, or OMIT THE FIELD ENTIRELY if no end date is specified (do not use empty strings)
- PRESERVE EXACT WORDING - Do not paraphrase, summarize, or improve any text
- PRESERVE EXACT FORMATTING - Keep dates, locations, and other details exactly as written
- Return ONLY valid JSON, no markdown or extra text

Remember: This is a LOSSLESS NORMALIZATION. Extract exactly, structure it, but DO NOT change the content.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/```$/, '');
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/```$/, '');
    }

    const parsed = JSON.parse(jsonText) as StructuredResumeData;

    // Validate and ensure required fields
    if (!parsed.personal || !parsed.personal.name || !parsed.personal.email) {
      throw new Error('Failed to extract required personal information');
    }

    return {
      personal: parsed.personal,
      summary: parsed.summary || '',
      experience: parsed.experience || [],
      education: parsed.education || [],
      projects: parsed.projects || [],
      skills: parsed.skills || [],
      certifications: parsed.certifications || [],
    };
  } catch (error) {
    console.error('Error parsing resume:', error);
    throw new Error('Failed to parse resume into structured format');
  }
}

