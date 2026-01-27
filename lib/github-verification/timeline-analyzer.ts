interface WorkExperience {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
}

interface CommitActivity {
  date: string;
  count: number;
}

interface TimelineGap {
  period: string;
  resume_claim: string;
  github_activity: string;
  severity: 'high' | 'medium' | 'low';
  months_gap: number;
}

interface TimelineAnalysis {
  gaps: TimelineGap[];
  overall_consistency_score: number; // 0-100
  total_employment_months: number;
  months_with_commits: number;
  commit_rate_by_job: Array<{
    job: string;
    period: string;
    commits: number;
    months: number;
    avg_commits_per_month: number;
  }>;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  try {
    // Handle various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Get month key in format "YYYY-MM"
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const startMonth = months[start.getMonth()];
  const startYear = start.getFullYear();
  const endMonth = months[end.getMonth()];
  const endYear = end.getFullYear();

  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

/**
 * Calculate months between two dates
 */
function monthsBetween(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  return yearDiff * 12 + monthDiff + 1;
}

/**
 * Group commits by month
 */
function groupCommitsByMonth(commits: Array<{ date: string }>): Map<string, number> {
  const monthMap = new Map<string, number>();

  for (const commit of commits) {
    const date = parseDate(commit.date);
    if (!date) continue;

    const monthKey = getMonthKey(date);
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
  }

  return monthMap;
}

/**
 * Analyze timeline consistency between resume and GitHub activity
 */
export function analyzeTimeline(
  workExperience: WorkExperience[],
  commits: Array<{ date: string; repo?: string }>
): TimelineAnalysis {
  const gaps: TimelineGap[] = [];
  const commitRateByJob: Array<{
    job: string;
    period: string;
    commits: number;
    months: number;
    avg_commits_per_month: number;
  }> = [];

  // Group commits by month
  const commitsByMonth = groupCommitsByMonth(commits);

  let totalEmploymentMonths = 0;
  let monthsWithCommits = 0;

  // Analyze each job period
  for (const job of workExperience) {
    const startDate = parseDate(job.start_date);
    const endDate = parseDate(job.end_date) || new Date(); // Current job if no end date

    if (!startDate) continue;

    const jobTitle = job.title || 'Unknown Position';
    const company = job.company || 'Unknown Company';
    const jobLabel = `${jobTitle} at ${company}`;

    const months = monthsBetween(startDate, endDate);
    totalEmploymentMonths += months;

    // Count commits during this period
    let commitsInPeriod = 0;
    let monthsWithActivity = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const monthKey = getMonthKey(currentDate);
      const commitCount = commitsByMonth.get(monthKey) || 0;

      if (commitCount > 0) {
        monthsWithActivity++;
        monthsWithCommits++;
      }

      commitsInPeriod += commitCount;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate average commits per month
    const avgCommitsPerMonth = months > 0 ? commitsInPeriod / months : 0;

    commitRateByJob.push({
      job: jobLabel,
      period: formatDateRange(startDate, endDate),
      commits: commitsInPeriod,
      months,
      avg_commits_per_month: Math.round(avgCommitsPerMonth * 10) / 10,
    });

    // Check for significant gaps (3+ consecutive months with no commits)
    let gapStart: Date | null = null;
    let gapMonths = 0;
    const checkDate = new Date(startDate);

    while (checkDate <= endDate) {
      const monthKey = getMonthKey(checkDate);
      const hasCommits = (commitsByMonth.get(monthKey) || 0) > 0;

      if (!hasCommits) {
        if (!gapStart) {
          gapStart = new Date(checkDate);
        }
        gapMonths++;
      } else {
        // Gap ended
        if (gapStart && gapMonths >= 3) {
          const gapEnd = new Date(checkDate);
          gapEnd.setMonth(gapEnd.getMonth() - 1); // Last month of gap

          gaps.push({
            period: formatDateRange(gapStart, gapEnd),
            resume_claim: jobLabel,
            github_activity: `No commits found for ${gapMonths} months`,
            severity: gapMonths >= 6 ? 'high' : gapMonths >= 4 ? 'medium' : 'low',
            months_gap: gapMonths,
          });
        }
        gapStart = null;
        gapMonths = 0;
      }

      checkDate.setMonth(checkDate.getMonth() + 1);
    }

    // Check if gap extends to end of period
    if (gapStart && gapMonths >= 3) {
      gaps.push({
        period: formatDateRange(gapStart, endDate),
        resume_claim: jobLabel,
        github_activity: `No commits found for ${gapMonths} months`,
        severity: gapMonths >= 6 ? 'high' : gapMonths >= 4 ? 'medium' : 'low',
        months_gap: gapMonths,
      });
    }
  }

  // Calculate overall consistency score
  let consistencyScore = 100;

  // Penalize for gaps
  for (const gap of gaps) {
    if (gap.severity === 'high') {
      consistencyScore -= 20;
    } else if (gap.severity === 'medium') {
      consistencyScore -= 10;
    } else {
      consistencyScore -= 5;
    }
  }

  // Penalize for low overall activity rate
  if (totalEmploymentMonths > 0) {
    const activityRate = monthsWithCommits / totalEmploymentMonths;
    if (activityRate < 0.5) {
      consistencyScore -= 20; // Less than 50% of months have commits
    } else if (activityRate < 0.7) {
      consistencyScore -= 10; // Less than 70% of months have commits
    }
  }

  consistencyScore = Math.max(0, consistencyScore);

  return {
    gaps,
    overall_consistency_score: consistencyScore,
    total_employment_months: totalEmploymentMonths,
    months_with_commits: monthsWithCommits,
    commit_rate_by_job: commitRateByJob,
  };
}
