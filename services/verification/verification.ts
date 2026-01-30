import { Commit, CommitDetail } from './github';
import { RepositoryEvaluation } from './repositoryEvaluator';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SkillLevel = 'junior' | 'mid' | 'senior';

export interface ActivityWindowResult {
  passed: boolean;
  totalCommits: number;
  monthsWithActivity: number;
  avgCommitsPerMonth: number;
  details: string;
  commitsByMonth: Record<string, number>;
}

export interface ProjectMeaningfulnessScore {
  repositoryId: string;
  name: string;
  score: number; // 0-100
  qualifies: boolean;
  breakdown: {
    complexity: number;
    completeness: number;
    engineeringPractices: number;
    iterativeDevelopment: number;
    originality: number;
  };
  reasons: string[];
}

export interface MeaningfulProjectsResult {
  minimumCount: number;
  projectScores: ProjectMeaningfulnessScore[];
  qualifiedProjects: ProjectMeaningfulnessScore[];
  passed: boolean;
  details: string;
}

export interface DebuggingEvidenceResult {
  refactoringCommits: number;
  bugFixCommits: number;
  iterativePatterns: boolean;
  passed: boolean;
  examples: string[];
  totalAnalyzed: number;
}

export interface CodeMaintainabilityResult {
  readabilityScore: number;
  structureScore: number;
  passed: boolean;
  concerns: string[];
  strengths: string[];
}

export interface AssessmentAlignmentResult {
  githubSkillLevel: SkillLevel;
  assessmentSkillLevel: SkillLevel;
  aligned: boolean;
  discrepancies: string[];
  details: string;
}

export interface VerificationCriteria {
  activityWindow: ActivityWindowResult;
  meaningfulProjects: MeaningfulProjectsResult;
  debuggingEvidence: DebuggingEvidenceResult;
  codeMaintainability: CodeMaintainabilityResult;
  assessmentAlignment: AssessmentAlignmentResult;
}

export interface VerificationResult {
  candidateId: string;
  verificationStatus: 'passed' | 'failed' | 'pending';
  criteria: VerificationCriteria;
  totalCriteriaPassed: number;
  totalCriteriaChecked: number;
  verificationNotes: string;
  verifiedAt: Date;
}

export interface RepositoryData {
  id: string;
  name: string;
  commits: Commit[];
  commitDetails?: CommitDetail[];
  evaluation: RepositoryEvaluation;
  metadata: {
    created_at: string;
    updated_at: string;
    commit_count: number;
  };
}

