import { GitHubService, CommitDetail } from './github';
import { VelocityMetrics } from './velocity';

export interface ExtractedCode {
  repo: string;
  github_username: string;
  files: Record<string, string>;
  metadata: {
    total_commits: number;
    total_lines_added: number;
    files_count: number;
    date_range: {
      first_commit: string | null;
      last_commit: string | null;
    };
  };
  velocity?: VelocityMetrics;  // Ship speed metrics (optional, added during extraction)
}

export class ExtractionService {
  /**
   * Parse patch string and extract only added lines (starting with +)
   * Filters out patch headers (+++, @@) and context lines
   */
  private parsePatch(patch: string | null): string {
    if (!patch) {
      return '';
    }

    const lines = patch.split('\n');
    const extractedLines: string[] = [];

    for (const line of lines) {
      // Skip patch headers and context lines
      if (line.startsWith('+++') || line.startsWith('@@') || line.startsWith('---')) {
        continue;
      }

      // Only include added lines (starting with +)
      if (line.startsWith('+') && !line.startsWith('++')) {
        // Remove the + prefix to get the actual code
        extractedLines.push(line.substring(1));
      }
    }

    return extractedLines.join('\n');
  }

  /**
   * Extract code from commit details by parsing patches
   */
  extractCodeFromCommits(
    commits: CommitDetail[],
    githubUsername: string,
    repoFullName: string
  ): ExtractedCode {
    const files: Record<string, string> = {};
    let totalLinesAdded = 0;
    let firstCommitDate: string | null = null;
    let lastCommitDate: string | null = null;

    for (const commit of commits) {
      const commitDate = commit.commit.author.date;

      // Track date range
      if (!firstCommitDate || commitDate < firstCommitDate) {
        firstCommitDate = commitDate;
      }
      if (!lastCommitDate || commitDate > lastCommitDate) {
        lastCommitDate = commitDate;
      }

      // Process each file in the commit
      for (const file of commit.files) {
        // Only process files with patches (added/modified files)
        if (!file.patch || file.status === 'removed') {
          continue;
        }

        // Parse patch to extract added lines
        const extractedCode = this.parsePatch(file.patch);

        if (extractedCode.trim().length > 0) {
          // Accumulate code by file path
          if (!files[file.filename]) {
            files[file.filename] = '';
          }

          // Add extracted code with a separator
          if (files[file.filename].length > 0) {
            files[file.filename] += '\n\n';
          }
          files[file.filename] += extractedCode;

          // Count lines added (approximate)
          totalLinesAdded += extractedCode.split('\n').filter((line) => line.trim().length > 0).length;
        }
      }
    }

    return {
      repo: repoFullName,
      github_username: githubUsername,
      files,
      metadata: {
        total_commits: commits.length,
        total_lines_added: totalLinesAdded,
        files_count: Object.keys(files).length,
        date_range: {
          first_commit: firstCommitDate,
          last_commit: lastCommitDate,
        },
      },
    };
  }

  /**
   * Main extraction method that orchestrates the process
   */
  async extractCode(
    githubService: GitHubService,
    owner: string,
    repo: string,
    githubUsername: string
  ): Promise<ExtractedCode> {
    // Fetch all commits by the author
    const commits = await githubService.getCommitsByAuthor(
      owner,
      repo,
      githubUsername
    );

    if (commits.length === 0) {
      return {
        repo: `${owner}/${repo}`,
        github_username: githubUsername,
        files: {},
        metadata: {
          total_commits: 0,
          total_lines_added: 0,
          files_count: 0,
          date_range: {
            first_commit: null,
            last_commit: null,
          },
        },
      };
    }

    // Fetch detailed commit information with patches
    const commitDetails = await githubService.getCommitDetails(
      owner,
      repo,
      commits
    );

    // Extract code from patches
    return this.extractCodeFromCommits(
      commitDetails,
      githubUsername,
      `${owner}/${repo}`
    );
  }
}


