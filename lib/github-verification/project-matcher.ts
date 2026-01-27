interface ResumeProject {
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
  start_date?: string;
  end_date?: string;
}

interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  description?: string;
  language?: string;
  languages?: string[];
  html_url: string;
  created_at: string;
}

interface ProjectMatch {
  resume_project: string;
  matched_repos: Array<{
    repo: string;
    repo_name: string;
    confidence: number;
    match_reasons: string[];
  }>;
  is_verified: boolean;
  top_confidence: number;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy string matching
 */
/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  // Ensure inputs are strings
  const s1 = String(str1 || '').toLowerCase();
  const s2 = String(str2 || '').toLowerCase();

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // Ensure we're working with strings
  const s1 = String(str1);
  const s2 = String(str2);

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  if (maxLength === 0) return 1;

  return 1 - (distance / maxLength);
}

/**
 * Normalize a string for comparison by removing special chars, converting to lowercase
 */
function normalizeString(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[_\-\s]+/g, ' ') // Convert underscores, dashes, and spaces to single space
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .trim();
}

/**
 * Split a string into tokens (words)
 */
function tokenize(str: string): string[] {
  return normalizeString(str).split(/\s+/).filter(Boolean);
}

/**
 * Extract potential acronym from a phrase
 * E.g., "Machine Learning Operations" -> "MLO"
 */
function extractAcronym(phrase: string): string {
  const words = tokenize(phrase);
  return words.map(w => w[0]).join('').toUpperCase();
}

/**
 * Token-based similarity: measures overlap of word tokens
 */
function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // Count matching tokens
  let matches = 0;
  const used = new Set<number>();

  for (const token1 of tokens1) {
    for (let i = 0; i < tokens2.length; i++) {
      if (used.has(i)) continue;
      const token2 = tokens2[i];

      // Exact match or very similar
      if (token1 === token2 || stringSimilarity(token1, token2) > 0.85) {
        matches++;
        used.add(i);
        break;
      }
    }
  }

  // Jaccard similarity: intersection / union
  const union = tokens1.length + tokens2.length - matches;
  return union > 0 ? matches / union : 0;
}

/**
 * Check if one string is an acronym of another
 */
function isAcronymMatch(str1: string, str2: string): boolean {
  const acronym1 = extractAcronym(str1);
  const acronym2 = extractAcronym(str2);
  const normalized1 = normalizeString(str1).replace(/\s/g, '');
  const normalized2 = normalizeString(str2).replace(/\s/g, '');

  // Check if either string is an acronym of the other
  return (
    (acronym1.length > 2 && acronym1 === normalized2) ||
    (acronym2.length > 2 && acronym2 === normalized1) ||
    (acronym1 === acronym2 && acronym1.length > 2)
  );
}

/**
 * Enhanced string matching combining multiple strategies
 */
function enhancedStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // Exact match (case-insensitive, ignoring separators)
  const normalized1 = normalizeString(str1).replace(/\s/g, '');
  const normalized2 = normalizeString(str2).replace(/\s/g, '');
  if (normalized1 === normalized2) return 1.0;

  // Acronym match
  if (isAcronymMatch(str1, str2)) return 0.85;

  // Substring match (one contains the other)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const shorterLength = Math.min(normalized1.length, normalized2.length);
    const longerLength = Math.max(normalized1.length, normalized2.length);
    return 0.7 + (0.2 * (shorterLength / longerLength));
  }

  // Token-based similarity (70% weight) + Character-based similarity (30% weight)
  const tokenScore = tokenSimilarity(str1, str2);
  const charScore = stringSimilarity(str1, str2);

  return (tokenScore * 0.7) + (charScore * 0.3);
}

/**
 * Calculate technology overlap between resume and repo
 */
function calculateTechOverlap(
  resumeTechs: string[] | undefined,
  repoLanguages: string[] | undefined
): number {
  if (!resumeTechs || !repoLanguages || resumeTechs.length === 0 || repoLanguages.length === 0) {
    return 0;
  }

  // Ensure safer mapping and normalize
  const resumeTechsNormalized = resumeTechs
    .map(t => normalizeString(String(t || '')))
    .filter(Boolean);
  const repoLanguagesNormalized = repoLanguages
    .map(l => normalizeString(String(l || '')))
    .filter(Boolean);

  let matches = 0;
  let partialMatches = 0;

  for (const tech of resumeTechsNormalized) {
    let bestMatch = 0;

    for (const lang of repoLanguagesNormalized) {
      // Exact match
      if (tech === lang) {
        bestMatch = 1.0;
        break;
      }

      // Substring match
      if (tech.includes(lang) || lang.includes(tech)) {
        bestMatch = Math.max(bestMatch, 0.8);
        continue;
      }

      // Fuzzy match with enhanced similarity
      const similarity = enhancedStringSimilarity(tech, lang);
      if (similarity > 0.75) {
        bestMatch = Math.max(bestMatch, similarity * 0.9);
      }
    }

    if (bestMatch >= 0.9) {
      matches++;
    } else if (bestMatch >= 0.5) {
      partialMatches++;
    }
  }

  // Full matches count as 1.0, partial matches count as 0.5
  const totalScore = matches + (partialMatches * 0.5);
  return totalScore / resumeTechs.length;
}

