interface ProjectMatch {
  resume_project: string;
  matched_repos: any[];
  is_verified: boolean;
  top_confidence: number;
}

interface TimelineAnalysis {
  gaps: any[];
  overall_consistency_score: number;
  total_employment_months: number;
  months_with_commits: number;
  commit_rate_by_job: any[];
}

interface VerificationScore {
  overall_score: number; // 0-100
  project_score: number; // 0-40
  timeline_score: number; // 0-40
  quality_score: number; // 0-20
  breakdown: {
    projects_verified: number;
    total_projects: number;
    verification_rate: number;
    timeline_consistency: number;
    avg_code_quality: number;
  };
}

/**
 * Calculate project verification score (max 40 points)
 */
function calculateProjectScore(matches: ProjectMatch[]): {
  score: number;
  verified: number;
  total: number;
} {
  if (matches.length === 0) {
    return { score: 0, verified: 0, total: 0 };
  }

  const verifiedCount = matches.filter(m => m.is_verified).length;
  const verificationRate = verifiedCount / matches.length;

  // Award full 40 points for 100% verification, scale linearly
  const score = verificationRate * 40;

  return {
    score: Math.round(score * 10) / 10,
    verified: verifiedCount,
    total: matches.length,
  };
}

/**
 * Calculate timeline consistency score (max 40 points)
 */
function calculateTimelineScore(analysis: TimelineAnalysis): number {
  // Use the consistency score from timeline analysis (0-100)
  // Scale to 40 points
  return Math.round((analysis.overall_consistency_score / 100) * 40 * 10) / 10;
}

/**
 * Calculate code quality score from existing GitHub analyses (max 20 points)
 */
function calculateQualityScore(codeAnalyses: Array<{ overall_score?: number }>): number {
  if (!codeAnalyses || codeAnalyses.length === 0) {
    // No code analyses available, give neutral score
    return 10; // 50% of 20 points
  }

  // Calculate average quality score
  const validScores = codeAnalyses
    .map(a => a.overall_score)
    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 100);

  if (validScores.length === 0) {
    return 10; // Neutral score
  }

  const avgQuality = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;

  // Scale from 0-100 to 0-20
  return Math.round((avgQuality / 100) * 20 * 10) / 10;
}

/**
 * Calculate overall verification score
 */
export function calculateVerificationScore(
  projectMatches: ProjectMatch[],
  timelineAnalysis: TimelineAnalysis,
  codeAnalyses: Array<{ overall_score?: number }> = []
): VerificationScore {
  const projectResult = calculateProjectScore(projectMatches);
  const timelineScore = calculateTimelineScore(timelineAnalysis);
  const qualityScore = calculateQualityScore(codeAnalyses);

  const overallScore = projectResult.score + timelineScore + qualityScore;

  return {
    overall_score: Math.round(overallScore),
    project_score: projectResult.score,
    timeline_score: timelineScore,
    quality_score: qualityScore,
    breakdown: {
      projects_verified: projectResult.verified,
      total_projects: projectResult.total,
      verification_rate: projectResult.total > 0
        ? Math.round((projectResult.verified / projectResult.total) * 100) / 100
        : 0,
      timeline_consistency: timelineAnalysis.overall_consistency_score,
      avg_code_quality: codeAnalyses.length > 0
        ? Math.round(
            (codeAnalyses
              .map(a => a.overall_score || 50)
              .reduce((sum, score) => sum + score, 0) / codeAnalyses.length)
          )
        : 50,
    },
  };
}

/**
 * Get score interpretation and color
 */
export function getScoreInterpretation(score: number): {
  label: string;
  color: 'green' | 'yellow' | 'red';
  description: string;
} {
  if (score >= 80) {
    return {
      label: 'Verified',
      color: 'green',
      description: 'Strong match between resume and GitHub activity',
    };
  } else if (score >= 60) {
    return {
      label: 'Review Required',
      color: 'yellow',
      description: 'Some discrepancies found, manual review recommended',
    };
  } else {
    return {
      label: 'Major Concerns',
      color: 'red',
      description: 'Significant discrepancies between resume and GitHub',
    };
  }
}
