import { supabaseAdmin } from '@/lib/supabase';
import { GitHubService } from '@/services/verification/github';

/**
 * Syncs GitHub repositories for a candidate
 * Fetches repos from GitHub and stores them in the github_repositories table
 */
export async function syncCandidateRepositories(
  candidateId: string,
  accessToken: string,
  includePrivate: boolean = true,
  options: { skipSave?: boolean } = {}
): Promise<{ success: boolean; count: number; repositories?: any[]; error?: any }> {
  try {
    console.log(`[GitHub Sync] Starting sync for candidate ${candidateId}`);
    
    // Initialize GitHub service
    const githubService = new GitHubService(accessToken);
    
    // Fetch repositories
    const repositories = await githubService.getUserRepositories(includePrivate);
    console.log(`[GitHub Sync] Fetched ${repositories.length} repositories from GitHub`);

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (repositories.length === 0) {
      return { success: true, count: 0, repositories: [] };
    }

    // Prepare data for upsert
    const repoDataArray = repositories.map(repo => ({
      candidate_id: candidateId,
      github_repo_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      languages: repo.languages || null,
      topics: repo.topics || [],
      is_private: repo.private,
      is_fork: repo.fork,
      is_archived: repo.archived,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      watchers_count: repo.watchers_count,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      size: repo.size,
      default_branch: repo.default_branch,
      homepage: repo.homepage,
      license_name: repo.license?.name || null,
      has_issues: repo.has_issues,
      has_projects: repo.has_projects,
      has_wiki: repo.has_wiki,
      has_pages: repo.has_pages,
      full_data: repo, 
      synced_at: new Date().toISOString(),
    }));

    // If skipSave is true, return the data without saving
    if (options.skipSave) {
      // Add null id to match database shape
      const unsavedRepos = repoDataArray.map(repo => ({
        ...repo,
        id: null
      }));
      return { success: true, count: repositories.length, repositories: unsavedRepos };
    }

    // Use upsert to insert new repos or update existing ones
    const { data: storedRepos, error } = await supabaseAdmin
      .from('github_repositories')
      .upsert(repoDataArray, {
        onConflict: 'candidate_id,github_repo_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('[GitHub Sync] Error upserting repositories:', error);
      throw error;
    }

    console.log(`[GitHub Sync] Successfully stored ${storedRepos?.length || 0} repositories for candidate ${candidateId}`);
    return { success: true, count: storedRepos?.length || 0, repositories: storedRepos || [] };
  } catch (error) {
    console.error('[GitHub Sync] Error in syncCandidateRepositories:', error);
    return { success: false, count: 0, error };
  }
}
