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

// Default model - use Flash for speed and to avoid rate limits, but allow override for Pro if needed
// Flash is sufficient for email generation and helps distribute API load
const DEFAULT_EMAIL_MODEL = process.env.GEMINI_EMAIL_MODEL || 'gemini-2.5-flash';

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

function toneToPromptSnippet(tone: EmailTone | undefined): string {
  switch (tone) {
    case 'professional':
      return 'Use a professional, polished tone appropriate for business communication while remaining approachable.';
    case 'classy':
      return 'Use an elegant, sophisticated tone that demonstrates refinement and respect for the recipient.';
    case 'informative':
      return 'Use a clear, informative tone that prioritizes conveying information effectively and directly.';
    case 'ambitious':
      return 'Use an ambitious, driven tone that shows enthusiasm and determination without being overly aggressive.';
    case 'conversational':
      return 'Use a conversational, human tone, like a thoughtful college student reaching out to a founder.';
    default:
      return 'Use a professional but casual tone, like a strong student writing a thoughtful cold email.';
  }
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

  // 1. Prepare Data Context
  const linksText = candidate.links
    ? Object.entries(candidate.links).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'No links provided';

  // We pass the raw name to the prompt and let the AI handle the "Dr." logic
  const rawFounderName = startup.founderName || "Founder"; 
  
  const scrapedIntel = startup.scrapedContext || "No specific news found.";

  // Include resume full text if available (for context like GitHub links, projects, etc.)
  const resumeContext = candidate.resumeFullText 
    ? `\n\n**FULL RESUME TEXT (Use this for additional context - extract GitHub links, project details, and specific technical achievements):**\n${candidate.resumeFullText}`
    : '';

  const prompt = `
### 1. THE PERSONA & GOAL
You are ${candidate.name}, a high-agency student builder. 
You are emailing ${rawFounderName} at ${startup.name}.
**Goal:** Prove you can solve a specific technical problem for them so they reply.
**Vibe:** Professional, concise, low-ego, "Junior Peer" (not "Fanboy").

### 2. CRITICAL RULES (Strict Adherence)
1. **The "Internal Note" Subject Line:** - The subject must look like a boring internal memo or Slack message. 
   - **Max 3-4 words.** Lowercase or Sentence case.
   - **Must be TOPICAL.** Refer to the tech stack or the specific problem.
   - *Bad:* "Inquiry about internship", "Quick question", "Hello"
   - *Good:* "go migration", "react native latency", "api docs feedback"

2. **The Naming Protocol:**
   - **Rule:** If the founder's name (${rawFounderName}) has "Dr.", "Prof.", or "Professor", USE IT (e.g., "Hi Dr. Reed"). 
   - **Else:** Use their FIRST NAME only (e.g., "Hi Alex"). 
   - **NEVER:** Never use "Mr.", "Ms.", or "Hi Team".

3. **The "Anti-Burden" Opening:**
   - **Strict Ban:** Do not say "I hope you are well" or "I am writing to..." 
   - **The Bridge:** Start immediately with the connection between *Their Challenge* (from Scraped Intel/Description) and *Your Work*.

4. **One "Sniper Shot" Only:**
   - Pick ONE primary technical skill/project that matches their needs. Do not list 5 unrelated skills. 
   - If they need Go, talk about Go. Don't mention you also know Photoshop.

5. **Include Relevant Links:**
   - If the resume contains GitHub, portfolio, or personal website links, naturally incorporate them before the CTA.
   - Extract these from the resume full text context provided below.
   - Make it feel organic, not forced (e.g., "You can see my work at github.com/username" or "Check out my portfolio at...")

### 3. STRUCTURE & FORMATTING
- **Length:** Under 80 words total.
- Get straight to the point in the first 1–2 sentences (why you are reaching out and what you want).
- Infer the most appropriate role or position for this candidate (for example "software engineer", "product designer", "data scientist") from their skills and summary, and clearly state in the opening what role they want (e.g. "I’d love to intern as a software engineer on your team").
- Clearly highlight what you are capable of and how those skills are useful to this specific startup.
- Show real eagerness and commitment without sounding desperate.
- Keep it casual and friendly, almost like you already know the founder.
- Avoid generic, over‑formal phrases like "I hope this email finds you well" or "To whom it may concern".
- Reference specific details about the startup (industry, product, tags, description) so every startup gets a different, tailored email.
- The subject line must write in this format: "Startup Name (Desired Role)"

Use a consistent structure across emails so they feel like they follow the same format:
1) A short, direct opening that says who you are, the role you’d like (based on your background), and why you’re reaching out. Keep this concise
2) 2–4 short bullet points or numbered points that call out your most relevant skills, experiences, or projects for THIS startup.
3) keep each bullet point to a maximum of around 10-20 words. Be very concise.
4) if the user sending out the email has any technical links, try to include them at the end of the email (github, portfolio, personal website)
5) use a professional sign off at the end of the email (e.g. "Best regards, [Your Name]"), try to include contact information if they have it on their resume
6) start the email with "Hi [Founder Name]," or an introduction that includes the founder's name

### 4. DATA INPUTS (From Supabase Database)
**CANDIDATE (ME):**
- Name: ${candidate.name}
- Email: ${candidate.email}
- Summary: ${candidate.summary}
- Skills: ${candidate.skills.join(', ')}
- Location: ${candidate.location || 'Not specified'}
- Education: ${candidate.educationLevel || 'Not specified'}${candidate.university ? ` at ${candidate.university}` : ''}
- Past Internships: ${candidate.pastInternships || 'None listed'}
- Technical Projects: ${candidate.technicalProjects || 'None listed'}
- Links: ${linksText}${resumeContext}

**STARTUP (THEM):**
- Name: ${startup.name}
- Industry: ${startup.industry || 'Not specified'}
- Location: ${startup.location || 'Not specified'}
- Website: ${startup.website || 'Not specified'}
- YC Batch: ${startup.batch || 'Not specified'}
- Funding Stage: ${startup.fundingStage || 'Not specified'}
- Funding Amount: ${startup.fundingAmount || 'Not specified'}
- Tags/Keywords: ${startup.tags?.join(', ') || 'None'}
- Job Openings: ${startup.jobOpenings || 'Not specified'}
- Founder Name: ${rawFounderName}
- **Intel/News (HIGH PRIORITY):** ${scrapedIntel}
- Description: ${startup.description || 'N/A'}

### 5. EXECUTION
Write the email now. Return ONLY JSON.
{
  "subject": "The internal-style subject line",
  "body": "The plain text body."
}
`.trim();

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
    const fallbackFounderName = (startup.founderName || startup.name).split(' ')[0]; // Use first name as fallback
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

  // 1. Prepare Data Context
  const linksText = candidate.links
    ? Object.entries(candidate.links).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'No links provided';

  // We pass the raw name to the prompt and let the AI handle the "Dr." logic
  const rawFounderName = startup.founderName || "Founder"; 
  
  const scrapedIntel = startup.scrapedContext || "No specific news found.";

  // Include resume full text if available (for context like GitHub links, projects, etc.)
  const resumeContext = candidate.resumeFullText 
    ? `\n\n**FULL RESUME TEXT (Use this for additional context - extract GitHub links, project details, and specific technical achievements):**\n${candidate.resumeFullText}`
    : '';

  const prompt = `
### 1. THE PERSONA & GOAL
You are ${candidate.name}, a high-agency student builder. 
You are emailing ${rawFounderName} at ${startup.name}.
**Goal:** Prove you can solve a specific technical problem for them so they reply.
**Vibe:** Professional, concise, low-ego, "Junior Peer" (not "Fanboy").

### 2. CRITICAL RULES (Strict Adherence)
1. **The "Internal Note" Subject Line:** - The subject must look like a boring internal memo or Slack message. 
   - **Max 3-4 words.** Lowercase or Sentence case.
   - **Must be TOPICAL.** Refer to the tech stack or the specific problem.
   - *Bad:* "Inquiry about internship", "Quick question", "Hello"
   - *Good:* "go migration", "react native latency", "api docs feedback"

2. **The Naming Protocol:**
   - **Rule:** If the founder's name (${rawFounderName}) has "Dr.", "Prof.", or "Professor", USE IT (e.g., "Hi Dr. Reed"). 
   - **Else:** Use their FIRST NAME only (e.g., "Hi Alex"). 
   - **NEVER:** Never use "Mr.", "Ms.", or "Hi Team".

3. **The "Anti-Burden" Opening:**
   - **Strict Ban:** Do not say "I hope you are well" or "I am writing to..." 
   - **The Bridge:** Start immediately with the connection between *Their Challenge* (from Scraped Intel/Description) and *Your Work*.

4. **One "Sniper Shot" Only:**
   - Pick ONE primary technical skill/project that matches their needs. Do not list 5 unrelated skills. 
   - If they need Go, talk about Go. Don't mention you also know Photoshop.

5. **Include Relevant Links:**
   - If the resume contains GitHub, portfolio, or personal website links, naturally incorporate them before the CTA.
   - Extract these from the resume full text context provided below.
   - Make it feel organic, not forced (e.g., "You can see my work at github.com/username" or "Check out my portfolio at...")

### 3. STRUCTURE & FORMATTING
- **Length:** Under 80 words total.
- **Format:** - Opening Sentence (The Hook).
  - *Optional:* 2-3 very short bullet points (max 10 words each) IF you need to list specific tech metrics or proof. 
  - *Optional:* Include relevant links (GitHub, portfolio) if available.
  - Closing Sentence (The CTA - MUST ask for something).
- **The CTA (Call-to-Action):** You MUST end with a clear request asking for a meeting, chat, or call. This is critical - founders need to know how to respond.
  - *Good:* "Would love to chat about how I can help. Free for a quick call this week?"
  - *Good:* "Open to jumping on a call if you're interested in discussing this further."
  - *Good:* "Would you be open to a quick chat about this?"
  - *Good:* "Any chance you'd have time for a brief call to discuss?"
  - *Bad:* "Happy to send over the repo if you're curious." (Too passive, doesn't ask for response)
  - *Bad:* "Let me know if you'd like to connect." (Vague, doesn't specify next step)
  - *Bad:* "If you need hands on this, I'd love to help." (No clear ask)

### 4. DATA INPUTS (From Supabase Database)
**CANDIDATE (ME):**
- Name: ${candidate.name}
- Email: ${candidate.email}
- Summary: ${candidate.summary}
- Skills: ${candidate.skills.join(', ')}
- Location: ${candidate.location || 'Not specified'}
- Education: ${candidate.educationLevel || 'Not specified'}${candidate.university ? ` at ${candidate.university}` : ''}
- Past Internships: ${candidate.pastInternships || 'None listed'}
- Technical Projects: ${candidate.technicalProjects || 'None listed'}
- Links: ${linksText}${resumeContext}

**STARTUP (THEM):**
- Name: ${startup.name}
- Industry: ${startup.industry || 'Not specified'}
- Location: ${startup.location || 'Not specified'}
- Website: ${startup.website || 'Not specified'}
- YC Batch: ${startup.batch || 'Not specified'}
- Funding Stage: ${startup.fundingStage || 'Not specified'}
- Funding Amount: ${startup.fundingAmount || 'Not specified'}
- Tags/Keywords: ${startup.tags?.join(', ') || 'None'}
- Job Openings: ${startup.jobOpenings || 'Not specified'}
- Founder Name: ${rawFounderName}
- **Intel/News (HIGH PRIORITY):** ${scrapedIntel}
- Description: ${startup.description || 'N/A'}

### 5. EXECUTION
Write the email now. Return ONLY JSON.
{
  "subject": "The internal-style subject line",
  "body": "The plain text body."
}
`;

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


