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
 * Calculate technology overlap between resume and repo
 */
function calculateTechOverlap(
  resumeTechs: string[] | undefined,
  repoLanguages: string[] | undefined
): number {
  if (!resumeTechs || !repoLanguages || resumeTechs.length === 0 || repoLanguages.length === 0) {
    return 0;
  }

  // Ensure safer mapping
  const resumeTechsLower = resumeTechs.map(t => String(t || '').toLowerCase()).filter(Boolean);
  const repoLanguagesLower = repoLanguages.map(l => String(l || '').toLowerCase()).filter(Boolean);

  let matches = 0;
  for (const tech of resumeTechsLower) {
    for (const lang of repoLanguagesLower) {
      // Fuzzy match for technology names
      if (tech.includes(lang) || lang.includes(tech) || stringSimilarity(tech, lang) > 0.8) {
        matches++;
        break;
      }
    }
  }

  return matches / resumeTechs.length;
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

  // 1. Name similarity (40% weight)
  const nameSimilarity = stringSimilarity(project.name, repo.name);
  score += nameSimilarity * 0.4;
  if (nameSimilarity > 0.6) {
    reasons.push('name_match');
  }

  // 2. Technology overlap (30% weight)
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
  score += techOverlap * 0.3;
  if (techOverlap > 0.5) {
    reasons.push('technology_match');
  }

  // 3. Description similarity (20% weight)
  if (project.description && repo.description) {
    const descSimilarity = stringSimilarity(project.description, repo.description);
    score += descSimilarity * 0.2;
    if (descSimilarity > 0.5) {
      reasons.push('description_match');
    }
  }

  // 4. Link match (10% weight)
  if (urlMatch(project.link, repo.html_url)) {
    score += 0.1;
    reasons.push('url_match');
  }

  return { score, reasons };
}

/**
 * Match resume projects to GitHub repositories
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

    // Sort by confidence and take top 3 matches above threshold
    const topMatches = repoScores
      .filter(m => m.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    const topConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;

    matches.push({
      resume_project: project.name,
      matched_repos: topMatches,
      is_verified: topConfidence > 0.6,
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
