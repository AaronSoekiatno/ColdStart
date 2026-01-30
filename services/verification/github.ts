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
  /**
   * Fetch all repositories for the authenticated user
   */
  async getUserRepositories(includePrivate: boolean = true): Promise<any[]> {
    try {
      const repos: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.repos.listForAuthenticatedUser({
          visibility: includePrivate ? 'all' : 'public',
          affiliation: 'owner,collaborator,organization_member',
          sort: 'updated',
          direction: 'desc',
          per_page: perPage,
          page,
        });

        if (response.data.length === 0) {
          break;
        }

        repos.push(...response.data);
        
        if (response.data.length < perPage) {
          break;
        }
        page++;
      }

      // Fetch languages for each repository
      // We limit concurrency to avoid hitting rate limits too hard
      const chunkedRepos = [];
      const chunkSize = 10;
      for (let i = 0; i < repos.length; i += chunkSize) {
        chunkedRepos.push(repos.slice(i, i + chunkSize));
      }

      const reposWithLanguages = [];
      
      for (const chunk of chunkedRepos) {
        const chunkResults = await Promise.all(
          chunk.map(async (repo) => {
            try {
              // Parse owner and repo name from full_name
              const [owner, repoName] = repo.full_name.split('/');
              
              const { data: languages } = await this.octokit.repos.listLanguages({
                owner,
                repo: repoName,
              });
              
              return {
                ...repo,
                languages,
              };
            } catch (error) {
              console.warn(`Failed to fetch languages for ${repo.full_name}:`, error);
              return {
                ...repo,
                languages: null,
              };
            }
          })
        );
        reposWithLanguages.push(...chunkResults);
      }

      return reposWithLanguages;

    } catch (error: any) {
      if (error.status) {
        throw new GitHubAPIError(
          `Failed to fetch repositories: ${error.message}`,
          error.status
        );
      }
      throw new GitHubAPIError(`Failed to fetch repositories: ${error.message}`);
    }
  }
}


