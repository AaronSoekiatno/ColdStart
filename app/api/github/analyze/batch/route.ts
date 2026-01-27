import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60; // 1 minute timeout

/**
 * POST /api/github/analyze/batch
 *
 * Analyzes GitHub repositories by fetching language data directly from GitHub API.
 * This is a fire-and-forget endpoint that initiates background processing
 * without blocking the user's onboarding flow.
 *
 * Body: { candidate_id: string, repository_ids: string[] }
 * Returns: { success: boolean, analyzed_count: number, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { candidate_id, repository_ids } = await request.json();

    if (!candidate_id || !repository_ids || !Array.isArray(repository_ids)) {
      return NextResponse.json(
        { success: false, error: 'candidate_id and repository_ids (array) are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify candidate exists and has GitHub access token
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, github_access_token, github_username')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      console.error('[batch-analyze] Candidate not found:', candidateError);
      return NextResponse.json(
        { success: false, error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (!candidate.github_access_token) {
      console.warn('[batch-analyze] Candidate has no GitHub access token');
      return NextResponse.json(
        { success: false, error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Get repository details from database
    const { data: repositories, error: reposError } = await supabase
      .from('github_repositories')
      .select('id, full_name, name, github_repo_id, languages')
      .eq('candidate_id', candidate_id)
      .in('id', repository_ids);

    if (reposError || !repositories || repositories.length === 0) {
      console.error('[batch-analyze] Failed to fetch repositories:', reposError);
      return NextResponse.json(
        { success: false, error: 'No repositories found' },
        { status: 404 }
      );
    }

    console.log('[batch-analyze] Starting analysis for', repositories.length, 'repositories');

    // Process repositories in background (fire-and-forget)
    // We return immediately to not block the user
    processRepositoriesInBackground(repositories, candidate_id, candidate.github_access_token);

    return NextResponse.json({
      success: true,
      repositories_count: repositories.length,
      message: 'Analysis started in background',
    });

  } catch (error) {
    console.error('[batch-analyze] Internal error:', error);
    // Return 200 to not block user's onboarding flow
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 200 });
  }
}

/**
 * Process repositories in the background (fire-and-forget)
 * Fetches language data from GitHub API and stores analysis results
 */
async function processRepositoriesInBackground(
  repositories: Array<{ id: string; full_name: string; name: string; languages: any }>,
  candidateId: string,
  githubToken: string
) {
  if (!supabaseAdmin) {
    console.error('[batch-analyze] supabaseAdmin not available');
    return;
  }

  for (const repo of repositories) {
    try {
      console.log('[batch-analyze] Processing repository:', repo.full_name);

      // Create initial extraction record
      const { data: extraction, error: extractionError } = await supabaseAdmin
        .from('github_code_extracts')
        .insert({
          candidate_id: candidateId,
          repository_id: repo.id,
          extraction_status: 'in_progress',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (extractionError) {
        console.error('[batch-analyze] Failed to create extraction record:', extractionError);
        continue;
      }

      // Fetch language data from GitHub API
      const languagesUrl = `https://api.github.com/repos/${repo.full_name}/languages`;
      const languagesResponse = await fetch(languagesUrl, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      let languages = repo.languages || {};
      if (languagesResponse.ok) {
        languages = await languagesResponse.json();
      } else {
        console.warn('[batch-analyze] Failed to fetch languages for:', repo.full_name);
      }

      // Calculate simple quality score based on available data
      // In a real implementation, you might analyze code complexity, documentation, tests, etc.
      const qualityScore = calculateQualityScore(languages);

      // Store analysis results
      const { error: analysisError } = await supabaseAdmin
        .from('github_code_analyses')
        .insert({
          candidate_id: candidateId,
          repository_id: repo.id,
          overall_score: qualityScore,
          code_quality_metrics: {
            languages,
            total_bytes: Object.values(languages).reduce((sum: number, bytes) => sum + Number(bytes), 0),
          },
          extraction_status: 'completed',
          created_at: new Date().toISOString(),
        });

      if (analysisError) {
        console.error('[batch-analyze] Failed to store analysis:', analysisError);
        // Update extraction status to failed
        await supabaseAdmin
          .from('github_code_extracts')
          .update({ extraction_status: 'failed' })
          .eq('id', extraction.id);
        continue;
      }

      // Update extraction status to completed
      await supabaseAdmin
        .from('github_code_extracts')
        .update({ extraction_status: 'completed' })
        .eq('id', extraction.id);

      console.log('[batch-analyze] Successfully analyzed:', repo.full_name);

    } catch (error) {
      console.error('[batch-analyze] Error processing repository:', repo.full_name, error);
      // Continue with next repository
    }
  }

  console.log('[batch-analyze] Background processing completed for candidate:', candidateId);
}

/**
 * Calculate a simple quality score based on language diversity and total code size
 * Score ranges from 0-100
 */
function calculateQualityScore(languages: Record<string, number>): number {
  if (!languages || Object.keys(languages).length === 0) {
    return 0;
  }

  const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + Number(bytes), 0);
  const languageCount = Object.keys(languages).length;

  // Base score on total code size (logarithmic scale)
  let sizeScore = Math.min(50, Math.log10(totalBytes) * 10);

  // Bonus for language diversity (up to 30 points)
  let diversityScore = Math.min(30, languageCount * 5);

  // Bonus for popular languages (up to 20 points)
  const popularLanguages = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java'];
  const hasPopularLanguage = Object.keys(languages).some(lang =>
    popularLanguages.includes(lang)
  );
  const popularityScore = hasPopularLanguage ? 20 : 10;

  return Math.round(sizeScore + diversityScore + popularityScore);
}
