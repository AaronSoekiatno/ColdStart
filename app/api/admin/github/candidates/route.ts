import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate admin
    await requireAdmin();

    // 2. Get all candidates with GitHub connected
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('id, name, email, github_username, github_connected_at, created_at')
      .not('github_username', 'is', null)
      .order('github_connected_at', { ascending: false });

    if (candidatesError) {
      throw candidatesError;
    }

    // 3. Get latest analysis for each candidate (using code analyses instead of missing verifications table)
    const candidateIds = candidates?.map(c => c.id) || [];

    if (candidateIds.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    // Attempt to fetch code analyses as a proxy for "verification"
    // If this table is also missing, we'll gracefully handle it
    let codeAnalyses: any[] = [];
    try {
        const { data, error } = await supabaseAdmin
        .from('github_code_analyses')
        .select('candidate_id, overall_score, created_at')
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false });
        
        if (!error && data) {
            codeAnalyses = data;
        }
    } catch (e) {
        console.warn('Could not fetch github_code_analyses, proceeding without scores');
    }

    // 4. Create a map of candidate_id -> average score
    const scoreMap = new Map();
    for (const analysis of codeAnalyses) {
        if (!scoreMap.has(analysis.candidate_id)) {
            scoreMap.set(analysis.candidate_id, {
                score: analysis.overall_score,
                verified_at: analysis.created_at
            });
        }
    }

    // 5. Combine data
    const result = candidates?.map(candidate => {
      const analysis = scoreMap.get(candidate.id);

      return {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        github_username: candidate.github_username,
        github_connected_at: candidate.github_connected_at,
        created_at: candidate.created_at,
        has_verification: !!analysis, // Considered "verified" if we have code analysis
        latest_score: analysis?.score || null,
        verification_status: analysis ? 'analyzed' : null,
        verified_at: analysis?.verified_at || null,
      };
    });

    return NextResponse.json({ candidates: result || [] });
  } catch (error: any) {
    console.error('Get candidates error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
