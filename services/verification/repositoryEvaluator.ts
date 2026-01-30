import Anthropic from '@anthropic-ai/sdk';
import { ExtractedCode } from './extraction';
import { JobDescription, ExtractedRequirements } from './jobMatcher';

export interface RepositoryEvaluation {
  codeQuality: {
    score: number; // 1-10
    justification: string;
  };
  completeness: {
    score: number; // 1-10
    justification: string;
  };
  engineeringPractices: {
    score: number; // 1-10
    justification: string;
  };
  complexity: {
    score: number; // 1-10
    justification: string;
  };
  originality: {
    score: number; // 1-10
    justification: string;
  };
  oneLiner: string;
  strengths: string[];
}

export interface RepositoryContext {
  project_type?: string; // user_tag, e.g., "personal project", "hackathon", "work sample"
  user_notes?: string; // what they want to highlight
}

export class RepositoryEvaluatorService {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.model = model || 'claude-sonnet-4-20250514';
  }

  /**
   * Evaluate repository code
   */
  async evaluateRepository(
    extractedCode: ExtractedCode,
    repositoryMetadata: {
      name: string;
      description: string | null;
      languages: Record<string, number> | null;
      commit_count: number;
      time_period: string;
      stars: number;
      forks: number;
    },
    context?: RepositoryContext,
    jobDescription?: JobDescription
  ): Promise<RepositoryEvaluation> {
    // Extract requirements from job description if provided
    let extractedRequirements: ExtractedRequirements | null = null;
    if (jobDescription) {
      extractedRequirements = await this.extractRequirements(jobDescription);
    }

    const { systemPrompt, userPrompt } = this.constructPrompt(
      extractedCode,
      repositoryMetadata,
      context,
      jobDescription,
      extractedRequirements
    );
    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseClaudeResponse(response);
  }

  /**
   * Extract requirements from job description (reused from jobMatcher logic)
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
   * Construct evaluation prompt
   */
  private constructPrompt(
    extractedCode: ExtractedCode,
    repositoryMetadata: {
      name: string;
      description: string | null;
      languages: Record<string, number> | null;
      commit_count: number;
      time_period: string;
      stars: number;
      forks: number;
    },
    context?: RepositoryContext,
    jobDescription?: JobDescription,
    extractedRequirements?: ExtractedRequirements | null
  ): { systemPrompt: string; userPrompt: string } {
    // If job description is provided, make evaluation JD-relevant
    const isJDRelevant = jobDescription && extractedRequirements;
    
    const systemPrompt = isJDRelevant
      ? `You are evaluating a software engineer's GitHub repository for a specific job role. Analyze the code carefully and provide scores based on how relevant the code is to the job requirements. Focus on evaluating aspects that matter for this specific role.`
      : `You are evaluating a software engineer's GitHub repository for startup hiring. Analyze the code carefully and provide scores based on the provided rubrics.`;

    // Prepare code samples
    const codeSamples = this.prepareCodeSamples(extractedCode);
    
    // Build file structure
    const fileStructure = Object.keys(extractedCode.files)
      .map((path) => {
        const depth = path.split('/').length - 1;
        const indent = '  '.repeat(depth);
        const fileName = path.split('/').pop();
        return `${indent}${fileName}`;
      })
      .join('\n');

    // Format languages
    const languagesStr = repositoryMetadata.languages
      ? Object.entries(repositoryMetadata.languages)
          .map(([lang, percent]) => `${lang} (${percent}%)`)
          .join(', ')
      : 'Not available';

    const contextSection = context
      ? `CONTEXT PROVIDED BY CANDIDATE:
- Project type: ${context.project_type || 'Not specified'}
- What they want to highlight: ${context.user_notes || 'Not specified'}

`
      : '';

    // Build JD context section if provided
    const jdSection = isJDRelevant && extractedRequirements
      ? `JOB DESCRIPTION CONTEXT:

Title: ${jobDescription!.job_title}
Company: ${jobDescription!.company_name}

EXTRACTED REQUIREMENTS:
${extractedRequirements.required.length > 0 ? `Required: ${extractedRequirements.required.join(', ')}` : 'None specified'}
${extractedRequirements.preferred.length > 0 ? `Preferred: ${extractedRequirements.preferred.join(', ')}` : 'None specified'}
${extractedRequirements.domain_context ? `Domain: ${extractedRequirements.domain_context}` : ''}

---
`
      : '';

    const userPrompt = `${jdSection}${contextSection}REPOSITORY METADATA:
- Name: ${repositoryMetadata.name}
- Description: ${repositoryMetadata.description || 'Not provided'}
- Languages: ${languagesStr}
- Commits: ${repositoryMetadata.commit_count} over ${repositoryMetadata.time_period}
- Stars: ${repositoryMetadata.stars}, Forks: ${repositoryMetadata.forks}

FILE STRUCTURE:
${fileStructure}

CODE SAMPLES:

${codeSamples}

---

${isJDRelevant ? `Evaluate this repository on the following dimensions, focusing on relevance to the job requirements above. For each, provide a score 1-10 and 1-2 sentence justification that considers how this relates to the role:

1. CODE QUALITY: Is the code clean, readable, well-structured? (Consider if code quality standards match what's needed for this role)
2. RELEVANCE TO ROLE: How well does this code demonstrate experience with the required/preferred technologies and skills from the job description?
3. ENGINEERING PRACTICES: Tests, error handling, documentation, dependency management? (Evaluate practices relevant to the role's expectations)
4. COMPLEXITY: Does this show technical depth relevant to the job requirements? (Not just complexity, but complexity that matters for this role)
5. COMPLETENESS: Does this project feel "done" and demonstrate the candidate can deliver work relevant to this role?

Then provide:
- ONE_LINER: A single sentence summary focused on relevance to the job role
- STRENGTHS: 2-3 bullet points highlighting what's impressive and relevant to the job requirements` : `Evaluate this repository on the following dimensions. For each, provide a score 1-10 and 1-2 sentence justification:

1. CODE QUALITY: Is the code clean, readable, well-structured?
2. COMPLETENESS: Does this project feel "done"? Could someone else use it?
3. ENGINEERING PRACTICES: Tests, error handling, documentation, dependency management?
4. COMPLEXITY: Is this a toy example or something with real technical depth?
5. ORIGINALITY: Does this show independent thinking or is it tutorial-following?

Then provide:
- ONE_LINER: A single sentence summary a recruiter can scan
- STRENGTHS: 2-3 bullet points on what's impressive`}

Return your response as JSON in this exact format:
${isJDRelevant ? `{
  "codeQuality": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences considering role relevance>"
  },
  "relevanceToRole": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences on how code demonstrates required/preferred skills>"
  },
  "engineeringPractices": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences on practices relevant to role>"
  },
  "complexity": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences on technical depth relevant to role>"
  },
  "completeness": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences on project completeness for role>"
  },
  "oneLiner": "<single sentence summary focused on job relevance>",
  "strengths": ["<strength 1 relevant to role>", "<strength 2 relevant to role>", "<strength 3 relevant to role>"]
}` : `{
  "codeQuality": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences>"
  },
  "completeness": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences>"
  },
  "engineeringPractices": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences>"
  },
  "complexity": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences>"
  },
  "originality": {
    "score": <number 1-10>,
    "justification": "<1-2 sentences>"
  },
  "oneLiner": "<single sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"]
}`}

Only return valid JSON, no markdown formatting or additional text.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Prepare code samples for evaluation
   */
  private prepareCodeSamples(extractedCode: ExtractedCode): string {
    const samples: string[] = [];
    const maxCharsPerFile = 3000;
    const maxTotalChars = 15000;

    // Prioritize key files
    const files = Object.entries(extractedCode.files);

    // Find README first
    const readmeFile = files.find(([path]) => 
      path.toLowerCase().includes('readme') || path.toLowerCase().includes('read.me')
    );

    if (readmeFile) {
      const content = readmeFile[1].substring(0, Math.min(maxCharsPerFile, readmeFile[1].length));
      samples.push(`=== ${readmeFile[0]} ===\n${content}`);
    }

    // Find main entry points
    const mainFiles = files.filter(([path]) => {
      const fileName = path.split('/').pop()?.toLowerCase() || '';
      return ['main.py', 'main.js', 'main.ts', 'index.js', 'index.ts', 'app.py', 'app.js', 'app.ts'].includes(fileName) ||
        fileName.startsWith('main.') || fileName.startsWith('index.') || fileName.startsWith('app.');
    });

    for (const [path, content] of mainFiles.slice(0, 3)) {
      if (samples.join('\n').length >= maxTotalChars) break;
      const preview = content.substring(0, Math.min(maxCharsPerFile, content.length));
      samples.push(`=== ${path} ===\n${preview}`);
    }

    // Find test files
    const testFiles = files.filter(([path]) => 
      path.toLowerCase().includes('test') || path.toLowerCase().includes('spec')
    );

    for (const [path, content] of testFiles.slice(0, 2)) {
      if (samples.join('\n').length >= maxTotalChars) break;
      const preview = content.substring(0, Math.min(maxCharsPerFile, content.length));
      samples.push(`=== ${path} ===\n${preview}`);
    }

    // Add other significant files
    const otherFiles = files.filter(([path]) => {
      const ext = path.split('.').pop()?.toLowerCase();
      return !['csv', 'json', 'md', 'txt', 'gitignore'].includes(ext || '') &&
        !path.toLowerCase().includes('readme') &&
        !path.toLowerCase().includes('test') &&
        !path.toLowerCase().includes('spec') &&
        !mainFiles.some(([p]) => p === path);
    });

    for (const [path, content] of otherFiles.slice(0, 5)) {
      if (samples.join('\n').length >= maxTotalChars) break;
      const preview = content.substring(0, Math.min(maxCharsPerFile, content.length));
      samples.push(`=== ${path} ===\n${preview}`);
    }

    return samples.join('\n\n') || 'No code files found';
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
   * Parse Claude JSON response
   */
  private parseClaudeResponse(response: string): RepositoryEvaluation {
    try {
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and transform
      const clampScore = (score: any): number => {
        const num = Number(score);
        return isNaN(num) ? 5 : Math.max(1, Math.min(10, Math.round(num)));
      };

      // Handle both JD-relevant format (with relevanceToRole) and general format (with originality)
      const hasRelevanceToRole = parsed.relevanceToRole !== undefined;
      
      return {
        codeQuality: {
          score: clampScore(parsed.codeQuality?.score),
          justification: String(parsed.codeQuality?.justification || ''),
        },
        completeness: {
          score: clampScore(parsed.completeness?.score),
          justification: String(parsed.completeness?.justification || ''),
        },
        engineeringPractices: {
          score: clampScore(parsed.engineeringPractices?.score),
          justification: String(parsed.engineeringPractices?.justification || ''),
        },
        complexity: {
          score: clampScore(parsed.complexity?.score),
          justification: String(parsed.complexity?.justification || ''),
        },
        // If JD-relevant format, map relevanceToRole to originality field for backward compatibility
        // Otherwise use originality directly
        originality: {
          score: hasRelevanceToRole 
            ? clampScore(parsed.relevanceToRole?.score)
            : clampScore(parsed.originality?.score),
          justification: hasRelevanceToRole
            ? String(parsed.relevanceToRole?.justification || '')
            : String(parsed.originality?.justification || ''),
        },
        oneLiner: String(parsed.oneLiner || ''),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      };
    } catch (error: any) {
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }
}

