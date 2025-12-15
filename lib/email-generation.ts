import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Shared Gemini email generation utilities.
 *
 * This module is intentionally standalone so it can be reused from:
 * - API routes (e.g. /api/generate-email)
 * - background jobs / scripts
 *
 * It assumes GEMINI_API_KEY is configured in the environment.
 */

// Default model - use Pro for higher quality email generation
// Can be overridden via GEMINI_EMAIL_MODEL environment variable if needed
const DEFAULT_EMAIL_MODEL = process.env.GEMINI_EMAIL_MODEL || 'gemini-2.5-pro';

// ---------- Types ----------

export interface CandidateProfile {
  name: string;
  email: string;
  summary: string;
  skills: string[]; // normalized list of skills/keywords
  resumeFullText?: string; // Full resume text for additional context (GitHub links, etc.)
  links?: Record<string, string>; // Links like GitHub, portfolio, etc.
  // Additional Supabase fields
  location?: string;
  educationLevel?: string;
  university?: string;
  pastInternships?: string; // Comma-separated string
  technicalProjects?: string; // Comma-separated string
}

export interface StartupInfo {
  name: string;
  industry?: string;
  description?: string;
  fundingStage?: string;
  fundingAmount?: string;
  location?: string;
  website?: string;
  tags?: string[];
  founderName?: string; // Full founder name (may include "Dr.", "Prof.", etc.)
  scrapedContext?: string; // Scraped intel/news about the startup
  // Additional Supabase fields
  batch?: string; // YC batch (e.g., "Summer 2025")
  jobOpenings?: string; // Available job openings
  founderEmails?: string; // Comma-separated founder emails
  founderLinkedIn?: string; // Comma-separated LinkedIn URLs
}

export interface MatchContext {
  score: number; // cosine similarity 0‑1
  rank?: number; // 1‑based rank among matches
  totalMatches?: number;
}

export type EmailTone =
  | 'professional'
  | 'classy'
  | 'informative'
  | 'ambitious'
  | 'conversational';

export interface EmailGenerationOptions {
  tone?: EmailTone;
  maxWords?: number; // soft limit; prompt hint only
  includeSubjectPrefix?: string; // e.g. "[ResumeSender]"
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  rawText: string; // full raw Gemini text (for debugging / logging)
}

// ---------- Internal helpers ----------

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
        'Add it to your .env.local file to enable email generation.'
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Strips Markdown code fences from a JSON‑ish response so we can parse it.
 * (Duplicated from the upload‑resume utils to keep this file self‑contained.)
 */
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Builds the email generation prompt using Persona 1: "The Direct Ask"
 */
