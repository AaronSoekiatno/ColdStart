import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/github/analyze/status?candidate_id=xxx
 *
 * Check the progress of GitHub repository analysis for a candidate.
 * Returns overall status and progress percentage.
 *
 * Returns: {
 *   status: 'pending' | 'in_progress' | 'completed' | 'failed',
 *   progress: number (0-100),
 *   total_repositories: number,
 *   completed_repositories: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const candidate_id = searchParams.get('candidate_id');

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

    // Query github_code_extracts table for status
    const { data: extracts, error: extractsError } = await supabase
      .from('github_code_extracts')
      .select('extraction_status, repository_id')
      .eq('candidate_id', candidate_id);

    if (extractsError) {
      console.error('[analyze-status] Error querying extracts:', extractsError);
      return NextResponse.json(
        { error: 'Failed to fetch analysis status' },
        { status: 500 }
      );
    }

    if (!extracts || extracts.length === 0) {
      // No analysis has been started
      return NextResponse.json({
        status: 'pending',
        progress: 0,
        total_repositories: 0,
        completed_repositories: 0,
      });
    }

    const totalRepos = extracts.length;
    const completedRepos = extracts.filter(e => e.extraction_status === 'completed').length;
    const failedRepos = extracts.filter(e => e.extraction_status === 'failed').length;
    const inProgressRepos = extracts.filter(e => e.extraction_status === 'in_progress').length;

    // Calculate progress percentage
    const progress = Math.round((completedRepos / totalRepos) * 100);

    // Determine overall status
    let overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
    if (completedRepos === totalRepos) {
      overallStatus = 'completed';
    } else if (failedRepos === totalRepos) {
      overallStatus = 'failed';
    } else if (inProgressRepos > 0 || completedRepos > 0) {
      overallStatus = 'in_progress';
    } else {
      overallStatus = 'pending';
    }

    return NextResponse.json({
      status: overallStatus,
      progress,
      total_repositories: totalRepos,
      completed_repositories: completedRepos,
      failed_repositories: failedRepos,
    });

  } catch (error) {
    console.error('[analyze-status] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
