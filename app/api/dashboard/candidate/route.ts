import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const candidateId = searchParams.get('candidateId');
  const name = searchParams.get('name');
  const email = searchParams.get('email');

  if (!candidateId && !name && !email) {
    return NextResponse.json(
      { error: 'Must provide candidateId, name, or email' },
      { status: 400 }
    );
  }

  try {
    // 1. Find the candidate
    let candidateQuery = supabase.from('candidates').select('*');

    if (candidateId) {
      candidateQuery = candidateQuery.eq('id', candidateId);
    } else if (email) {
      candidateQuery = candidateQuery.eq('email', email);
    } else if (name) {
      candidateQuery = candidateQuery.ilike('name', `%${name}%`);
    }

    const { data: candidates, error: candidateError } = await candidateQuery;

    if (candidateError) {
      return NextResponse.json({ error: candidateError.message }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // If searching by name and multiple results, return list
    if (name && candidates.length > 1) {
      return NextResponse.json({
        multiple: true,
        candidates: candidates.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
        })),
      });
    }

    const candidate = candidates[0];

    // 2. Get all interview sessions for this candidate
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // 3. Get assessment scores for all sessions
    const sessionIds = sessions?.map(s => s.session_id) || [];
    let assessmentScores: any[] = [];

    if (sessionIds.length > 0) {
      const { data: scores, error: scoresError } = await supabase
        .from('admin_audit.assessment_scores')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
      } else {
        assessmentScores = scores || [];
      }
    }

    // 4. Get session commits for code history
    let commits: any[] = [];
    if (sessionIds.length > 0) {
      const { data: commitsData, error: commitsError } = await supabase
        .from('session_commits')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (commitsError) {
        console.error('Error fetching commits:', commitsError);
      } else {
        commits = commitsData || [];
      }
    }

    // 5. Calculate behavioral metrics
    const metrics = calculateBehavioralMetrics(sessions || [], assessmentScores);

    return NextResponse.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        created_at: candidate.created_at,
      },
      sessions: sessions || [],
      assessmentScores,
      commits,
      metrics,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateBehavioralMetrics(sessions: any[], scores: any[]) {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      avgTestRuns: '0',
      avgScore: '0',
      avgTimeMinutes: '0',
      passRate: '0',
      aiLeverageScore: 0,
      validationScore: 0,
      scoreProgression: [],
    };
  }

  const completedSessions = sessions.filter(s => s.container_stopped_at);
  const scoredSessions = sessions.filter(s => s.last_test_score !== null);

  const totalTestRuns = sessions.reduce((sum, s) => sum + (s.test_run_count || 0), 0);
  const totalScore = scoredSessions.reduce((sum, s) => sum + (s.last_test_score || 0), 0);

  const totalMinutes = completedSessions.reduce((sum, s) => {
    if (s.container_started_at && s.container_stopped_at) {
      const start = new Date(s.container_started_at);
      const end = new Date(s.container_stopped_at);
      return sum + (end.getTime() - start.getTime()) / 1000 / 60;
    }
    return sum;
  }, 0);

  const passingSessions = scoredSessions.filter(s => s.last_test_score >= 80).length;

  return {
    totalSessions: sessions.length,
    avgTestRuns: sessions.length > 0 ? (totalTestRuns / sessions.length).toFixed(1) : 0,
    avgScore: scoredSessions.length > 0 ? (totalScore / scoredSessions.length).toFixed(1) : 0,
    avgTimeMinutes: completedSessions.length > 0 ? (totalMinutes / completedSessions.length).toFixed(1) : 0,
    passRate: scoredSessions.length > 0 ? ((passingSessions / scoredSessions.length) * 100).toFixed(1) : 0,

    // AI Leverage Score (based on test iterations)
    aiLeverageScore: calculateAILeverageScore(sessions),

    // Validation Score (based on test frequency)
    validationScore: calculateValidationScore(sessions),

    // Score progression (shows iteration quality)
    scoreProgression: calculateScoreProgression(scores),
  };
}

function calculateAILeverageScore(sessions: any[]): number {
  const avgTestRuns = sessions.reduce((sum, s) => sum + (s.test_run_count || 0), 0) / Math.max(sessions.length, 1);

  // Ideal is 2-4 test runs (90+ score)
  // 1 run = suspicious (30 score)
  // 5+ runs = struggling (50-70 score)
  if (avgTestRuns >= 2 && avgTestRuns <= 4) {
    return 90;
  } else if (avgTestRuns === 1) {
    return 30; // Too good to be true
  } else if (avgTestRuns > 4) {
    return Math.max(30, 100 - (avgTestRuns * 10));
  }
  return 50;
}

function calculateValidationScore(sessions: any[]): number {
  const avgTestRuns = sessions.reduce((sum, s) => sum + (s.test_run_count || 0), 0) / Math.max(sessions.length, 1);

  // More test runs = better validation
  if (avgTestRuns >= 3) {
    return 90;
  } else if (avgTestRuns >= 2) {
    return 70;
  } else if (avgTestRuns >= 1) {
    return 50;
  }
  return 30;
}

function calculateScoreProgression(scores: any[]): Array<{ timestamp: string; score: number }> {
  if (!scores || scores.length === 0) {
    return [];
  }

  return scores.slice(0, 10).map(s => ({
    timestamp: s.created_at,
    score: s.total_score || 0,
  }));
}
