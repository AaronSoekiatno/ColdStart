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
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate admin
    await requireAdmin();

    const candidateId = params.id;

    // 2. Fetch all data in parallel
    // We fetch repos and code analyses instead of 'github_verifications' table
    const [
        candidateResponse, 
        reposResponse,
        codeAnalysesResponse,
        sessionsResponse, 
        resumesResponse,
        matchesResponse
    ] = await Promise.all([
        // A. Candidate Profile
        supabaseAdmin
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single(),

        // B. GitHub Repos (for live verification)
        supabaseAdmin
        .from('github_repositories')
        .select('*')
        .eq('candidate_id', candidateId),

        // C. Code Analyses
        supabaseAdmin
        .from('github_code_analyses')
        .select('*')
        .eq('candidate_id', candidateId),

        // D. Interview Sessions
        supabaseAdmin
        .from('interview_sessions')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false }),

        // E. Resumes
        supabaseAdmin
        .from('resumes')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false }),

        // F. Matches
        supabaseAdmin
        .from('matches')
        .select('*, startup:startups3(*)')
        .eq('candidate_id', candidateId)
        .order('score', { ascending: false })
    ]);

    // Check for critical errors (candidate not found)
    if (candidateResponse.error) {
        if (candidateResponse.error.code === 'PGRST116') {
            return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
        }
        throw candidateResponse.error;
    }

    const candidate = candidateResponse.data;
    const githubRepos = reposResponse.data || [];
    const codeAnalyses = codeAnalysesResponse.data || [];

    // 3. Construct Virtual Verification
    let verification = null;
    if (candidate.structured_resume_data && githubRepos.length > 0) {
        try {
            const resumeData = candidate.structured_resume_data;
            const projects = resumeData.projects || [];
            const workExperience = resumeData.experience || [];
            
            const matches = matchProjects(projects, githubRepos);
            const discrepancies = findDiscrepancies(matches);
            const timeline = analyzeTimeline(workExperience, []); // No commits available yet
            
            const scoreResult = calculateVerificationScore(
                matches, 
                timeline, 
                codeAnalyses
            );

            verification = {
                id: 'virtual-verification', 
                candidate_id: candidateId,
                verified_by: 'System (Live)',
                verified_at: new Date().toISOString(),
                verification_status: 'completed',
                overall_score: scoreResult.overall_score,
                project_matches: matches,
                project_discrepancies: discrepancies,
                experience_timeline_analysis: timeline,
                resume_snapshot: resumeData
            };
        } catch (e) {
            console.error('Error constructing virtual verification:', e);
        }
    }

    // 4. Try to fetch detailed test scores if they exist
    let assessmentScores = [];
    try {
        const { data: scores } = await supabaseAdmin
            .schema('admin_audit')
            .from('assessment_scores')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('created_at', { ascending: false });
        
        if (scores) assessmentScores = scores;
    } catch (e) {
        console.warn('Could not fetch assessment_scores', e);
    }

    return NextResponse.json({
      candidate: candidate,
      verifications: verification ? [verification] : [], // Frontend expects array
      sessions: sessionsResponse.data || [],
      resumes: resumesResponse.data || [],
      matches: matchesResponse.data || [],
      assessmentScores: assessmentScores
    });

  } catch (error: any) {
    console.error('Get full profile error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