export interface AssessmentData {
  skillLevel?: SkillLevel;
  technicalScore?: number;
  codingScore?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEBUGGING_PATTERNS = [
  /\b(fix|fixed|fixes|fixing)\b/i,
  /\b(bug|bugs|bugfix)\b/i,
  /\b(issue|issues)\b/i,
  /\b(resolve|resolved|resolves|resolving)\b/i,
  /\b(debug|debugging|debugged)\b/i,
  /\b(patch|hotfix|quickfix)\b/i,
  /\b(error|errors)\b/i,
];

const REFACTORING_PATTERNS = [
  /\b(refactor|refactored|refactoring)\b/i,
  /\b(cleanup|clean up|cleaned up)\b/i,
  /\b(improve|improved|improvement|improving)\b/i,
  /\b(optimize|optimized|optimization|optimizing)\b/i,
  /\b(reorganize|restructure|restructured)\b/i,
  /\b(simplify|simplified)\b/i,
  /\b(rewrite|rewrote|rewritten)\b/i,
];

const VERIFICATION_THRESHOLDS = {
  activityWindow: {
    minimumMonths: 18,
    minimumCommitsPerMonth: 4,
    minimumActiveMonths: 12, // At least 12 months with commits
  },
  meaningfulProjects: {
    minimumCount: 2,
    qualificationScore: 60, // Out of 100
    minimumCommits: 20,
    minimumDurationDays: 14,
  },
  debuggingEvidence: {
    minimumBugFixes: 5,
    minimumRefactorings: 3,
  },
  codeMaintainability: {
    minimumCodeQuality: 6,
    minimumEngineeringPractices: 5,
  },
};

// ============================================================================
// Verification Service
// ============================================================================

export class VerificationService {
  /**
   * Run comprehensive verification for a candidate
   */
  async verifyCandidateGitHub(
    candidateId: string,
    repositories: RepositoryData[],
    assessmentData?: AssessmentData
  ): Promise<VerificationResult> {
    // 1. Verify activity window (18 months)
    const allCommits = repositories.flatMap((r) => r.commits);
    const activityWindow = this.verifyActivityWindow(allCommits);

    // 2. Identify meaningful projects
    const meaningfulProjects = this.identifyMeaningfulProjects(repositories);

    // 3. Detect debugging and refactoring evidence
    const debuggingEvidence = this.detectDebuggingEvidence(allCommits);

    // 4. Assess code maintainability
    const codeMaintainability = this.assessCodeMaintainability(
      repositories.map((r) => r.evaluation)
    );

    // 5. Compare with assessment (if available)
    const assessmentAlignment = this.compareWithAssessment(
      repositories,
      assessmentData
    );

    // Calculate overall status
    const criteria: VerificationCriteria = {
      activityWindow,
      meaningfulProjects,
      debuggingEvidence,
      codeMaintainability,
      assessmentAlignment,
    };

    const criteriaPassed = [
      activityWindow.passed,
      meaningfulProjects.passed,
      debuggingEvidence.passed,
      codeMaintainability.passed,
      assessmentAlignment.aligned,
    ];

    const totalPassed = criteriaPassed.filter(Boolean).length;
    const totalChecked = criteriaPassed.length;

    // Require all 5 criteria to pass
    const verificationStatus: 'passed' | 'failed' = totalPassed === totalChecked ? 'passed' : 'failed';

    const verificationNotes = this.generateVerificationNotes(criteria, verificationStatus);

    return {
      candidateId,
      verificationStatus,
      criteria,
      totalCriteriaPassed: totalPassed,
      totalCriteriaChecked: totalChecked,
      verificationNotes,
      verifiedAt: new Date(),
    };
  }

  /**
   * Verify activity window - Active contributor over 18 months
   */
  verifyActivityWindow(
    commits: Commit[],
    windowMonths: number = VERIFICATION_THRESHOLDS.activityWindow.minimumMonths
  ): ActivityWindowResult {
    if (commits.length === 0) {
      return {
        passed: false,
        totalCommits: 0,
        monthsWithActivity: 0,
        avgCommitsPerMonth: 0,
        details: 'No commits found',
        commitsByMonth: {},
      };
    }

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - windowMonths);

    // Filter commits within window
    const recentCommits = commits.filter((c) => {
      const commitDate = new Date(c.commit.author.date);
      return commitDate >= cutoffDate && commitDate <= now;
    });

    // Group by month
    const commitsByMonth = this.groupCommitsByMonth(recentCommits);
    const monthsWithActivity = Object.keys(commitsByMonth).length;
    const avgCommitsPerMonth = recentCommits.length / windowMonths;

    const passed =
      monthsWithActivity >= VERIFICATION_THRESHOLDS.activityWindow.minimumActiveMonths &&
      avgCommitsPerMonth >= VERIFICATION_THRESHOLDS.activityWindow.minimumCommitsPerMonth;

    const details = `${recentCommits.length} commits over ${monthsWithActivity} active months (${avgCommitsPerMonth.toFixed(1)} commits/month avg)`;

    return {
      passed,
      totalCommits: recentCommits.length,
      monthsWithActivity,
      avgCommitsPerMonth,
      details,
      commitsByMonth,
    };
  }

  /**
   * Identify meaningful projects - 2+ projects with iterative development
   */
  identifyMeaningfulProjects(repositories: RepositoryData[]): MeaningfulProjectsResult {
    const projectScores: ProjectMeaningfulnessScore[] = repositories.map((repo) => {
      return this.scoreMeaningfulness(repo);
    });

    const qualifiedProjects = projectScores.filter((p) => p.qualifies);
    const passed = qualifiedProjects.length >= VERIFICATION_THRESHOLDS.meaningfulProjects.minimumCount;

    const details = `Found ${qualifiedProjects.length} meaningful projects (need ${VERIFICATION_THRESHOLDS.meaningfulProjects.minimumCount})`;

    return {
      minimumCount: VERIFICATION_THRESHOLDS.meaningfulProjects.minimumCount,
      projectScores,
      qualifiedProjects,
      passed,
      details,
    };
  }

