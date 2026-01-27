import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/github/analyze/results/[candidate_id]
 *
 * Fetch GitHub analysis results for a candidate.
 * This endpoint is used by companies to view code analysis when evaluating candidates.
 *
 * Returns: {
 *   repositories: Array<{
 *     id: string,
 *     name: string,
 *     full_name: string,
 *     languages: Record<string, number>,
 *     quality_score?: number,
 *     analysis: any,
 *     extraction_status: string,
 *     created_at: string
 *   }>
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { candidate_id: string } }
) {
  try {
    const { candidate_id } = params;

    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add authorization check - verify user is a company or admin
    // For now, allow all authenticated users to view

    // Query github_code_analyses joined with github_repositories
    const { data: analyses, error: analysesError } = await supabase
      .from('github_code_analyses')
      .select(`
        *,
        repository:github_repositories(
          id,
          name,
          full_name,
          language,
          languages,
          stargazers_count,
          forks_count
        )
      `)
      .eq('candidate_id', candidate_id);

    if (analysesError) {
      console.error('[analyze-results] Error querying analyses:', analysesError);
      return NextResponse.json(
        { error: 'Failed to fetch analysis results' },
        { status: 500 }
      );
    }

    if (!analyses || analyses.length === 0) {
      // No analysis results yet
      return NextResponse.json({
        repositories: [],
        total_count: 0,
        has_results: false,
      });
    }

    // Format the results for the frontend
    const repositories = analyses.map(analysis => ({
      id: analysis.repository_id,
      name: analysis.repository?.name || 'Unknown',
      full_name: analysis.repository?.full_name || '',
      language: analysis.repository?.language,
      languages: analysis.repository?.languages || {},
      stargazers_count: analysis.repository?.stargazers_count || 0,
      forks_count: analysis.repository?.forks_count || 0,
      quality_score: analysis.overall_score,
      code_quality_metrics: analysis.code_quality_metrics,
      architecture_analysis: analysis.architecture_analysis,
      extraction_status: analysis.extraction_status,
      analyzed_at: analysis.created_at,
    }));

    // Calculate aggregate statistics
    const totalLanguages: Record<string, number> = {};
    let totalLines = 0;
    let avgQualityScore = 0;
    let scoreCount = 0;

    repositories.forEach(repo => {
      // Aggregate languages
      if (repo.languages) {
        Object.entries(repo.languages).forEach(([lang, bytes]) => {
          totalLanguages[lang] = (totalLanguages[lang] || 0) + Number(bytes);
        });
      }

      // Calculate average quality score
      if (repo.quality_score !== null && repo.quality_score !== undefined) {
        avgQualityScore += repo.quality_score;
        scoreCount++;
      }
    });

    // Get top languages sorted by bytes
    const topLanguages = Object.entries(totalLanguages)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([lang, bytes]) => ({
        language: lang,
        bytes: Number(bytes),
        percentage: Math.round((Number(bytes) / totalLines) * 100) || 0,
      }));

    const aggregateStats = {
      total_repositories: repositories.length,
      top_languages: topLanguages,
      average_quality_score: scoreCount > 0 ? Math.round(avgQualityScore / scoreCount) : null,
    };

    return NextResponse.json({
      repositories,
      aggregate_stats: aggregateStats,
      total_count: repositories.length,
      has_results: true,
    });

  } catch (error) {
    console.error('[analyze-results] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