/**
 * Check if URLs match (exact match)
 */
/**
 * Check if URLs match (exact match)
 */
function urlMatch(resumeLink: string | undefined, repoUrl: string): boolean {
  if (!resumeLink) return false;

  const normalizedResume = String(resumeLink).toLowerCase().replace(/\/$/, '');
  const normalizedRepo = String(repoUrl || '').toLowerCase().replace(/\/$/, '');

  return normalizedResume === normalizedRepo;
}

/**
 * Calculate match score between a resume project and GitHub repo
 */
function calculateMatchScore(
  project: ResumeProject,
  repo: GitHubRepo
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Link match (if exists, it's definitive - 100% match)
  if (urlMatch(project.link, repo.html_url)) {
    score = 1.0;
    reasons.push('url_match');
    return { score, reasons };
  }

  // 2. Name similarity (50% weight) - increased from 40%
  const nameSimilarity = enhancedStringSimilarity(project.name, repo.name);
  score += nameSimilarity * 0.5;

  // Add reason with confidence level
  if (nameSimilarity > 0.85) {
    reasons.push('strong_name_match');
  } else if (nameSimilarity > 0.65) {
    reasons.push('name_match');
  } else if (nameSimilarity > 0.45) {
    reasons.push('partial_name_match');
  }

  // 3. Technology overlap (35% weight) - increased from 30%
  let repoLangs: string[] = [];
  if (Array.isArray(repo.languages)) {
    repoLangs = repo.languages;
  } else if (typeof repo.languages === 'object' && repo.languages !== null) {
    repoLangs = Object.keys(repo.languages);
  } else if (repo.language) {
    repoLangs = [repo.language];
  }

  const techOverlap = calculateTechOverlap(
    project.technologies,
    repoLangs
  );
  score += techOverlap * 0.35;

  if (techOverlap > 0.7) {
    reasons.push('strong_technology_match');
  } else if (techOverlap > 0.4) {
    reasons.push('technology_match');
  }

  // 4. Description similarity (15% weight) - decreased from 20%
  if (project.description && repo.description) {
    const descSimilarity = enhancedStringSimilarity(project.description, repo.description);
    score += descSimilarity * 0.15;
    if (descSimilarity > 0.5) {
      reasons.push('description_match');
    }
  }

  return { score, reasons };
}

/**
 * Match resume projects to GitHub repositories
 *
 * Confidence thresholds:
 * - 0.75+: High confidence match (auto-verify)
 * - 0.55-0.74: Good match (likely correct)
 * - 0.35-0.54: Moderate match (requires review)
 * - Below 0.35: Low confidence (filtered out)
 */
export function matchProjects(
  resumeProjects: ResumeProject[],
  githubRepos: GitHubRepo[]
): ProjectMatch[] {
  const matches: ProjectMatch[] = [];

  for (const project of resumeProjects) {
    // Calculate scores for all repos
    const repoScores = githubRepos.map(repo => {
      const { score, reasons } = calculateMatchScore(project, repo);
      return {
        repo: repo.html_url,
        repo_name: repo.name,
        confidence: Math.round(score * 100) / 100,
        match_reasons: reasons,
      };
    });

    // Sort by confidence and take top 3 matches above lower threshold
    const topMatches = repoScores
      .filter(m => m.confidence > 0.35) // Lowered from 0.3 for better filtering
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    const topConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;

    matches.push({
      resume_project: project.name,
      matched_repos: topMatches,
      is_verified: topConfidence > 0.55, // Lowered from 0.6 for more lenient auto-verification
      top_confidence: topConfidence,
    });
  }

  return matches;
}

/**
 * Identify projects that couldn't be verified
 */
export function findDiscrepancies(matches: ProjectMatch[]): Array<{
  project_name: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}> {
  const discrepancies: Array<{
    project_name: string;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  for (const match of matches) {
    if (!match.is_verified) {
      if (match.matched_repos.length === 0) {
        // No matches found at all
        discrepancies.push({
          project_name: match.resume_project,
          issue: 'No matching GitHub repository found',
          severity: 'high',
        });
      } else {
        // Low confidence matches
        discrepancies.push({
          project_name: match.resume_project,
          issue: `Low confidence match (${Math.round(match.top_confidence * 100)}%)`,
          severity: 'medium',
        });
      }
    }
  }

  return discrepancies;
}