  /**
   * Score a repository for meaningfulness
   */
  private scoreMeaningfulness(repo: RepositoryData): ProjectMeaningfulnessScore {
    const evaluation = repo.evaluation;
    let score = 0;
    const reasons: string[] = [];

    // Complexity (25 points)
    const complexityPoints = (evaluation.complexity.score / 10) * 25;
    score += complexityPoints;
    if (evaluation.complexity.score >= 6) {
      reasons.push(`Good complexity (${evaluation.complexity.score}/10)`);
    }

    // Completeness (25 points)
    const completenessPoints = (evaluation.completeness.score / 10) * 25;
    score += completenessPoints;
    if (evaluation.completeness.score >= 6) {
      reasons.push(`Well-completed project (${evaluation.completeness.score}/10)`);
    }

    // Engineering practices (20 points)
    const engineeringPoints = (evaluation.engineeringPractices.score / 10) * 20;
    score += engineeringPoints;
    if (evaluation.engineeringPractices.score >= 5) {
      reasons.push(`Good engineering practices (${evaluation.engineeringPractices.score}/10)`);
    }

    // Iterative development (15 points)
    const iterationScore = this.calculateIterationScore(repo);
    score += iterationScore * 15;
    if (iterationScore > 0.6) {
      reasons.push('Shows iterative development');
    }

    // Originality (15 points)
    const originalityPoints = (evaluation.originality.score / 10) * 15;
    score += originalityPoints;
    if (evaluation.originality.score >= 6) {
      reasons.push(`Original work (${evaluation.originality.score}/10)`);
    }

    const finalScore = Math.round(score);
    const qualifies = finalScore >= VERIFICATION_THRESHOLDS.meaningfulProjects.qualificationScore;

    if (!qualifies) {
      if (evaluation.complexity.score < 6) reasons.push('Low complexity');
      if (evaluation.completeness.score < 6) reasons.push('Incomplete project');
      if (iterationScore < 0.6) reasons.push('Limited iterative development');
    }

    return {
      repositoryId: repo.id,
      name: repo.name,
      score: finalScore,
      qualifies,
      breakdown: {
        complexity: complexityPoints,
        completeness: completenessPoints,
        engineeringPractices: engineeringPoints,
        iterativeDevelopment: iterationScore * 15,
        originality: originalityPoints,
      },
      reasons,
    };
  }

