import { Octokit } from '@octokit/rest';
import { GitHubAPIError } from '@/services/verification/utils/errors';

export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  created_at: string;
}

export interface Tag {
  name: string;
  commit: {
    sha: string;
  };
}

export interface DeploymentIndicators {
  has_dockerfile: boolean;
  has_ci_cd: boolean;
  deployed_to: string | null;
  deployment_added_at: string | null;
}

export interface VelocityMetrics {
  first_release_at: string | null;
  first_release_tag: string | null;
  first_tag_at: string | null;
  first_tag_name: string | null;
  days_to_first_release: number | null;
  has_dockerfile: boolean;
  has_ci_cd: boolean;
  deployed_to: string | null;
  deployment_added_at: string | null;
}

export class VelocityService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Fetch releases for a repository
   */
  async getReleases(owner: string, repo: string): Promise<Release[]> {
    try {
      const response = await this.octokit.repos.listReleases({
        owner,
        repo,
        per_page: 10,
      });

      return response.data.map((release) => ({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name,
        published_at: release.published_at,
        created_at: release.created_at,
      }));
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw new GitHubAPIError(
        `Failed to fetch releases: ${error.message}`,
        error.status
      );
    }
  }

  /**
   * Fetch tags for a repository (fallback if no releases)
   */
  async getTags(owner: string, repo: string): Promise<Tag[]> {
    try {
      const response = await this.octokit.repos.listTags({
        owner,
        repo,
        per_page: 10,
      });

      return response.data.map((tag) => ({
        name: tag.name,
        commit: {
          sha: tag.commit.sha,
        },
      }));
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw new GitHubAPIError(
        `Failed to fetch tags: ${error.message}`,
        error.status
      );
    }
  }

  /**
   * Get commit date for a specific tag
   */
  async getTagCommitDate(
    owner: string,
    repo: string,
    sha: string
  ): Promise<string | null> {
    try {
      const response = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return response.data.commit.author?.date || null;
    } catch (error: any) {
      console.error(`Failed to get commit date for ${sha}:`, error.message);
      return null;
    }
  }

  /**
   * Check for deployment-related files in the repository
   */
  async getDeploymentIndicators(
    owner: string,
    repo: string
  ): Promise<DeploymentIndicators> {
    const result: DeploymentIndicators = {
      has_dockerfile: false,
      has_ci_cd: false,
      deployed_to: null,
      deployment_added_at: null,
    };

    try {
      // Get root directory contents
      const { data: rootContents } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: '',
      });

      if (!Array.isArray(rootContents)) {
        return result;
      }

      const fileNames = rootContents.map((item) => item.name.toLowerCase());

      // Check for Dockerfile
      if (fileNames.includes('dockerfile')) {
        result.has_dockerfile = true;
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'Dockerfile'
        );
      }

      // Check for deployment platform configs
      if (fileNames.includes('vercel.json')) {
        result.deployed_to = 'Vercel';
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'vercel.json'
        );
      } else if (fileNames.includes('netlify.toml')) {
        result.deployed_to = 'Netlify';
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'netlify.toml'
        );
      } else if (fileNames.includes('fly.toml')) {
        result.deployed_to = 'Fly.io';
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'fly.toml'
        );
      } else if (fileNames.includes('render.yaml')) {
        result.deployed_to = 'Render';
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'render.yaml'
        );
      } else if (fileNames.includes('railway.json')) {
        result.deployed_to = 'Railway';
        result.deployment_added_at = await this.getFileFirstCommitDate(
          owner,
          repo,
          'railway.json'
        );
      }

      // Check for CI/CD (.github/workflows)
      try {
        const { data: githubDir } = await this.octokit.repos.getContent({
          owner,
          repo,
          path: '.github/workflows',
        });

        if (Array.isArray(githubDir) && githubDir.length > 0) {
          result.has_ci_cd = true;
          if (!result.deployment_added_at) {
            result.deployment_added_at = await this.getFileFirstCommitDate(
              owner,
              repo,
              '.github/workflows'
            );
          }
        }
      } catch {
        // No .github/workflows directory
      }
    } catch (error: any) {
      console.error('Failed to check deployment indicators:', error.message);
    }

    return result;
  }

  /**
   * Get the date when a file was first added
   */
  private async getFileFirstCommitDate(
    owner: string,
    repo: string,
    path: string
  ): Promise<string | null> {
    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner,
        repo,
        path,
        per_page: 1,
      });

      // Get the oldest commit by fetching all commits for this file
      const { data: allCommits } = await this.octokit.repos.listCommits({
        owner,
        repo,
        path,
        per_page: 100,
      });

      if (allCommits.length > 0) {
        // Return the oldest commit (last in the array)
        const oldestCommit = allCommits[allCommits.length - 1];
        return oldestCommit.commit.author?.date || null;
      }

      return null;
    } catch (error: any) {
      console.error(`Failed to get first commit date for ${path}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysBetween(
    startDate: string | null,
    endDate: string | null
  ): number | null {
    if (!startDate || !endDate) {
      return null;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Extract all velocity metrics for a repository
   */
  async extractVelocityMetrics(
    owner: string,
    repo: string,
    firstCommitDate: string | null
  ): Promise<VelocityMetrics> {
    // Fetch releases
    const releases = await this.getReleases(owner, repo);
    
    // Get first release (oldest by published_at)
    let firstRelease = null;
    if (releases.length > 0) {
      firstRelease = releases.reduce((oldest, current) => {
        const oldestDate = oldest.published_at || oldest.created_at;
        const currentDate = current.published_at || current.created_at;
        return new Date(currentDate) < new Date(oldestDate) ? current : oldest;
      });
    }

    // Fetch tags as fallback
    let firstTag = null;
    let firstTagDate = null;
    if (!firstRelease) {
      const tags = await this.getTags(owner, repo);
      if (tags.length > 0) {
        // Get the first tag (usually the oldest by convention, but we need to check commit dates)
        // For simplicity, take the last tag in the list (oldest)
        firstTag = tags[tags.length - 1];
        if (firstTag) {
          firstTagDate = await this.getTagCommitDate(owner, repo, firstTag.commit.sha);
        }
      }
    }

    // Get deployment indicators
    const deploymentIndicators = await this.getDeploymentIndicators(owner, repo);

    // Calculate days to first release
    const shipDate = firstRelease?.published_at || firstRelease?.created_at || firstTagDate;
    const daysToFirstRelease = this.calculateDaysBetween(firstCommitDate, shipDate);

    return {
      first_release_at: firstRelease?.published_at || firstRelease?.created_at || null,
      first_release_tag: firstRelease?.tag_name || null,
      first_tag_at: firstTagDate,
      first_tag_name: firstTag?.name || null,
      days_to_first_release: daysToFirstRelease,
      ...deploymentIndicators,
    };
  }
}
