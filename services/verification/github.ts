import { Octokit } from '@octokit/rest';
import { GitHubAPIError } from '@/services/verification/utils/errors';

export interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
}

export interface CommitDetail {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch: string | null;
  }>;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Fetch all commits by a specific author from a repository
   */
  async getCommitsByAuthor(
    owner: string,
    repo: string,
    author: string
  ): Promise<Commit[]> {
    try {
      const commits: Commit[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.repos.listCommits({
          owner,
          repo,
          author,
          per_page: perPage,
          page,
        });

        if (response.data.length === 0) {
          break;
        }

        commits.push(...(response.data as Commit[]));
        page++;

        // GitHub API allows max 100 commits per page
        // If we got less than perPage, we've reached the end
        if (response.data.length < perPage) {
          break;
        }
      }

      return commits;
    } catch (error: any) {
      if (error.status) {
        throw new GitHubAPIError(
          `Failed to fetch commits: ${error.message}`,
          error.status
        );
      }
      throw new GitHubAPIError(`Failed to fetch commits: ${error.message}`);
    }
  }

  /**
   * Fetch detailed commit information including patch data
   */
  async getCommitDetail(
    owner: string,
    repo: string,
    sha: string
  ): Promise<CommitDetail> {
    try {
      const response = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        sha: response.data.sha,
        commit: {
          message: response.data.commit.message,
          author: {
            name: response.data.commit.author?.name || '',
            email: response.data.commit.author?.email || '',
            date: response.data.commit.author?.date || '',
          },
        },
        files: response.data.files?.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          changes: file.changes || 0,
          patch: file.patch || null,
        })) || [],
      };
    } catch (error: any) {
      if (error.status) {
        throw new GitHubAPIError(
          `Failed to fetch commit details: ${error.message}`,
          error.status
        );
      }
      throw new GitHubAPIError(
        `Failed to fetch commit details: ${error.message}`
      );
    }
  }

  /**
   * Fetch all commit details with patches for a list of commits
   */
  async getCommitDetails(
    owner: string,
    repo: string,
    commits: Commit[]
  ): Promise<CommitDetail[]> {
    const details: CommitDetail[] = [];

    for (const commit of commits) {
      try {
        // Add small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
        const detail = await this.getCommitDetail(owner, repo, commit.sha);
        details.push(detail);
      } catch (error) {
        // Log error but continue with other commits
        console.error(`Failed to fetch commit ${commit.sha}:`, error);
      }
    }

    return details;
  }
}