  /**
   * Calculate iteration score based on commit patterns
   */
  private calculateIterationScore(repo: RepositoryData): number {
    const commits = repo.commits;
    const metadata = repo.metadata;

    if (commits.length < VERIFICATION_THRESHOLDS.meaningfulProjects.minimumCommits) {
      return 0;
    }

    // Check time span
    const dates = commits.map((c) => new Date(c.commit.author.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const durationDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

    if (durationDays < VERIFICATION_THRESHOLDS.meaningfulProjects.minimumDurationDays) {
      return 0.3; // Weekend hack, not iterative
    }

    // Score based on commit distribution over time
    let score = 0.5; // Base score for meeting minimum requirements

    // Bonus for longer development period
    if (durationDays > 30) score += 0.2;
    if (durationDays > 90) score += 0.2;

    // Bonus for more commits (shows iteration)
    if (commits.length > 50) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Detect debugging and refactoring evidence
   */
  detectDebuggingEvidence(commits: Commit[]): DebuggingEvidenceResult {
    let bugFixCommits = 0;
    let refactoringCommits = 0;
    const examples: string[] = [];

    for (const commit of commits) {
      const message = commit.commit.message;

      // Check for bug fixes
      const isBugFix = DEBUGGING_PATTERNS.some((pattern) => pattern.test(message));
      if (isBugFix) {
        bugFixCommits++;
        if (examples.length < 5) {
          examples.push(`Bug fix: "${message.split('\n')[0].substring(0, 80)}"`);
        }
      }

      // Check for refactoring
      const isRefactoring = REFACTORING_PATTERNS.some((pattern) => pattern.test(message));
      if (isRefactoring) {
        refactoringCommits++;
        if (examples.length < 5) {
          examples.push(`Refactor: "${message.split('\n')[0].substring(0, 80)}"`);
        }
      }
    }

    const iterativePatterns = bugFixCommits > 0 && refactoringCommits > 0;

    const passed =
      bugFixCommits >= VERIFICATION_THRESHOLDS.debuggingEvidence.minimumBugFixes &&
      refactoringCommits >= VERIFICATION_THRESHOLDS.debuggingEvidence.minimumRefactorings;

    return {
      refactoringCommits,
      bugFixCommits,
      iterativePatterns,
      passed,
      examples,
      totalAnalyzed: commits.length,
    };
  }

  /**
   * Assess code maintainability across all repositories
   */
  assessCodeMaintainability(evaluations: RepositoryEvaluation[]): CodeMaintainabilityResult {
    if (evaluations.length === 0) {
      return {
        readabilityScore: 0,
        structureScore: 0,
        passed: false,
        concerns: ['No repositories evaluated'],
        strengths: [],
      };
    }

    // Average scores across all repositories
    const avgCodeQuality =
      evaluations.reduce((sum, e) => sum + e.codeQuality.score, 0) / evaluations.length;
    const avgEngineeringPractices =
      evaluations.reduce((sum, e) => sum + e.engineeringPractices.score, 0) / evaluations.length;

    const passed =
      avgCodeQuality >= VERIFICATION_THRESHOLDS.codeMaintainability.minimumCodeQuality &&
      avgEngineeringPractices >= VERIFICATION_THRESHOLDS.codeMaintainability.minimumEngineeringPractices;

    const concerns: string[] = [];
    const strengths: string[] = [];

    if (avgCodeQuality < VERIFICATION_THRESHOLDS.codeMaintainability.minimumCodeQuality) {
      concerns.push(`Code quality below threshold (${avgCodeQuality.toFixed(1)}/10)`);
    } else {
      strengths.push(`Good code quality (${avgCodeQuality.toFixed(1)}/10)`);
    }

    if (avgEngineeringPractices < VERIFICATION_THRESHOLDS.codeMaintainability.minimumEngineeringPractices) {
      concerns.push(`Engineering practices below threshold (${avgEngineeringPractices.toFixed(1)}/10)`);
    } else {
      strengths.push(`Solid engineering practices (${avgEngineeringPractices.toFixed(1)}/10)`);
    }

    // Collect common concerns from evaluations
    const allConcerns = evaluations.flatMap((e) => {
      const c: string[] = [];
      if (e.codeQuality.score < 6) c.push(e.codeQuality.justification);
      if (e.engineeringPractices.score < 5) c.push(e.engineeringPractices.justification);
      return c;
    });

    return {
      readabilityScore: avgCodeQuality,
      structureScore: avgEngineeringPractices,
      passed,
      concerns: [...new Set([...concerns, ...allConcerns.slice(0, 3)])],
      strengths: [...new Set(strengths)],
    };
  }

  /**
   * Compare GitHub behavior with assessment performance
   */
  compareWithAssessment(
    repositories: RepositoryData[],
    assessmentData?: AssessmentData
  ): AssessmentAlignmentResult {
    // Determine GitHub skill level
    const githubSkillLevel = this.determineGitHubSkillLevel(repositories);

    // If no assessment data, we can't compare
    if (!assessmentData || !assessmentData.skillLevel) {
      return {
        githubSkillLevel,
        assessmentSkillLevel: 'mid', // Default assumption
        aligned: true, // Can't fail if we don't have data
        discrepancies: ['No assessment data available for comparison'],
        details: `GitHub skill level: ${githubSkillLevel}. No assessment data to compare.`,
      };
    }

    const assessmentSkillLevel = assessmentData.skillLevel;
    const aligned = this.checkSkillLevelAlignment(githubSkillLevel, assessmentSkillLevel);

    const discrepancies: string[] = [];
    if (!aligned) {
      discrepancies.push(
        `GitHub shows ${githubSkillLevel} level, but assessment shows ${assessmentSkillLevel} level`
      );
    }

    const details = aligned
      ? `Skill levels align: GitHub (${githubSkillLevel}) matches assessment (${assessmentSkillLevel})`
      : `Skill level mismatch: GitHub (${githubSkillLevel}) vs assessment (${assessmentSkillLevel})`;

    return {
      githubSkillLevel,
      assessmentSkillLevel,
      aligned,
      discrepancies,
      details,
    };
  }

  /**
   * Determine skill level from GitHub repositories
   */
  private determineGitHubSkillLevel(repositories: RepositoryData[]): SkillLevel {
    if (repositories.length === 0) return 'junior';

    const evaluations = repositories.map((r) => r.evaluation);
    const avgCodeQuality =
      evaluations.reduce((sum, e) => sum + e.codeQuality.score, 0) / evaluations.length;
    const avgComplexity =
      evaluations.reduce((sum, e) => sum + e.complexity.score, 0) / evaluations.length;

    const avgScore = (avgCodeQuality + avgComplexity) / 2;

    // Count meaningful projects
    const meaningfulProjects = repositories.filter((repo) => {
      const score = this.scoreMeaningfulness(repo);
      return score.qualifies;
    }).length;

    if (avgScore >= 8 && meaningfulProjects >= 3) return 'senior';
    if (avgScore >= 6 && meaningfulProjects >= 2) return 'mid';
    return 'junior';
  }

  /**
   * Check if skill levels are aligned (allow 1 level difference)
   */
  private checkSkillLevelAlignment(githubLevel: SkillLevel, assessmentLevel: SkillLevel): boolean {
    const levels: SkillLevel[] = ['junior', 'mid', 'senior'];
    const githubIndex = levels.indexOf(githubLevel);
    const assessmentIndex = levels.indexOf(assessmentLevel);

    // Allow 1 level difference
    return Math.abs(githubIndex - assessmentIndex) <= 1;
  }

  /**
   * Group commits by month (YYYY-MM format)
   */
  private groupCommitsByMonth(commits: Commit[]): Record<string, number> {
    const byMonth: Record<string, number> = {};

    for (const commit of commits) {
      const date = new Date(commit.commit.author.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    }

    return byMonth;
  }

  /**
   * Generate human-readable verification notes
   */
  private generateVerificationNotes(
    criteria: VerificationCriteria,
    status: 'passed' | 'failed'
  ): string {
    const notes: string[] = [];

    notes.push(`Verification ${status.toUpperCase()}`);
    notes.push('');

    // Activity window
    notes.push(
      `✓ Activity Window: ${criteria.activityWindow.passed ? 'PASS' : 'FAIL'} - ${criteria.activityWindow.details}`
    );

    // Meaningful projects
    notes.push(
      `✓ Meaningful Projects: ${criteria.meaningfulProjects.passed ? 'PASS' : 'FAIL'} - ${criteria.meaningfulProjects.details}`
    );

    // Debugging evidence
    notes.push(
      `✓ Debugging Evidence: ${criteria.debuggingEvidence.passed ? 'PASS' : 'FAIL'} - ${criteria.debuggingEvidence.bugFixCommits} bug fixes, ${criteria.debuggingEvidence.refactoringCommits} refactorings`
    );

    // Code maintainability
    notes.push(
      `✓ Code Maintainability: ${criteria.codeMaintainability.passed ? 'PASS' : 'FAIL'} - Quality: ${criteria.codeMaintainability.readabilityScore.toFixed(1)}/10, Engineering: ${criteria.codeMaintainability.structureScore.toFixed(1)}/10`
    );

    // Assessment alignment
    notes.push(
      `✓ Assessment Alignment: ${criteria.assessmentAlignment.aligned ? 'PASS' : 'FAIL'} - ${criteria.assessmentAlignment.details}`
    );

    return notes.join('\n');
  }
}
