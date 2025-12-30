import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  languages_url: string;
  languages?: Record<string, number> | null; // Language usage data from GitHub API
  topics: string[];
  private: boolean;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  default_branch: string;
  homepage: string | null;
  license: {
    name: string;
  } | null;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
}

/**
 * Fetch repositories from GitHub API
 */
async function fetchGitHubRepositories(
  accessToken: string,
  username: string,
  includePrivate: boolean = true
): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;
  const perPage = 100; // GitHub API max

  while (true) {
    try {
      // Fetch repositories for the authenticated user
      const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc&affiliation=owner,collaborator`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('GitHub token expired or invalid');
        }
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
          if (rateLimitRemaining === '0') {
            throw new Error('GitHub API rate limit exceeded');
          }
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repos: GitHubRepository[] = await response.json();
      
      if (repos.length === 0) {
        break; // No more repos
      }

      // Filter private repos if needed
      const filteredRepos = includePrivate 
        ? repos 
        : repos.filter(repo => !repo.private);

      allRepos.push(...filteredRepos);

      // If we got fewer than perPage, we're done
      if (repos.length < perPage) {
        break;
      }

      page++;
    } catch (error) {
      console.error(`Error fetching GitHub repos page ${page}:`, error);
      throw error;
    }
  }

  // Fetch language data for each repository
  // We'll do this in parallel but limit concurrency
  const reposWithLanguages = await Promise.all(
    allRepos.map(async (repo) => {
      try {
        const langResponse = await fetch(repo.languages_url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (langResponse.ok) {
          const languages = await langResponse.json();
          return {
            ...repo,
            languages,
          };
        }
      } catch (error) {
        console.error(`Error fetching languages for ${repo.full_name}:`, error);
      }
      return repo;
    })
  );

  return reposWithLanguages;
}

/**
 * Store repositories in database using upsert
 */
async function storeRepositories(
  candidateId: string,
  repositories: GitHubRepository[]
): Promise<{ stored: number; updated: number }> {
  if (!supabaseAdmin) {
    throw new Error('Database connection not available');
  }

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
    full_data: repo as any, // Store complete repo object
    synced_at: new Date().toISOString(),
  }));

  // Use upsert to insert new repos or update existing ones
  // onConflict specifies the unique constraint columns
  // ignoreDuplicates: false means it will update on conflict
  const { data, error } = await supabaseAdmin
    .from('github_repositories')
    .upsert(repoDataArray, {
      onConflict: 'candidate_id,github_repo_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error upserting repositories:', error);
    throw error;
  }

  // Return approximate counts (we can't easily distinguish inserts vs updates with upsert)
  return { stored: repositories.length, updated: 0 };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get candidate record
    const candidate = await getCandidate(user.email);
    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate record not found' },
        { status: 404 }
      );
    }

    // Check if GitHub is connected
    if (!candidate.github_access_token) {
      return NextResponse.json(
        { error: 'GitHub not connected. Please connect your GitHub account first.' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (candidate.github_token_expires_at) {
      const expiresAt = new Date(candidate.github_token_expires_at);
      const now = new Date();
      if (expiresAt < now) {
        return NextResponse.json(
          { error: 'GitHub token expired. Please reconnect your GitHub account.' },
          { status: 401 }
        );
      }
    }

    const requestUrl = new URL(request.url);
    const forceRefresh = requestUrl.searchParams.get('refresh') === 'true';
    const includePrivate = requestUrl.searchParams.get('include_private') !== 'false';
    // skip_save=true means don't save to database (used during onboarding before completion)
    const skipSave = requestUrl.searchParams.get('skip_save') === 'true';

    // Check if database connection is available (only needed if we're saving)
    if (!skipSave && !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check if we have recent data (within last hour) and user doesn't want refresh
    // Skip this cache check if skip_save is true (we want fresh data from GitHub)
    if (!skipSave && !forceRefresh && candidate.github_username && supabaseAdmin) {
      const { data: recentRepos } = await supabaseAdmin
        .from('github_repositories')
        .select('synced_at')
        .eq('candidate_id', candidate.id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      if (recentRepos?.synced_at) {
        const lastSync = new Date(recentRepos.synced_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (lastSync > oneHourAgo) {
          // Return cached data
          const { data: repos, error: fetchError } = await supabaseAdmin
            .from('github_repositories')
            .select('*')
            .eq('candidate_id', candidate.id)
            .order('stargazers_count', { ascending: false });

          if (fetchError) {
            console.error('Error fetching cached repos:', fetchError);
          } else if (repos && repos.length > 0) {
            return NextResponse.json({
              repositories: repos,
              cached: true,
              synced_at: recentRepos.synced_at,
            });
          }
        }
      }
    }

    // Fetch repositories from GitHub
    const repositories = await fetchGitHubRepositories(
      candidate.github_access_token,
      candidate.github_username || 'user',
      includePrivate
    );

    // If skip_save is true, return GitHub data directly without storing
    if (skipSave) {
      // Transform GitHub API response to match our expected format
      const transformedRepos = repositories.map(repo => ({
        id: null, // No database ID yet
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
        is_selected: false,
        category_tags: [],
      }));

      return NextResponse.json({
        repositories: transformedRepos,
        cached: false,
        synced_at: new Date().toISOString(),
        skip_save: true,
      });
    }

    // Store repositories in database
    const { stored, updated } = await storeRepositories(candidate.id, repositories);

    // Return repositories
    const { data: storedRepos, error: fetchError } = await supabaseAdmin!
      .from('github_repositories')
      .select('*')
      .eq('candidate_id', candidate.id)
      .order('stargazers_count', { ascending: false });

    if (fetchError) {
      console.error('Error fetching stored repos:', fetchError);
    }

    return NextResponse.json({
      repositories: storedRepos || [],
      cached: false,
      synced_at: new Date().toISOString(),
      stats: {
        total: repositories.length,
        stored,
        updated,
      },
    });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    // Handle specific GitHub API errors
    if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
      return NextResponse.json(
        { error: 'GitHub token expired. Please reconnect your GitHub account.' },
        { status: 401 }
      );
    }

    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'GitHub API rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

