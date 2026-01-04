import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

/**
 * GET /api/topcandidates/assessment-status
 * 
 * Returns the assessment status for the authenticated candidate.
 * Status can be: 'not_started', 'in_progress', 'completed'
 */
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
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const candidate = await getCandidate(user.email, true); // Include assessment fields for top candidates

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { status: 'not_started' },
        { status: 200 }
      );
    }

    // Determine status based on fields
    if (!candidate.assessment_repo_url) {
      return NextResponse.json({
        status: 'not_started',
        repoUrl: null,
        startedAt: null,
      });
    }

    if (candidate.assessment_started_at) {
      // Check if there's a completion indicator (could be added later)
      // For now, if started, it's in_progress
      return NextResponse.json({
        status: 'in_progress',
        repoUrl: candidate.assessment_repo_url,
        startedAt: candidate.assessment_started_at,
        createdAt: candidate.assessment_repo_created_at,
      });
    }

    // Repo exists but not started
    return NextResponse.json({
      status: 'in_progress',
      repoUrl: candidate.assessment_repo_url,
      startedAt: null,
      createdAt: candidate.assessment_repo_created_at,
    });

  } catch (error) {
    console.error('[Assessment Status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

