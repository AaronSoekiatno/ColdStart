import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics: string[];
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
}

async function getRepositoryLanguages(octokit: Octokit, owner: string, repo: string): Promise<Record<string, number> | null> {
  try {
    const { data } = await octokit.repos.listLanguages({
      owner,
      repo,
    });
    return data;
  } catch (error) {
    console.error(`Failed to fetch languages for ${owner}/${repo}:`, error);
    return null;
  }
}

async function syncRepositoriesForCandidate(
  candidateId: string,
  githubUsername: string,
  githubAccessToken: string
): Promise<number> {
  console.log(`\n[SYNC] Processing candidate: ${githubUsername}`);
  
  const octokit = new Octokit({
    auth: githubAccessToken,
  });

  try {
    // Fetch all repositories for the user
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      affiliation: 'owner',
    });

    console.log(`[SYNC] Found ${repos.length} repositories for ${githubUsername}`);

    let insertedCount = 0;

    for (const repo of repos) {
      try {
        // Get language breakdown
        const [owner, repoName] = repo.full_name.split('/');
        const languages = await getRepositoryLanguages(octokit, owner, repoName);

        // Insert repository into database
        const { error } = await supabase
          .from('github_repositories')
          .insert({
            candidate_id: candidateId,
            github_repo_id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            html_url: repo.html_url,
            description: repo.description,
            language: repo.language,
            languages: languages,
            topics: repo.topics || [],
            is_private: repo.private,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            is_selected: false,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
          });

        if (error) {
          // Check if it's a duplicate key error (already exists)
          if (error.code === '23505') {
            console.log(`[SYNC] Repository ${repo.full_name} already exists, skipping`);
          } else {
            console.error(`[SYNC] Failed to insert ${repo.full_name}:`, error.message);
          }
        } else {
          insertedCount++;
          console.log(`[SYNC] ✓ Inserted ${repo.full_name}`);
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[SYNC] Error processing repo ${repo.full_name}:`, error);
      }
    }

    console.log(`[SYNC] Completed for ${githubUsername}: ${insertedCount}/${repos.length} repositories inserted`);
    return insertedCount;
  } catch (error: any) {
    if (error.status === 401) {
      console.error(`[SYNC] Invalid GitHub token for ${githubUsername}`);
    } else {
      console.error(`[SYNC] Error fetching repositories for ${githubUsername}:`, error.message);
    }
    return 0;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('GitHub Repository Recovery Script');
  console.log('='.repeat(80));

  // Fetch all candidates with GitHub connected
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, email, name, github_username, github_access_token')
    .not('github_access_token', 'is', null)
    .not('github_username', 'is', null);

  if (error) {
    console.error('Failed to fetch candidates:', error);
    process.exit(1);
  }

  if (!candidates || candidates.length === 0) {
    console.log('No candidates with GitHub connected found.');
    process.exit(0);
  }

  console.log(`\nFound ${candidates.length} candidates with GitHub connected\n`);

  let totalReposRecovered = 0;
  let successfulCandidates = 0;
  let failedCandidates = 0;

  for (const candidate of candidates) {
    try {
      const repoCount = await syncRepositoriesForCandidate(
        candidate.id,
        candidate.github_username,
        candidate.github_access_token
      );
      
      if (repoCount > 0) {
        successfulCandidates++;
        totalReposRecovered += repoCount;
      } else {
        failedCandidates++;
      }
    } catch (error) {
      console.error(`[SYNC] Failed to process candidate ${candidate.github_username}:`, error);
      failedCandidates++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Recovery Summary');
  console.log('='.repeat(80));
  console.log(`Total candidates processed: ${candidates.length}`);
  console.log(`Successful: ${successfulCandidates}`);
  console.log(`Failed: ${failedCandidates}`);
  console.log(`Total repositories recovered: ${totalReposRecovered}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
