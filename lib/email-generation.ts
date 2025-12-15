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

export type EmailPersona = 'direct-ask' | 'genuine-fan';

export interface EmailGenerationOptions {
  persona?: EmailPersona; // Which persona to use for email generation
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

**Value Proposition Through Connection:**
Every qualification you mention MUST explicitly connect to the company. Don't just list skills - explain WHY those skills matter to THIS company specifically. The founder should immediately see the relevance.

BAD (generic, no connection):
"I have experience implementing AI/ML models using Python, Pytorch, and NumPy."

GOOD (explicit connection):
"I built a data pipeline at [Previous Company] that's similar to the analytics infrastructure Keystone is building for healthcare providers."

The difference: The good version shows the candidate understands what the company does and has directly relevant experience. The bad version lists skills that could apply to any tech company.

### THE RULES

**Subject Line:**
- State exactly what you want in 3-6 words
- Examples that work: "Summer internship at [Company]?" / "ML intern - UCSD student" / "[Company] internship inquiry"
- What NOT to do: Clever tricks, fake internal memos, clickbait

**The Email Structure:**
1. ONE sentence: Who you are + what you want
2. ONE-TWO sentences explaining your relevant experience WITH AN EXPLICIT CONNECTION to the company
   - Don't just list skills - explain how your experience relates to what THIS company does
   - Reference the company's product, mission, industry, or tech stack specifically
   - Show you understand their work and have done something similar or relevant
   - Bullet points are OPTIONAL - use them only if it improves readability
   - Keep it concise (1-2 sentences or 2-3 short bullets max)
3. ONE sentence: The ask
4. Professional links: Include relevant links (resume, GitHub, portfolio, LinkedIn) after your signature
   - Format: "Resume: [link]" or "GitHub: [link]" on separate lines
   - Only include links that are available in the candidate's profile

**Formatting Requirements:**
- Bullet points are OPTIONAL - use prose or bullets, whichever fits the content better
- Keep qualifications concise and scannable
- Include professional links at the end after your signature (e.g., "Best, [Name]")
- Only include links that are available in the candidate's profile

That's it. Keep it short and make every sentence count.

**What to INCLUDE:**
- Your name and school/background in the first sentence
- At least ONE experience that EXPLICITLY connects to the company's work, product, industry, or mission
- Reference what the company does and explain how your experience is relevant to THAT specifically
- A concrete ask with a clear next step
- Professional links (resume, GitHub, portfolio, LinkedIn) at the end after your signature

**What to NEVER include:**
- GENERIC skill lists without connection to the company (e.g., "I have experience with Python, Pytorch, and NumPy" - this tells them nothing about WHY it matters to THEM)
- Qualifications that could apply to any company - if you could send the same sentence to 100 different startups, it's too generic
- Explicit value proposition statements ("I can help you...", "My value is...")
- Compliments about the company ("I love what you're doing...")
- Explanations of why you're emailing ("I'm reaching out because...")
- Questions that put work on them ("What roles do you have open?")
- Long paragraphs - keep it scannable

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

/**
 * Builds the email generation prompt using Persona 2: "The Genuine Fan"
 */
function buildGenuineFanPrompt(
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
Behind every startup is a founder who cares deeply about a problem. The best cold emails don't just ask for a job - they show that you genuinely give a damn about the same thing they do.

This isn't about sucking up. It's about authentic connection. If you've actually used their product, actually care about the problem they're solving, or have a genuine story about why THIS company matters to you - that beats a perfect resume every time.

Tristan Walker emailed FourSquare eight times. He got the job because his enthusiasm was obvious and real: "I can assure you I'm humble and I'm hungry!"

### THE RULES

**Subject Line:**
- Personal and specific to them, not generic
- Can reference something they did, said, or built
- Examples: "Your YC demo blew my mind" / "Question about [specific feature]" / "Fellow [shared interest] here"

**The Email Structure:**
1. Open with YOUR story - why you specifically care about what they're building
2. Connect your experience to their mission (not just "I have skills")
3. Show you've actually engaged with their work (used the product, read their posts, etc.)
4. Make the ask feel natural, not transactional

**Length Requirement:**
- Keep the email body to approximately 60 words total
- Be concise but authentic - every word should serve the connection
- Quality over quantity - a short, genuine email beats a long one

**The "Genuine Test":**
Before generating, ask: Could this email ONLY be sent to this specific company? If you could swap out the company name and send it elsewhere, it's not genuine enough.

**What makes this persona different:**
- Lead with emotion and story, not credentials
- It's okay to be a little vulnerable ("I'm not from a CS background, but...")
- Your enthusiasm should be specific, not generic ("I love your company" = bad, "I've been using [feature] since [time] and it changed how I [specific thing]" = good)
- Let personality come through

**Tone:**
- Warm and human
- Enthusiastic but not desperate
- Conversational, like you're writing to a person you respect
- It's okay to be informal if it's authentic to you

### NAMING RULES
- First name only (this persona is personal): "Hi Alex,"
- Exception: Keep "Dr." or "Prof." if present

### DATA INPUTS

**CANDIDATE:**
- Name: ${candidate.name}
- Email: ${candidate.email}
- Summary: ${candidate.summary}
- Skills: ${candidate.skills.join(', ')}
- Education: ${candidate.educationLevel || 'Not specified'}${candidate.university ? ` at ${candidate.university}` : ''}
- Past Experience: ${candidate.pastInternships || 'None listed'}
- Projects: ${candidate.technicalProjects || 'None listed'}
- Links: ${linksText}
- Resume Context: ${candidate.resumeFullText || 'Not provided'}

**STARTUP:**
- Name: ${startup.name}
- Founder: ${rawFounderName}
- Industry: ${startup.industry || 'Not specified'}
- Description: ${startup.description || 'N/A'}
- Recent News/Intel: ${scrapedIntel}
- What they do: ${startup.description || 'N/A'}

**IMPORTANT:** Use the scraped intel to find something SPECIFIC to reference. If there's nothing specific, invent a plausible detail about why the candidate would care about this company based on their background. The connection must feel real.

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

  // Select prompt based on persona (default to 'direct-ask')
  const persona = options.persona || 'direct-ask';
  const prompt = persona === 'genuine-fan' 
    ? buildGenuineFanPrompt(candidate, startup, match)
    : buildEmailPrompt(candidate, startup, match);

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

  // Select prompt based on persona (default to 'direct-ask')
  const persona = options.persona || 'direct-ask';
  const prompt = persona === 'genuine-fan' 
    ? buildGenuineFanPrompt(candidate, startup, match)
    : buildEmailPrompt(candidate, startup, match);

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
