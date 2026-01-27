import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { matchProjects, findDiscrepancies } from '@/lib/github-verification/project-matcher';
import { analyzeTimeline } from '@/lib/github-verification/timeline-analyzer';
import { calculateVerificationScore } from '@/lib/github-verification/score-calculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  description?: string;
  language?: string;
  languages?: string[];
  html_url: string;
  created_at: string;
}

interface GitHubCommit {
  date: string;
  repo?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate admin
    const admin = await requireAdmin();

    // 2. Get candidate_id from request body
    const body = await request.json();
    const { candidate_id } = body;

    if (!candidate_id) {
      return NextResponse.json(
        { success: false, error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    // 3. Fetch candidate data
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, email, name, github_username, github_access_token, structured_resume_data')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (!candidate.github_username) {
      return NextResponse.json(
        { success: false, error: 'Candidate has not connected GitHub' },
        { status: 400 }
      );
    }

    if (!candidate.structured_resume_data) {
      return NextResponse.json(
        { success: false, error: 'No resume data found for candidate' },
        { status: 400 }
      );
    }

    // 4. Fetch GitHub repositories
    const { data: githubRepos, error: reposError } = await supabaseAdmin
      .from('github_repositories')
      .select('*')
      .eq('candidate_id', candidate_id);

    if (reposError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch GitHub repositories: ${reposError.message}` },
        { status: 500 }
      );
    }

    if (!githubRepos || githubRepos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No GitHub repositories found for candidate' },
        { status: 400 }
      );
    }

    // 5. For now, we'll skip commit history analysis since we don't have a github_commits table
    // In the future, you can fetch commits directly from GitHub API using candidate.github_access_token
    const githubCommits: GitHubCommit[] = [];

    // 6. Extract resume data
    const resumeData = candidate.structured_resume_data;
    const projects = resumeData.projects || [];
    const workExperience = resumeData.experience || [];

    // 7. Run verification algorithms
    const projectMatches = matchProjects(projects, githubRepos as GitHubRepo[]);
    const discrepancies = findDiscrepancies(projectMatches);
    const timelineAnalysis = analyzeTimeline(workExperience, githubCommits);

    // 8. Fetch code quality analyses (if available)
    const { data: codeAnalyses } = await supabaseAdmin
      .from('github_code_analyses')
      .select('overall_score')
      .eq('candidate_id', candidate_id);

    // 9. Calculate overall score
    const scoreResult = calculateVerificationScore(
      projectMatches,
      timelineAnalysis,
      codeAnalyses || []
    );

    // 10. Store verification results (Mock - don't store in missing table)
    const processingDuration = Date.now() - startTime;
    
    // Create the logical verification object
    const verification = {
        id: 'virtual-verification-' + Date.now(),
        candidate_id,
        verified_by: admin.email,
        verified_at: new Date().toISOString(),
        verification_status: 'completed',
        overall_score: scoreResult.overall_score,
        project_matches: projectMatches,
        project_discrepancies: discrepancies,
        experience_timeline_analysis: timelineAnalysis,
        resume_snapshot: resumeData
    };

    // SKIP DB INSERTION to missing table 'github_verifications'
    // In a real app with migrations, we would insert here.
    // For now, we rely on the dynamic GET endpoint to re-calculate this data.
    
    return NextResponse.json({
      success: true,
      verification_id: verification.id,
      score: scoreResult.overall_score,
      breakdown: scoreResult.breakdown,
      verified_projects: projectMatches.filter(m => m.is_verified).length,
      total_projects: projectMatches.length,
      discrepancies: discrepancies.length,
      timeline_gaps: timelineAnalysis.gaps.length,
      processing_time_ms: processingDuration,
    });
  } catch (error: any) {
    console.error('Verification error:', error);

    // Store failed verification logic removed to avoid "table not found" error
    // In a future update with the table, we would uncomment this.
    /*
      await supabaseAdmin.from('github_verifications').insert({ ... });
    */

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
