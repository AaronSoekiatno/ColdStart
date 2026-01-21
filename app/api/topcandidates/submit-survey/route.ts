import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

/**
 * POST /api/topcandidates/submit-survey
 * 
 * Submits the post-mortem survey for the authenticated candidate.
 */
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

    const { q1, q2, q3, difficulty } = await request.json();

    // 1. Get candidate
    const candidate = await getCandidate(user.email);
    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // 2. Find the latest session for this candidate
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('session_id')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      console.error('[Submit Survey] Session not found:', sessionError);
      return NextResponse.json(
        { error: 'No active session found' },
        { status: 404 }
      );
    }

    // 3. Call the RPC to submit post-mortem
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('submit_post_mortem', {
      p_session_id: session.session_id,
      p_candidate_id: candidate.id,
      p_q1_approach: q1,
      p_q2_production_readiness: q2,
      p_q3_claude_mistake: q3,
      p_difficulty_score: difficulty
    });

    if (rpcError) {
      console.error('[Submit Survey] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to save survey', details: rpcError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, result });

  } catch (error) {
    console.error('[Submit Survey] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
