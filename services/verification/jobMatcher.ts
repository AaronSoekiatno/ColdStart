import Anthropic from '@anthropic-ai/sdk';
import { ExtractedCode } from './extraction';

/**
 * Job description from the jobs table
 */
export interface JobDescription {
  id: string;
  company_name: string;
  job_title: string;
  job_type: string | null;
  location: string | null;
  job_url: string | null;
  company_tagline: string | null;
  company_about: string | null;
  salary_range: string | null;
  visa_requirements: string | null;
  experience_level: string | null;
  skills: string | null; // comma-separated
  requirements: string | null;
  benefits: string | null;
  interview_process: string | null;
  full_description: string | null;
  startup_id: string | null;
  yc_link: string | null;
  is_active: boolean | null;
}

/**
 * Individual technology or skill match with code evidence
 */
export interface CodeMatch {
  technology: string;
  found: boolean;
  evidence: CodeSnippet[]; // actual code snippets with context
  relevance: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
}

/**
 * Code snippet with file path and line context
 */
export interface CodeSnippet {
  file: string; // file path
  snippet: string; // actual code snippet (3-10 lines)
  line_start?: number; // optional line number
  line_end?: number; // optional line number
  explanation?: string; // brief explanation of why this is relevant
}

/**
 * Extracted requirements from job description
 */
export interface ExtractedRequirements {
  required: string[]; // Required technologies/skills
  preferred: string[]; // Preferred/optional but valuable skills
  domain_context: string; // Domain or industry context
  has_llm_requirement: boolean; // Whether LLM-systems experience is mentioned (even if optional)
}

/**
 * Complete match report focused on code evidence
 */
export interface MatchReport {
  overallScore: number; // 0-100
  technologyMatches: CodeMatch[];
  skillMatches: CodeMatch[];
  summary: string; // brief summary of the match
}

