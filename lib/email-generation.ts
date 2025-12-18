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
  jobType?: 'full-time' | 'part-time' | 'internship'; // Preferred job type
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

export type EmailPersona = 'direct-ask' | 'genuine-fan' | 'value-first';

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

/**
 * Get the job type text for use in prompts
 * Defaults to "internship" if not specified
 */
function getJobTypeText(jobType?: 'full-time' | 'part-time' | 'internship'): string {
  switch (jobType) {
    case 'full-time':
      return 'full-time position';
    case 'part-time':
      return 'part-time position';
    case 'internship':
    default:
      return 'internship';
  }
}

/**
 * Get the job type short text for subject lines
 */
function getJobTypeShort(jobType?: 'full-time' | 'part-time' | 'internship'): string {
  switch (jobType) {
    case 'full-time':
      return 'full-time';
    case 'part-time':
      return 'part-time';
    case 'internship':
    default:
      return 'internship';
  }
}

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

  // Add Novaflow-specific context for testing
  let scrapedIntel = startup.scrapedContext || 'None available';
  if (startup.name.toLowerCase() === 'novaflow') {
    const novaflowContext = `Novaflow is the AI data analyst for biology labs. Bioinformatics data analysis is a time-consuming and expensive process for scientists. With Novaflow, life scientists can upload experimental data, ask questions in plain English, and get instant, publication-ready plots, giving them results in minutes instead of months. Researchers at leading institutions like UCSF, Mount Sinai, UC Berkeley, and Harvard are already using Novaflow in their labs.`;
    scrapedIntel =
      scrapedIntel !== 'None available'
        ? `${scrapedIntel}\n\n${novaflowContext}`
        : novaflowContext;
  }

  const jobTypeText = getJobTypeText(candidate.jobType);
  const jobTypeShort = getJobTypeShort(candidate.jobType);

  return `
You are writing a cold email for ${candidate.name} to ${rawFounderName} at ${startup.name}.

### YOUR PHILOSOPHY
Time is the scarcest resource for startup founders. Every word you write that doesn't directly serve the goal of getting a ${jobTypeText} is a word that wastes their time and reduces your chances. 

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
- Examples that work: "Summer ${jobTypeShort} at [Company]?" / "ML ${jobTypeShort === 'internship' ? 'intern' : jobTypeShort} - UCSD student" / "[Company] ${jobTypeShort} inquiry"
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
- Professional links (GitHub, portfolio, LinkedIn, personal website) at the end after your signature
  * IMPORTANT: Extract these links ONLY from the resume text provided below
  * Look for links in the HEADER/TOP section of the resume (first ~500 characters)
  * Personal website rules:
    - Must contain the candidate's name (first or last name) in the domain (e.g., johndoe.com, jane-smith.dev)
    - Must use common personal TLDs: .com, .dev, .io, .me, .net, .co, .tech, .app
    - Must NOT be institutional (.edu, .gov, .org) or company domains (google.com, facebook.com, etc.)
    - Must NOT be subdomain URLs (api.example.com, docs.example.com)
  * GitHub: Look for github.com/[username] patterns
  * LinkedIn: Look for linkedin.com/in/[username] patterns
  * Portfolio: Look for explicitly labeled "Portfolio:", "Website:", or "Personal site:" entries
  * ONLY include links that you can confidently identify from the resume text - do NOT hallucinate or guess links

**What to NEVER include:**
- GENERIC skill lists without connection to the company (e.g., "I have experience with Python, Pytorch, and NumPy" - this tells them nothing about WHY it matters to THEM)
- Qualifications that could apply to any company - if you could send the same sentence to 100 different startups, it's too generic
- Explicit value proposition statements ("I can help you...", "My value is...")
- Compliments about the company ("I love what you're doing...")
- Explanations of why you're emailing ("I'm reaching out because...")
- Questions that put work on them ("What roles do you have open?")
- Long paragraphs - keep it scannable
- Links that appear in work experience, project descriptions, or are clearly not personal websites
- Company websites where the candidate worked (e.g., if they worked at Google, do NOT include google.com)

**Tone:**
- Confident but not arrogant
- Professional but not stiff
- Direct but not rude

### CLOSING & SIGNATURE
- Vary your closing/signature - do NOT always use "Best," 
- Choose a closing that matches the tone and context of the email
- Examples of appropriate closings:
  * "Best," (professional, standard)
  * "Best regards," (slightly more formal)
  * "Looking forward to hearing from you," (when you've made a specific ask)
  * "Thanks," (casual, friendly)
  * "Thanks for your time," (respectful, acknowledges their busy schedule)
  * "Hope to connect," (friendly, forward-looking)
  * "Cheers," (casual, modern)
- Match the closing to the email's tone - if it's more casual, use a casual closing; if it's more formal, use a formal closing
- Always sign with the candidate's name: ${candidate.name}

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
- Full Resume Text (extract professional links from here): ${candidate.resumeFullText || 'Not provided'}

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
  const jobTypeText = getJobTypeText(candidate.jobType);

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

### CRITICAL: THIS IS NOT A "DIRECT ASK" EMAIL

You are writing a "GENUINE FAN" email. This is FUNDAMENTALLY DIFFERENT from a typical cold email.

**WHAT YOU MUST NEVER DO (these are deal-breakers):**
- NEVER start with "My name is [Name], a [Title] at [School]..."
- NEVER lead with your credentials, education, or qualifications
- NEVER say "I'm writing to inquire about ${jobTypeText} opportunities" (be more specific and direct)
- NEVER list your skills or experiences as the focus
- NEVER make the ask about "discussing how my background could be a fit"
- NEVER structure it as: introduction → qualifications → ask for meeting

**WHAT YOU MUST DO:**
- START by talking about THEM - their product, their mission, something specific they built
- Share YOUR genuine reaction or story about their work
- Let your relevant experience emerge naturally, almost as an afterthought
- End with curiosity about THEM, not a job request

### YOUR PHILOSOPHY
Behind every startup is a founder who cares deeply about a problem. The best cold emails show you genuinely give a damn about the same thing they do.

This is about authentic connection. If you've actually used their product, care about the problem they're solving, or have a genuine story about why THIS company matters to you - that beats a perfect resume.

### GOOD vs BAD EXAMPLES

**BAD (this is a Direct Ask disguised as Genuine Fan - DO NOT DO THIS):**
"Hi Julian, My name is Robert, an EE student at UCLA, and I'm writing to inquire about ${jobTypeText} opportunities at Stagewise. As the CTO of a startup, I led development of a full-stack app using React Native and Node.js. I'd love to discuss how my background could be a fit."

**GOOD (this is a true Genuine Fan email - DO THIS):**
"Hi Julian, I've been obsessed with the idea of AI-powered coding agents, so when I found Stagewise I immediately tried it on one of my React projects. The way it understands component context is unlike anything else I've used. I actually built something similar (much simpler) at my startup - would love to hear how you approached the frontend parsing problem."

Notice the difference:
- BAD: Leads with self, credentials, then asks for job
- GOOD: Leads with genuine interest in their work, mentions experience naturally, asks about THEIR work

### SUBJECT LINE
- Personal and specific to THEM, not about you
- Reference something they built, said, or did
- Examples: "Your approach to [specific feature]" / "Fellow [shared interest] here" / "Tried [product] and had to reach out"

### EMAIL STRUCTURE
1. **Open with THEM** - What specifically caught your attention about their work? (1-2 sentences)
2. **Your connection** - Why does this resonate with you personally? Share a brief story or reaction. (1-2 sentences)
3. **Natural bridge** - Your relevant experience should feel incidental, not the focus. (1 sentence max)
4. **Authentic close** - End by showing genuine alignment with their mission/work and natural interest in being part of it:
   - Express that their work aligns with what you care about/want to build
   - Show that you're drawn to contribute because of mission alignment, not just opportunity
   - Feel authentic and personal, not fake or formulaic
   - Avoid generic questions that feel like you're trying to sound curious
   - Instead, be direct about why THIS company matters to you
   - Examples of GOOD endings:
     * "This is exactly the kind of problem I want to spend my time on—would love to hear more about how you're thinking about [specific aspect]."
     * "I've been looking for ways to work on [mission-related thing], and what you're building feels like the right place. Would be great to connect."
     * "This aligns so well with what I care about. I'd love to learn more about your approach to [specific challenge]."
   - Examples of BAD endings (too fake/question-y):
     * "I'm curious—what was the most surprising challenge you faced?"
     * "What was the most surprising hurdle you encountered?"
     * Generic questions that could be asked to any company
   Keep it to 1-2 sentences max.

### LENGTH & TONE
- Keep it under 100 words - genuine enthusiasm doesn't need length
- Warm, conversational, like messaging someone whose work you admire
- It's okay to be informal, excited, even a little nerdy about the topic
- Your personality should come through

### CLOSING & SIGNATURE
- Vary your closing/signature - do NOT always use "Best,"
- Choose a closing that matches the warm, conversational tone of this persona
- Examples of appropriate closings:
  * "Best," (standard, friendly)
  * "Thanks," (casual, appreciative)
  * "Looking forward to connecting," (when you've expressed interest in learning more)
  * "Excited to hear more," (when you've shown genuine enthusiasm)
  * "Cheers," (casual, modern)
  * "Talk soon," (very casual, friendly)
- Match the closing to the email's energy - if you're excited about their work, show it in the closing
- Always sign with the candidate's name: ${candidate.name}

### THE GENUINE TEST
Before generating: Could this email ONLY be sent to this specific company? If you could swap the company name and send it elsewhere, it fails.

### NAMING RULES
- First name only: "Hi Alex,"
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
- Full Resume Text (extract professional links from here if needed): ${candidate.resumeFullText || 'Not provided'}

**IMPORTANT LINK EXTRACTION RULES (if you include links at the end):**
- Extract links ONLY from the resume text above
- Personal website: Must contain candidate's name in domain, use personal TLDs (.com, .dev, .io, .me), NOT .edu/.gov/.org or company domains
- GitHub: github.com/[username] patterns
- LinkedIn: linkedin.com/in/[username] patterns
- Do NOT include company websites from work experience or project URLs
- Do NOT hallucinate or guess links that aren't in the resume

**STARTUP:**
- Name: ${startup.name}
- Founder: ${rawFounderName}
- Industry: ${startup.industry || 'Not specified'}
- Description: ${startup.description || 'N/A'}
- Recent News/Intel: ${scrapedIntel}
- What they do: ${startup.description || 'N/A'}

**CRITICAL REMINDER:** 
- This email is about expressing genuine interest in THEIR work and showing mission alignment
- Use the startup description and scraped intel to find something SPECIFIC about their product/mission to open with
- The candidate's experience should be mentioned briefly and naturally, NOT as the focus
- The ending MUST:
  * Show genuine alignment with their mission/work and why it matters to you
  * Express authentic interest in contributing/being part of what they're building
  * Feel personal and real, not fake or like you're trying to sound curious with generic questions
  * Demonstrate that you want to work there because you genuinely care about the mission, not just for opportunity
  * Avoid generic "curious questions" that feel formulaic or could be asked to any company
  * Be direct and authentic—if you're excited about their work, say so naturally
  * NOT ask about "opportunities" explicitly, but show interest in connecting/learning more
  * Feel like someone who genuinely wants to be part of what they're building
- The ending should make it clear: "I want to work here because I believe in what you're doing"
- If the email reads like a traditional cold email asking for a job, or if the ending feels fake/question-y, you have failed this task

### OUTPUT FORMAT
Return ONLY valid JSON:
{
  "subject": "Your subject line here",
  "body": "The complete email body"
}
`.trim();
}

