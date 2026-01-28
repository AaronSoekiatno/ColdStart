import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { matchProjects, findDiscrepancies } from '@/lib/github-verification/project-matcher';
import { analyzeTimeline } from '@/lib/github-verification/timeline-analyzer';
import { calculateVerificationScore } from '@/lib/github-verification/score-calculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate admin
    await requireAdmin();

    const { id: candidateId } = await params;

    // 2. Fetch all necessary data to construct verification on-the-fly
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, name, email, github_username, structured_resume_data')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
         return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // A. Fetch Repositories
    const { data: githubRepos } = await supabaseAdmin
      .from('github_repositories')
      .select('*')
      .eq('candidate_id', candidateId);

    // B. Fetch Code Analyses (if any)
    const { data: codeAnalyses } = await supabaseAdmin
      .from('github_code_analyses')
      .select('*')
      .eq('candidate_id', candidateId);

    // 3. Perform Live Verification (Mock/Dynamic)
    let verification = null;

    if (candidate.structured_resume_data && githubRepos && githubRepos.length > 0) {
        // We have enough data to run the verification logic LIVE
        const resumeData = candidate.structured_resume_data;
        const projects = resumeData.projects || [];
        const workExperience = resumeData.experience || [];
        const matches = matchProjects(projects, githubRepos);
        const discrepancies = findDiscrepancies(matches);
        const timeline = analyzeTimeline(workExperience, []); // No commits table yet
        
        const scoreResult = calculateVerificationScore(
            matches, 
            timeline, 
            codeAnalyses || []
        );

        // Construct a "Virtual" verification object that matches the expected schema
        verification = {
            id: 'virtual-verification', // Placeholder ID
            candidate_id: candidateId,
            verified_by: 'System (Live)',
            verified_at: new Date().toISOString(),
            verification_status: 'completed',
            overall_score: scoreResult.overall_score,
            project_matches: matches,
            project_discrepancies: discrepancies,
            experience_timeline_analysis: timeline,
            processing_duration_ms: 0,
            resume_snapshot: resumeData
        };
    }

    if (!verification) {
        // Return 404 if we can't verify (no repos or no resume)
        // CHECK if we should return 404 or just null verification. 
        // Frontend handles null verification by showing "Run Verification" button.
        // So successful response with null verification is better.
        return NextResponse.json({
            verification: null,
            candidate
        });
    }

    return NextResponse.json({
      verification,
      candidate,
    });
  } catch (error: any) {
    console.error('Get dynamic verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