export class JobMatcherService {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.model = model || 'claude-sonnet-4-20250514';
  }

  /**
   * Main method to analyze code against job description
   */
  async analyzeMatch(
    extractedCode: ExtractedCode,
    jobDescription: JobDescription
  ): Promise<MatchReport> {
    // First, extract requirements from the job description
    const extractedRequirements = await this.extractRequirements(jobDescription);
    
    // Then, use those requirements to match against code
    const { systemPrompt, userPrompt } = this.constructPrompt(
      extractedCode,
      jobDescription,
      extractedRequirements
    );
    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseClaudeResponse(response);
  }

  /**
   * Extract requirements from job description using Claude
   */
  private async extractRequirements(jobDescription: JobDescription): Promise<ExtractedRequirements> {
    const jobDescText = this.buildJobDescriptionText(jobDescription);
    
    const systemPrompt = `You are a job description analyzer. Extract ONLY what is explicitly stated in the job description. Do NOT interpret, expand, or add generic programming skills.`;

    const userPrompt = `## STEP 1: EXTRACT EXACT REQUIREMENTS

Read the job description and extract ONLY what is explicitly stated.
Do NOT add generic programming skills. Do NOT interpret or expand.

JOB DESCRIPTION:

Title: ${jobDescription.job_title}
Company: ${jobDescription.company_name}

${jobDescText}

---

Extract the requirements and return them as JSON in this exact format:

{
  "required": ["technology1", "technology2", "skill1", ...],
  "preferred": ["optional technology", "nice to have skill", ...],
  "domain_context": "brief description of the domain/industry/context",
  "has_llm_requirement": <boolean>
}

CRITICAL EXTRACTION RULES:
1. "required" - ONLY include technologies, frameworks, languages, or skills that are EXPLICITLY stated as required or mandatory. If it says "must have Python" → include "Python". If it says "strong programming skills" → DO NOT include anything (too generic).
2. "preferred" - ONLY include technologies/skills EXPLICITLY mentioned as "preferred", "nice to have", "optional", "great to have", "bonus", etc. Use the exact wording when possible.
3. CRITICAL: If LLM-systems, AI/ML infrastructure, or related experience is mentioned (even as "optional but great to have"), set "has_llm_requirement" to true AND include it in "preferred" array.
4. "domain_context" - ONLY if explicitly stated (e.g., "AI agent evaluation platform", "fintech startup", "healthcare SaaS"). If not clear, use empty string.
5. Be EXACT with technology names - use exactly what's stated (e.g., if it says "Python" include "Python", if it says "programming experience" DO NOT include "Python").
6. DO NOT infer or assume. If the JD doesn't explicitly name a technology, don't include it.
7. Only return valid JSON, no markdown formatting or additional text`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseRequirementsResponse(response);
  }

  /**
   * Parse requirements extraction response
   */
  private parseRequirementsResponse(response: string): ExtractedRequirements {
    try {
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      return {
        required: Array.isArray(parsed.required) ? parsed.required.map(String) : [],
        preferred: Array.isArray(parsed.preferred) ? parsed.preferred.map(String) : [],
        domain_context: String(parsed.domain_context || ''),
        has_llm_requirement: Boolean(parsed.has_llm_requirement),
      };
    } catch (error: any) {
      // Fallback to empty requirements if parsing fails
      return {
        required: [],
        preferred: [],
        domain_context: '',
        has_llm_requirement: false,
      };
    }
  }

  /**
   * Construct the prompt for Claude API
   */
  private constructPrompt(
    extractedCode: ExtractedCode,
    jobDescription: JobDescription,
    extractedRequirements: ExtractedRequirements
  ): { systemPrompt: string; userPrompt: string } {
    // Prepare code summary (includes full file contents where possible for snippet extraction)
    const codeSummary = this.prepareCodeSummary(extractedCode);

    // Build job description text
    const jobDescText = this.buildJobDescriptionText(jobDescription);

    // Build LLM-specific instruction based on extracted requirements
    const llmInstruction = extractedRequirements.has_llm_requirement
      ? `CRITICAL: This role specifically requires experience with LLM-systems and infrastructure. You MUST explicitly check for evidence of working with LLMs, AI systems, or evaluation infrastructure. This is a highly important signal for this position.`
      : `Note: Check for LLM-systems experience if mentioned in the job description, as it may be valuable even if not explicitly required.`;

    const systemPrompt = `You are a code analyst specializing in matching candidate code to job requirements. Your task is to find specific code snippets that demonstrate ONLY the explicitly extracted requirements from the job description.

Focus on finding actual code evidence - look for imports, API usage, framework patterns, architectural decisions, and implementation details.

CRITICAL: You MUST ONLY evaluate requirements that are in the extracted list below. Do NOT evaluate anything not explicitly listed. Do NOT add requirements or make assumptions.`;

    // Build the extracted requirements list for STEP 1
    const allRequirements = [
      ...extractedRequirements.required.map(r => ({ name: r, type: 'required' })),
      ...extractedRequirements.preferred.map(r => ({ name: r, type: 'preferred' }))
    ];

    const requirementsList = allRequirements.length > 0
      ? allRequirements.map(req => `- ${req.name} (${req.type})`).join('\n')
      : 'No explicit requirements extracted from job description.';

    const userPrompt = `## STEP 1: EXTRACT EXACT REQUIREMENTS

The following requirements were extracted from the job description. These are the ONLY requirements you should evaluate:

EXPLICIT_TECHNOLOGIES_AND_SKILLS:
${requirementsList}

${extractedRequirements.domain_context ? `ROLE_CONTEXT: ${extractedRequirements.domain_context}` : ''}

${extractedRequirements.has_llm_requirement ? `\nNOTE: LLM-systems experience is mentioned in the job description (even if as optional). This is a high-signal requirement for this role.` : ''}

---

## STEP 2: EVALUATE ONLY EXTRACTED REQUIREMENTS

For EACH item in EXPLICIT_TECHNOLOGIES_AND_SKILLS above, search the code.
Do NOT evaluate anything not in your extracted list.
Do NOT add generic skills or technologies.
Do NOT make assumptions.

JOB DESCRIPTION (for reference):
Title: ${jobDescription.job_title}
Company: ${jobDescription.company_name}
Location: ${jobDescription.location || 'Not specified'}

CANDIDATE CODE ANALYSIS:

Repository: ${extractedCode.repo}
GitHub Username: ${extractedCode.github_username}
Total Commits: ${extractedCode.metadata.total_commits}
Total Lines Added: ${extractedCode.metadata.total_lines_added}
Files Count: ${extractedCode.metadata.files_count}
Date Range: ${extractedCode.metadata.date_range.first_commit || 'Unknown'} to ${extractedCode.metadata.date_range.last_commit || 'Unknown'}

Code Files Summary:
${Object.keys(extractedCode.files)
  .map((file) => `- ${file} (${extractedCode.files[file].split('\n').length} lines)`)
  .join('\n')}

Key Code Content:
${codeSummary}

---

ANALYSIS TASK:

For EACH item in the EXPLICIT_TECHNOLOGIES_AND_SKILLS list above:
1. Search through the code for actual evidence (imports, usage, patterns)
2. Extract the relevant code snippets (3-10 lines) that demonstrate this
3. Include the file path and the actual code
4. Rate the relevance (high/medium/low) and your confidence (0-100)

${extractedRequirements.has_llm_requirement ? `\nSPECIAL INSTRUCTION FOR LLM-SYSTEMS EXPERIENCE:
Since this is mentioned in the job description, search for:
- LLM API calls (OpenAI, Anthropic, etc.)
- AI/ML model usage
- Evaluation or benchmarking infrastructure
- Agent systems
- Any AI-related code patterns

` : ''}

CRITICAL: You MUST evaluate EVERY item in the EXPLICIT_TECHNOLOGIES_AND_SKILLS list. Do NOT evaluate anything that is NOT in that list.

Provide a JSON response with the following structure:

{
  "overallScore": <number 0-100>,
  "technologyMatches": [
    {
      "technology": "<EXACT name from EXPLICIT_TECHNOLOGIES_AND_SKILLS list - do NOT add new ones>",
      "found": <boolean>,
      "evidence": [
        {
          "file": "<relative file path>",
          "snippet": "<actual code lines, 3-10 lines showing the usage>",
          "line_start": <optional line number>,
          "line_end": <optional line number>,
          "explanation": "<brief 1 sentence explanation of why this demonstrates the technology>"
        }
      ],
      "relevance": "<high|medium|low>",
      "confidence": <number 0-100>
    }
  ],
  "skillMatches": [
    {
      "technology": "<EXACT name from EXPLICIT_TECHNOLOGIES_AND_SKILLS list - do NOT add generic skills like 'Error Handling' unless explicitly in the list>",
      "found": <boolean>,
      "evidence": [
        {
          "file": "<relative file path>",
          "snippet": "<actual code lines showing the skill>",
          "line_start": <optional line number>,
          "line_end": <optional line number>,
          "explanation": "<brief 1 sentence explanation>"
        }
      ],
      "relevance": "<high|medium|low>",
      "confidence": <number 0-100>
    }
  ],
  "summary": "<2-3 sentence summary of how well the code matches the EXTRACTED requirements${extractedRequirements.has_llm_requirement ? ', including explicit mention of LLM/AI systems experience if found' : ''}>"
}

IMPORTANT: The "technology" and "skill" fields in technologyMatches and skillMatches MUST match exactly what is in the EXPLICIT_TECHNOLOGIES_AND_SKILLS list. Do NOT create new entries.

CRITICAL INSTRUCTIONS:
1. You MUST evaluate EVERY item in the EXPLICIT_TECHNOLOGIES_AND_SKILLS list from STEP 1
2. Do NOT evaluate anything that is NOT in the EXPLICIT_TECHNOLOGIES_AND_SKILLS list
3. Do NOT add generic skills like "error handling" or "testing" unless they are explicitly in the extracted list
4. Evidence MUST include actual code snippets (3-10 lines), not just file names
5. For technologies: Look for import statements, constructor calls, API usage, framework-specific patterns
6. For skills: Look for patterns like try-catch blocks, test files, error handling, design patterns - but ONLY if that skill is in the extracted list
${extractedRequirements.has_llm_requirement ? `7. MANDATORY: You MUST check for LLM-systems experience (it's in the extracted list). Include this as a skillMatch even if found: false
8. If LLM/AI systems evidence is found, mark it as high relevance and include detailed code snippets
9. Only include matches where you found actual code evidence (found: true)
10. If a technology/skill from the extracted list is not found in code, set found: false with empty evidence array
11. Code snippets should be self-contained and clearly demonstrate the technology/skill
12. Overall score should reflect the percentage of extracted requirements demonstrated in the code, with bonus weight for LLM-systems experience
13. Only return valid JSON, no markdown formatting or additional text` : `7. Only include matches where you found actual code evidence (found: true)
8. If a technology/skill from the extracted list is not found in code, set found: false with empty evidence array
9. Code snippets should be self-contained and clearly demonstrate the technology/skill
10. Overall score reflects the percentage of extracted requirements demonstrated in the code
11. Only return valid JSON, no markdown formatting or additional text`}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Prepare code summary - get key files content (limit size for prompt)
   * Includes full file contents to allow finding code snippets throughout files
   */
  private prepareCodeSummary(extractedCode: ExtractedCode): string {
    const maxChars = 12000; // Increased limit to allow more code for snippet extraction
    let totalChars = 0;
    const summaries: string[] = [];

    // Prioritize code files over data/config files
    const codeFiles = Object.entries(extractedCode.files).filter(([path]) => {
      const ext = path.split('.').pop()?.toLowerCase();
      return !['csv', 'json', 'md', 'txt', 'gitignore', 'lock'].includes(ext || '');
    });

    // Sort by file size (larger files might be more important)
    const sortedFiles = codeFiles.sort((a, b) => b[1].length - a[1].length);

    for (const [path, content] of sortedFiles) {
      if (totalChars >= maxChars) break;

      // Include full file content if possible, or as much as we can fit
      const remaining = maxChars - totalChars;
      const preview = content.length > remaining ? content.substring(0, remaining) + '\n... (truncated)' : content;
      
      summaries.push(`\n=== File: ${path} ===\n${preview}`);
      totalChars += preview.length;
    }

    return summaries.join('\n\n') || 'No code files found';
  }

  /**
   * Build formatted job description text
   */
  private buildJobDescriptionText(jobDescription: JobDescription): string {
    const parts: string[] = [];

    if (jobDescription.company_tagline) {
      parts.push(`Company Tagline: ${jobDescription.company_tagline}`);
    }

    if (jobDescription.company_about) {
      parts.push(`About Company:\n${jobDescription.company_about}`);
    }

    if (jobDescription.full_description) {
      parts.push(`\nFull Description:\n${jobDescription.full_description}`);
    } else {
      // Fallback to individual fields if full_description not available
      if (jobDescription.requirements) {
        parts.push(`Requirements:\n${jobDescription.requirements}`);
      }
      
      if (jobDescription.skills) {
        parts.push(`Skills Required:\n${jobDescription.skills}`);
      }
    }

    if (jobDescription.benefits) {
      parts.push(`\nBenefits:\n${jobDescription.benefits}`);
    }

    if (jobDescription.experience_level) {
      parts.push(`\nExperience Level: ${jobDescription.experience_level}`);
    }

    if (jobDescription.visa_requirements) {
      parts.push(`\nVisa Requirements: ${jobDescription.visa_requirements}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Call Claude API
   */
  private async callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract text from response
      const content = message.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response type from Claude API');
    } catch (error: any) {
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key');
      }
      if (error.status === 404) {
        throw new Error(
          `Model "${this.model}" not found. Please set ANTHROPIC_MODEL environment variable to a valid model name. ` +
          `Common models: claude-3-5-sonnet-20241022, claude-3-sonnet-20240229, claude-3-opus-20240229, claude-3-haiku-20240307`
        );
      }
      throw new Error(`Claude API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Parse Claude JSON response into MatchReport
   */
  private parseClaudeResponse(response: string): MatchReport {
    try {
      // Extract JSON from response (handle markdown code blocks if present)
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and transform to MatchReport
      const transformCodeMatch = (m: any): CodeMatch => ({
        technology: String(m.technology || ''),
        found: Boolean(m.found),
        evidence: Array.isArray(m.evidence)
          ? m.evidence.map((e: any) => ({
              file: String(e.file || ''),
              snippet: String(e.snippet || ''),
              line_start: e.line_start ? Number(e.line_start) : undefined,
              line_end: e.line_end ? Number(e.line_end) : undefined,
              explanation: e.explanation ? String(e.explanation) : undefined,
            }))
          : [],
        relevance: ['high', 'medium', 'low'].includes(m.relevance) ? m.relevance : 'low',
        confidence: Number(m.confidence) || 0,
      });

      return {
        overallScore: Number(parsed.overallScore) || 0,
        technologyMatches: Array.isArray(parsed.technologyMatches)
          ? parsed.technologyMatches.map(transformCodeMatch)
          : [],
        skillMatches: Array.isArray(parsed.skillMatches)
          ? parsed.skillMatches.map(transformCodeMatch)
          : [],
        summary: String(parsed.summary || ''),
      };
    } catch (error: any) {
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }
}

