import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory cache for ATS scores
const atsScoreCache = new Map<string, {
  score: ATSScoreResult;
  timestamp: number;
}>();

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface ATSScoreResult {
  score: number;
  category: 'Excellent' | 'Good' | 'Needs Work';
  breakdown: {
    keywords: number;
    structure: number;
    content: number;
    formatting: number;
  };
  suggestions: string[];
}

interface ATSScoreRequest {
  resumeText: string;
  structuredData?: any;
  resumeId?: string;
}

function getScoreCategory(score: number): 'Excellent' | 'Good' | 'Needs Work' {
  if (score >= 92) return 'Excellent';
  if (score >= 80) return 'Good';
  return 'Needs Work';
}

function calculateWeightedScore(breakdown: {
  keywords: number;
  structure: number;
  content: number;
  formatting: number;
}): number {
  // Weighted average:
  // Keywords: 35%, Structure: 25%, Content: 25%, Formatting: 15%
  const weighted =
    (breakdown.keywords * 0.35) +
    (breakdown.structure * 0.25) +
    (breakdown.content * 0.25) +
    (breakdown.formatting * 0.15);

  return Math.round(weighted);
}

export async function POST(request: NextRequest) {
  try {
    const body: ATSScoreRequest = await request.json();
    const { resumeText, structuredData, resumeId } = body;

    if (!resumeText) {
      return NextResponse.json(
        { error: 'Resume text is required' },
        { status: 400 }
      );
    }

    // Check cache if resumeId is provided
    if (resumeId) {
      const cacheKey = `ats-score-${resumeId}`;
      const cached = atsScoreCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log('[ATS Score] Returning cached score for', resumeId);
        return NextResponse.json(cached.score);
      }
    }

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    // Create the prompt for ATS scoring
    const prompt = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze this resume for ATS compatibility and score it across 4 categories.

Score each category from 0-100 based on these criteria:

**1. Keywords & Action Verbs (35% weight)**:
- Count of strong action verbs (Led, Developed, Managed, Implemented, Achieved, Created, Designed, etc.)
- Presence of industry-specific keywords
- Technical skills explicitly mentioned
- Quantifiable metrics and numbers (%, $, #, time saved, revenue generated)
- Score 90-100: 15+ action verbs, rich keywords, many quantified achievements
- Score 70-89: 8-14 action verbs, moderate keywords, some metrics
- Score 50-69: 4-7 action verbs, basic keywords, few metrics
- Score <50: Minimal action verbs, generic language, no metrics

**2. Structure (25% weight)**:
- Clear section headers (Experience, Education, Skills, Summary)
- Consistent formatting throughout
- Appropriate resume length (1-2 pages)
- Complete contact information
- Professional summary/objective present
- Score 90-100: Perfect structure, all sections present, excellent organization
- Score 70-89: Good structure, minor inconsistencies
- Score 50-69: Acceptable structure, missing some sections
- Score <50: Poor structure, inconsistent, missing key sections

**3. Content Quality (25% weight)**:
- Achievements quantified with specific numbers/metrics
- Results-oriented language (outcomes, not just responsibilities)
- Professional language and tone
- No spelling or grammar errors
- Specific examples showing impact
- Score 90-100: All achievements quantified, strong impact statements, flawless language
- Score 70-89: Most achievements quantified, good examples, few errors
- Score 50-69: Some quantification, moderate examples, some errors
- Score <50: Mostly responsibilities, vague, multiple errors

**4. ATS-Friendly Formatting (15% weight)**:
- Standard fonts and formatting (not overly stylized)
- No complex tables, text boxes, or graphics
- Proper date formatting
- Clear hierarchy and readable structure
- Standard section names ATS systems recognize
- Score 90-100: Perfect ATS compatibility, standard formatting
- Score 70-89: Good compatibility, minor formatting quirks
- Score 50-69: Acceptable, some ATS-unfriendly elements
- Score <50: Poor compatibility, many parsing issues

**Resume to analyze:**
${resumeText}

**Instructions:**
1. Analyze the resume carefully against all criteria above
2. Provide a score (0-100) for each of the 4 categories
3. Generate 2-3 specific, actionable suggestions for improvement
4. Focus suggestions on the lowest-scoring areas

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "keywords": <score 0-100>,
  "structure": <score 0-100>,
  "content": <score 0-100>,
  "formatting": <score 0-100>,
  "suggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2",
    "Specific suggestion 3"
  ]
}`;

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('[ATS Score] Gemini raw response:', responseText);

    // Parse JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[ATS Score] Failed to parse Gemini response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate response structure
    if (
      typeof parsedResponse.keywords !== 'number' ||
      typeof parsedResponse.structure !== 'number' ||
      typeof parsedResponse.content !== 'number' ||
      typeof parsedResponse.formatting !== 'number' ||
      !Array.isArray(parsedResponse.suggestions)
    ) {
      console.error('[ATS Score] Invalid response structure:', parsedResponse);
      return NextResponse.json(
        { error: 'Invalid AI response structure' },
        { status: 500 }
      );
    }

    // Calculate weighted score
    const breakdown = {
      keywords: Math.min(100, Math.max(0, parsedResponse.keywords)),
      structure: Math.min(100, Math.max(0, parsedResponse.structure)),
      content: Math.min(100, Math.max(0, parsedResponse.content)),
      formatting: Math.min(100, Math.max(0, parsedResponse.formatting)),
    };

    const finalScore = calculateWeightedScore(breakdown);
    const category = getScoreCategory(finalScore);

    const scoreResult: ATSScoreResult = {
      score: finalScore,
      category,
      breakdown,
      suggestions: parsedResponse.suggestions.slice(0, 3), // Top 3 suggestions
    };

    // Cache the result if resumeId is provided
    if (resumeId) {
      const cacheKey = `ats-score-${resumeId}`;
      atsScoreCache.set(cacheKey, {
        score: scoreResult,
        timestamp: Date.now(),
      });
      console.log('[ATS Score] Cached score for', resumeId);
    }

    return NextResponse.json(scoreResult);

  } catch (error) {
    console.error('[ATS Score] Error calculating score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate ATS score' },
      { status: 500 }
    );
  }
}
