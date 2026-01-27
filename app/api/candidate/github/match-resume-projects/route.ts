import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getCandidate } from '@/lib/supabase';
import { matchProjects } from '@/lib/github-verification/project-matcher';

export async function GET(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookie setting might fail in route handlers
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get service role client for database access
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get primary or most recent active resume
    const { data: resumes, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('id, structured_data')
      .eq('candidate_id', candidate.id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1);

    if (resumeError || !resumes || resumes.length === 0) {
      // No resume uploaded yet - return empty matches
      return NextResponse.json({
        success: true,
        hasResume: false,
        matches: [],
        message: 'No resume found. Upload a resume to see suggested matches.',
      });
    }

    const resume = resumes[0];
    const structuredData = resume.structured_data;

    // Extract projects from structured data
    const resumeProjects = structuredData?.projects || [];

    if (resumeProjects.length === 0) {
      return NextResponse.json({
        success: true,
        hasResume: true,
        matches: [],
        message: 'No projects found in resume.',
      });
    }

    // Get GitHub repositories for this candidate
    const { data: githubRepos, error: reposError } = await supabaseAdmin
      .from('github_repositories')
      .select('id, github_repo_id, name, full_name, description, language, languages, html_url, created_at')
      .eq('candidate_id', candidate.id)
      .order('stargazers_count', { ascending: false });

    if (reposError || !githubRepos || githubRepos.length === 0) {
      return NextResponse.json({
        success: true,
        hasResume: true,
        matches: [],
        message: 'No GitHub repositories found.',
      });
    }

    // Format repos for matcher
    const formattedRepos = githubRepos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      languages: repo.languages,
      html_url: repo.html_url,
      created_at: repo.created_at,
    }));

    // Run the matching algorithm
    const matches = matchProjects(resumeProjects, formattedRepos);

    // Create a map of repo_name -> { github_repo_id, confidence, reasons }
    const repoMatchMap: Record<string, {
      github_repo_id: number;
      repo_id: string;
      confidence: number;
      match_reasons: string[];
      project_name: string;
    }> = {};

    for (const match of matches) {
      for (const matchedRepo of match.matched_repos) {
        const repo = githubRepos.find((r: any) => r.name === matchedRepo.repo_name);
        if (repo) {
          // Keep the highest confidence match for each repo
          const existingMatch = repoMatchMap[matchedRepo.repo_name];
          if (!existingMatch || matchedRepo.confidence > existingMatch.confidence) {
            repoMatchMap[matchedRepo.repo_name] = {
              github_repo_id: repo.github_repo_id,
              repo_id: repo.id,
              confidence: matchedRepo.confidence,
              match_reasons: matchedRepo.match_reasons,
              project_name: match.resume_project,
            };
          }
        }
      }
    }

    // Format response
    return NextResponse.json({
      success: true,
      hasResume: true,
      projectCount: resumeProjects.length,
      repoCount: githubRepos.length,
      matches: Object.entries(repoMatchMap).map(([repoName, data]) => ({
        repo_name: repoName,
        github_repo_id: data.github_repo_id,
        repo_id: data.repo_id,
        project_name: data.project_name,
        confidence: data.confidence,
        match_reasons: data.match_reasons,
        confidence_level:
          data.confidence >= 0.75 ? 'high' :
          data.confidence >= 0.55 ? 'good' :
          data.confidence >= 0.35 ? 'moderate' : 'low',
      })),
    });
  } catch (error) {
    console.error('Error in match-resume-projects API:', error);
    return NextResponse.json(
      {
        error: 'Failed to match projects',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
