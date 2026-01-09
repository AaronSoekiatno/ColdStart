import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/interview/session-id
 * Retrieves sessionId for a given repository URL
 * This allows assessment repositories to look up their sessionId
 * 
 * Query params:
 *   - repoUrl: string (required) - Repository URL
 *   - repoName: string (optional) - Repository name as fallback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const repoUrl = searchParams.get('repoUrl');
    const repoName = searchParams.get('repoName');

    if (!repoUrl && !repoName) {
      return NextResponse.json(
        { error: 'Missing repoUrl or repoName query parameter' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Query by repo_url first, fallback to repo_name
    let query = supabaseAdmin
      .from('interview_sessions')
      .select('session_id, repo_url, repo_name, status, current_phase')
      .or(`repo_url.eq.${repoUrl || ''},repo_name.eq.${repoName || ''}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data, error } = await query;

    if (error) {
      console.error('[API] Error querying session:', error);
      return NextResponse.json(
        { error: 'Failed to query session' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          error: 'No active session found for this repository',
          hint: 'Make sure the repository URL matches exactly, or the interview may not have started yet'
        },
        { status: 404 }
      );
    }

    const session = data[0];

    return NextResponse.json({
      sessionId: session.session_id,
      repoUrl: session.repo_url,
      repoName: session.repo_name,
      status: session.status,
      currentPhase: session.current_phase
    });

  } catch (error) {
    console.error('[API] Error retrieving session ID:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve session ID',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