/**
 * Builds the email generation prompt using Persona 3: "The Value-First Approach"
 */
function buildValueFirstPrompt(
  candidate: CandidateProfile,
  startup: StartupInfo,
  match: MatchContext
): string {
  const rawFounderName = startup.founderName || 'Founder';
  const jobTypeText = getJobTypeText(candidate.jobType);

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
Talk is cheap. Every student says they're "passionate" and "hardworking." The founders who get 100 emails a week have learned to tune this out.

What they CAN'T ignore: someone who's already done something useful for them.

The Morning Brew intern got hired because she mocked up her resume AS a Morning Brew newsletter. She didn't say "I could help with your newsletter" - she showed it.

Your email should either:
1. Present something you've already built/found/fixed for them
2. Propose something so specific they can visualize you doing it

This is the highest-effort approach, but it has the highest hit rate.

### THE RULES

**Subject Line:**
- Lead with curiosity or a project idea - NOT a sales pitch
- The subject should feel like a peer reaching out with a genuine idea, not someone selling a service
- DO NOT make it sound like an advertisement or a pitch for something they should buy
- Examples of GOOD subject lines:
  * "Quick project idea for [specific area]"
  * "Thought about your [product] - had an idea"
  * "Project idea: [brief description]"
  * "Something I built that might interest you"
- Examples of BAD subject lines (sound like ads/pitches):
  * "A low-cost solution for [Company]"
  * "Proposal: [Service] for [Company]"
  * "Idea: [Thing] - let me build it for you"
- The subject should make them curious, not feel like they're being sold to

**The Email Structure:**

Option A - "I already did the work":
1. State what you built/found/fixed (one sentence)
2. Brief context on why/how (one sentence)
3. Link to the work (if available)
4. Subtle interest in working there: Show that you're interested in being part of their work without directly asking for a job
   - DO: "I've been looking for ways to work on problems like this" / "This is the kind of work I want to spend my time on"
   - DON'T: "I would love to build this for you as an intern" / "Hire me to do this"

Option B - "Here's exactly what I'd do":
1. Identify a specific problem they likely have
2. Propose a specific solution with enough detail that they can evaluate it
3. Explain why you're capable of executing it (briefly)
4. Express interest in their work, not just the job: The ending should show you want to be part of what they're building, not that you're pitching yourself as a contractor
   - DO: "Would love to explore this further" / "Happy to chat about this if it's interesting"
   - DON'T: "I would love to build this for [Company] as an intern" / "Let me do this for you"

**CRITICAL - The Ending:**
- The ending should NOT sound like you're pitching a service or asking for a job directly
- Instead, it should express genuine interest in the problem/company in a way that naturally invites further conversation
- The goal is to seem like a peer who shares their interest in the problem, not someone trying to sell them on hiring you
- Examples of GOOD endings:
  * "Happy to chat more about this if it's interesting to you."
  * "Would love to hear your thoughts on this approach."
  * "This is the kind of problem I'm excited about - would be great to connect."
- Examples of BAD endings:
  * "I would love to build this for [Company] as an intern this summer."
  * "Let me know if you'd like me to do this for you."
  * "I'm looking for a ${jobTypeText} and would love to work on this."

**The Value Test:**
The email should be useful to them even if they don't hire you. They should learn something or get something from reading it.

**What to INCLUDE:**
- Something concrete: a link, a mockup, a specific technical suggestion
- Evidence you understand their actual problems (not just their marketing copy)
- Technical specifics that prove competence

**What to NEVER include:**
- Generic offers to "help with anything"
- Vague promises about what you "could" do
- Lists of skills without application

**Tone:**
- Confident - you're offering value, not begging for a chance
- Specific - details matter
- Humble but not self-deprecating - present your work, let them judge

### LENGTH REQUIREMENT
- Keep the email body to 70 words maximum - founders are busy and won't read long emails
- Be concise and value-focused - every word must serve the purpose of showing what you've done or can do
- Quality over quantity - a short, impactful email beats a long one

### CLOSING & SIGNATURE
- Vary your closing/signature - do NOT always use "Best,"
- Choose a closing that matches the confident, value-focused tone of this persona
- Examples of appropriate closings:
  * "Best," (professional, standard)
  * "Thanks," (appreciative, acknowledges their time)
  * "Looking forward to your thoughts," (when you've presented work for feedback)
  * "Hope this helps," (when you've provided value)
  * "Let me know if you'd like to discuss," (when you've proposed something)
  * "Cheers," (casual, confident)
- Match the closing to what you've done - if you've built something, acknowledge their time; if you've proposed something, invite discussion
- Always sign with the candidate's name: ${candidate.name}

### NAMING RULES
- First name unless they have "Dr." or "Prof."
- If founder name has "Dr." or "Prof." → Use it: "Hi Dr. Smith,"
- Otherwise → First name only: "Hi Alex,"

### DATA INPUTS

**CANDIDATE:**
- Name: ${candidate.name}
- Email: ${candidate.email}
- Summary: ${candidate.summary}
- Skills: ${candidate.skills.join(', ')}
- Education: ${candidate.educationLevel || 'Not specified'}${candidate.university ? ` at ${candidate.university}` : ''}
- Technical Projects: ${candidate.technicalProjects || 'None listed'}
- Full Resume Text (extract professional links from here if needed): ${candidate.resumeFullText || 'Not provided'}

**IMPORTANT LINK EXTRACTION RULES (if you include links at the end):**
- Extract links ONLY from the resume text above
- Personal website: Must contain candidate's name in domain, use personal TLDs (.com, .dev, .io, .me), NOT .edu/.gov/.org or company domains
- GitHub: github.com/[username] patterns
- LinkedIn: linkedin.com/in/[username] patterns
- Do NOT include company websites from work experience or project URLs
- Do NOT hallucinate or guess links that aren't in the resume

**STARTUP:**
- Name: ${startup.name}
- Founder: ${rawFounderName}
- Industry: ${startup.industry || 'Not specified'}
- Description: ${startup.description || 'N/A'}
- Tech Stack/Tags: ${startup.tags?.join(', ') || 'Not specified'}
- Recent News/Intel: ${scrapedIntel}
- Website: ${startup.website || 'Not specified'}

### CRITICAL INSTRUCTION
You MUST propose something specific. Use the startup description and intel to identify a real problem or opportunity, then either:
- Describe something concrete you've already built that's relevant
- Propose a specific technical solution to a problem they likely have

Do NOT fall back to generic "I have skills that could help" language. If you can't find something specific, make an educated guess based on common problems in their industry.

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
  console.log(`[Email Generation] generateColdEmail called with persona: '${persona}'`);
  let prompt: string;
  if (persona === 'genuine-fan') {
    prompt = buildGenuineFanPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Genuine Fan prompt`);
  } else if (persona === 'value-first') {
    prompt = buildValueFirstPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Value-First prompt`);
  } else {
    prompt = buildEmailPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Direct Ask prompt`);
  }

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
    const jobTypeShort = getJobTypeShort(candidate.jobType);
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (${jobTypeShort} interest)`;
  }

  // Ensure subject has the requested prefix if provided.
  if (subjectPrefix && !subject.startsWith(subjectPrefix)) {
    subject = subjectPrefix + subject;
  }

  if (!subject) {
    const jobTypeShort = getJobTypeShort(candidate.jobType);
    subject =
      subjectPrefix +
      `Intro: ${candidate.name} → ${startup.name} (${jobTypeShort} interest)`;
  }

  if (!body) {
    const fallbackFounderName = (startup.founderName || startup.name).split(
      ' '
    )[0]; // Use first name as fallback
    // Use varied closings even in fallback
    const closings = ['Best,', 'Thanks,', 'Looking forward to hearing from you,'];
    const randomClosing = closings[Math.floor(Math.random() * closings.length)];
    body = `Hi ${fallbackFounderName},\n\nMy name is ${candidate.name} and I'm interested in opportunities that align with my background in ${candidate.skills.join(
      ', '
    )}.\n\nWould you be open to a quick chat about this?\n\n${randomClosing}\n${candidate.name}`;
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
  console.log(`[Email Generation] generateColdEmailStream called with persona: '${persona}'`);
  let prompt: string;
  if (persona === 'genuine-fan') {
    prompt = buildGenuineFanPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Genuine Fan prompt for streaming`);
  } else if (persona === 'value-first') {
    prompt = buildValueFirstPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Value-First prompt for streaming`);
  } else {
    prompt = buildEmailPrompt(candidate, startup, match);
    console.log(`[Email Generation] Using Direct Ask prompt for streaming`);
  }

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
