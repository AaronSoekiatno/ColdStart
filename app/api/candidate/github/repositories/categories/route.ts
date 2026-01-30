import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

interface RepoCategory {
  github_repo_id: number;
  is_selected: boolean;
  category_tags: string[];
}

interface FullRepoData {
  github_repo_id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number> | null;
  topics: string[];
  is_private: boolean;
  is_fork?: boolean;
  is_archived?: boolean;
  stargazers_count: number;
  forks_count: number;
  watchers_count?: number;
  is_selected: boolean;
  category_tags: string[];
}

export async function POST(request: NextRequest) {
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { repositories, full_save } = body as {
      repositories: (RepoCategory | FullRepoData)[];
      full_save?: boolean;
    };

    if (!repositories || !Array.isArray(repositories)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { repositories: [...] }' },
        { status: 400 }
      );
    }

    // Valid category tags (same as role_type in candidates)
    const validCategories = [
      'PM', 'SWE', 'SDE', 'ML', 'AI', 'Data Science', 'DevOps',
      'Frontend', 'Backend', 'Full Stack', 'Mobile', 'Security',
      'QA', 'Design', 'Product Design', 'Other'
    ];

    let updated = 0;
    let inserted = 0;
    const errors: string[] = [];

    // If full_save is true, we're saving complete repo data (first time save during onboarding completion)
    if (full_save) {
      const fullRepos = repositories as FullRepoData[];
      const upsertData = fullRepos.map(repo => {
        // Validate category tags (still do this for logging/sanity)
        const invalidTags = repo.category_tags.filter(tag => !validCategories.includes(tag));
        if (invalidTags.length > 0) {
          console.warn(`Invalid category tags for repo ${repo.github_repo_id}: ${invalidTags.join(', ')}`);
        }

        return {
          candidate_id: candidate.id,
          github_repo_id: repo.github_repo_id,
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          description: repo.description,
          language: repo.language,
          languages: repo.languages,
          topics: repo.topics || [],
          is_private: repo.is_private,
          is_fork: repo.is_fork || false,
          is_archived: repo.is_archived || false,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          watchers_count: repo.watchers_count || 0,
          is_selected: repo.is_selected,
          category_tags: repo.category_tags,
          synced_at: new Date().toISOString(),
        };
      });

      // Perform batch upsert
      const { error: upsertError } = await supabaseAdmin
        .from('github_repositories')
        .upsert(upsertData, {
          onConflict: 'candidate_id,github_repo_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`Error batch upserting repositories:`, upsertError);
        return NextResponse.json({ error: 'Failed to save repositories' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        inserted: upsertData.length,
      });
    }

    // Normal update mode - just update is_selected and category_tags
    // Since each repo has potentially different category_tags, we can't do a single simple UPDATE
    // BUT we can use batch UPSERT even for partial updates if we are careful, 
    // or just keep the loop but use Promise.all to parallelize if the count is small.
    // However, the best way in Supabase is batch upsert with only the changed columns 
    // (though you must include required columns for onConflict).
    
    const simpleRepos = repositories as RepoCategory[];
    const updateData = simpleRepos.map(repo => ({
      candidate_id: candidate.id,
      github_repo_id: repo.github_repo_id,
      is_selected: repo.is_selected,
      category_tags: repo.category_tags,
    }));

    // Batch upsert will update existing rows because of onConflict
    const { error: updateError } = await supabaseAdmin
      .from('github_repositories')
      .upsert(updateData, {
        onConflict: 'candidate_id,github_repo_id',
      });

    if (updateError) {
      console.error(`Error batch updating repository categories:`, updateError);
      return NextResponse.json({ error: 'Failed to update repository categories' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: simpleRepos.length,
    });
  } catch (error) {
    console.error('Error updating repository categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const requestUrl = new URL(request.url);
    const selectedOnly = requestUrl.searchParams.get('selected_only') === 'true';
    const categoryFilter = requestUrl.searchParams.get('category');

    let query = supabaseAdmin
      .from('github_repositories')
      .select('id, github_repo_id, name, full_name, html_url, description, language, languages, topics, is_private, stargazers_count, forks_count, is_selected, category_tags')
      .eq('candidate_id', candidate.id)
      .order('stargazers_count', { ascending: false });

    if (selectedOnly) {
      query = query.eq('is_selected', true);
    }

    if (categoryFilter) {
      query = query.contains('category_tags', [categoryFilter]);
    }

    const { data: repos, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching repositories:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch repositories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      repositories: repos || [],
    });
  } catch (error) {
    console.error('Error fetching repository categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
