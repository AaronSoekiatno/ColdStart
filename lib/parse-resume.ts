/**
 * Parses resume text into structured data using Gemini AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StructuredResumeData } from '@/types/resume';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Parses resume text into structured data
 */
export async function parseResumeToStructured(
  resumeText: string
): Promise<StructuredResumeData> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Parse the following resume text into structured JSON format. Extract all information accurately.

Resume Text:
${resumeText}

Return a JSON object with this exact structure:
{
  "personal": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number if available",
    "location": "City, State if available",
    "website": "website if available",
    "linkedin": "linkedin URL if available",
    "github": "github URL if available"
  },
  "summary": "Professional summary or objective if present",
  "experience": [
    {
      "id": "unique-id-1",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State if available",
      "startDate": "Month Year",
      "endDate": "Month Year or 'Present'",
      "description": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "id": "unique-id-1",
      "degree": "Degree Name",
      "school": "School Name",
      "location": "City, State if available",
      "graduationDate": "Month Year if available",
      "gpa": "GPA if available",
      "honors": "Honors if available"
    }
  ],
  "projects": [
    {
      "id": "unique-id-1",
      "name": "Project Name",
      "description": ["bullet point 1", "bullet point 2"],
      "technologies": ["tech1", "tech2"],
      "link": "URL if available"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": ["cert1", "cert2"] if available
}

Important:
- Extract ALL information from the resume
- For experience and education, create unique IDs (use index-based like "exp-0", "edu-0")
- Include all bullet points in experience descriptions as an array
- For projects, extract description as an array of bullet points (split by newlines or bullet characters)
- If a field is not present, omit it (don't use null)
- Return ONLY valid JSON, no markdown or extra text`;

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