function buildEmailPrompt(
  candidate: CandidateProfile,
  startup: StartupInfo,
  match: MatchContext
): string {
  const rawFounderName = startup.founderName || 'Founder';
  const linksText = candidate.links
    ? Object.entries(candidate.links)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : 'None';

  // Add Novaflow-specific context for testing
  let scrapedIntel = startup.scrapedContext || 'None available';
  if (startup.name.toLowerCase() === 'novaflow') {
    const novaflowContext = `Novaflow is the AI data analyst for biology labs. Bioinformatics data analysis is a time-consuming and expensive process for scientists. With Novaflow, life scientists can upload experimental data, ask questions in plain English, and get instant, publication-ready plots, giving them results in minutes instead of months. Researchers at leading institutions like UCSF, Mount Sinai, UC Berkeley, and Harvard are already using Novaflow in their labs.`;
    scrapedIntel =
      scrapedIntel !== 'None available'
        ? `${scrapedIntel}\n\n${novaflowContext}`
        : novaflowContext;
  }

  return `
You are writing a cold email for ${candidate.name} to ${rawFounderName} at ${startup.name}.

### YOUR PHILOSOPHY
Time is the scarcest resource for startup founders. Every word you write that doesn't directly serve the goal of getting an internship is a word that wastes their time and reduces your chances. 

The best cold emails are the ones that respect the reader enough to get to the point.

### THE RULES

**Subject Line:**
- State exactly what you want in 3-6 words
- Examples that work: "Summer internship at [Company]?" / "ML intern - UCSD student" / "[Company] internship inquiry"
- What NOT to do: Clever tricks, fake internal memos, clickbait

**The Email Structure:**
1. ONE sentence: Who you are + what you want
2. TWO-THREE sentences: Why you're qualified (specific, not generic)
3. ONE sentence: The ask

That's it. 4-5 sentences total. No more.

**What to INCLUDE:**
- Your name and school/background in the first sentence
- ONE specific technical skill or project that's relevant to THIS company
- A concrete ask with a clear next step

**What to NEVER include:**
- Compliments about the company ("I love what you're doing...")
- Explanations of why you're emailing ("I'm reaching out because...")
- Multiple projects or skills (pick ONE)
- Questions that put work on them ("What roles do you have open?")
- Anything that could be sent to any other company without editing

**Tone:**
- Confident but not arrogant
- Professional but not stiff
- Direct but not rude

### NAMING RULES
- If founder name has "Dr." or "Prof." → Use it: "Hi Dr. Smith,"
- Otherwise → First name only: "Hi Alex,"
- NEVER: "Dear Sir/Madam", "To whom it may concern", "Hi [Company] team"

### DATA INPUTS

**CANDIDATE:**
- Name: ${candidate.name}
- Email: ${candidate.email}
- Summary: ${candidate.summary}
- Skills: ${candidate.skills.join(', ')}
- Education: ${candidate.educationLevel || 'Not specified'}${candidate.university ? ` at ${candidate.university}` : ''}
- Links: ${linksText}
- Resume Context: ${candidate.resumeFullText || 'Not provided'}

**STARTUP:**
- Name: ${startup.name}
- Founder: ${rawFounderName}
- Industry: ${startup.industry || 'Not specified'}
- Description: ${startup.description || 'N/A'}
- Recent News/Intel: ${scrapedIntel}
- Tech Stack/Tags: ${startup.tags?.join(', ') || 'Not specified'}

### OUTPUT FORMAT
Return ONLY valid JSON:
{
  "subject": "Your subject line here",
  "body": "The complete email body"
}
`.trim();
}

// ---------- Public API ----------

/**
 * Generates a human‑sounding cold email for a candidate → startup match.
 *
 * This does NOT send any email. It only returns subject/body text which
 * the caller can review, surface in the UI, or send via another service.
 */
export async function generateColdEmail(
  candidate: CandidateProfile,
  startup: StartupInfo,
  match: MatchContext,
  options: EmailGenerationOptions = {}
): Promise<GeneratedEmail> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: DEFAULT_EMAIL_MODEL });

  const subjectPrefix = options.includeSubjectPrefix
    ? `[${options.includeSubjectPrefix}] `
    : '';

  const prompt = buildEmailPrompt(candidate, startup, match);

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const rawText = responseText;

  let subject = '';
  let body = '';

  try {
    const cleaned = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };

    if (typeof parsed.subject === 'string') {
      subject = parsed.subject.trim();
    }
    if (typeof parsed.body === 'string') {
      body = parsed.body.trim();
    }
  } catch (error) {
    // Fallback: treat the whole response as the body, and construct a subject.
    body = responseText.trim();
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (internship interest)`;
  }

  // Ensure subject has the requested prefix if provided.
  if (subjectPrefix && !subject.startsWith(subjectPrefix)) {
    subject = subjectPrefix + subject;
  }

  if (!subject) {
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (internship interest)`;
  }

  if (!body) {
    const fallbackFounderName = (startup.founderName || startup.name).split(
      ' '
    )[0]; // Use first name as fallback
    body = `Hi ${fallbackFounderName},\n\nMy name is ${candidate.name} and I'm interested in opportunities that align with my background in ${candidate.skills.join(
      ', '
    )}.\n\nWould you be open to a quick chat about this?\n\nBest,\n${candidate.name}`;
  }

  return {
    subject,
    body,
    rawText,
  };
}

/**
 * Generates a cold email with streaming support.
 * Returns an async generator that yields text chunks as they're generated.
 */
export async function* generateColdEmailStream(
  candidate: CandidateProfile,
  startup: StartupInfo,
  match: MatchContext,
  options: EmailGenerationOptions = {}
): AsyncGenerator<string, void, unknown> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: DEFAULT_EMAIL_MODEL });

  const prompt = buildEmailPrompt(candidate, startup, match);

  try {
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error('Error in streaming email generation:', error);
    throw error;
  }
}
