import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

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

    // Get startup_id from query params
    const { searchParams } = new URL(request.url);
    const startupId = searchParams.get('startupId');

    if (!startupId) {
      return NextResponse.json(
        { error: 'Missing startupId parameter' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get candidate's role preferences
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('role_type, job_type')
      .eq('email', user.email)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get all jobs for this startup that have job_url
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, job_title, job_url, company_name')
      .eq('startup_id', startupId)
      .not('job_url', 'is', null);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No job listings available for this company' },
        { status: 404 }
      );
    }

    // Match jobs based on role_type preferences
    const roleTypes = candidate.role_type || [];

    // Function to check if job title matches any role type
    const matchesRoleType = (jobTitle: string): boolean => {
      const titleLower = jobTitle.toLowerCase();

      for (const roleType of roleTypes) {
        const roleLower = roleType.toLowerCase();

        // Map role types to common variations in job titles
        const rolePatterns: { [key: string]: string[] } = {
          'pm': ['product manager', 'pm'],
          'swe': ['software engineer', 'swe', 'engineer'],
          'sde': ['software development engineer', 'sde', 'developer'],
          'ml': ['machine learning', 'ml engineer', 'ml'],
          'ai': ['ai engineer', 'artificial intelligence', 'ai'],
          'data science': ['data scientist', 'data science'],
          'devops': ['devops', 'dev ops', 'infrastructure'],
          'frontend': ['frontend', 'front-end', 'front end'],
          'backend': ['backend', 'back-end', 'back end'],
          'full stack': ['full stack', 'fullstack', 'full-stack'],
          'mobile': ['mobile', 'ios', 'android'],
          'security': ['security', 'infosec', 'cybersecurity'],
          'qa': ['qa', 'quality assurance', 'test', 'sdet'],
          'design': ['designer', 'design'],
          'product design': ['product designer', 'product design'],
        };

        const patterns = rolePatterns[roleLower] || [roleLower];

        for (const pattern of patterns) {
          if (titleLower.includes(pattern)) {
            return true;
          }
        }
      }

      return false;
    };

    // Find matching jobs
    const matchingJobs = jobs.filter(job => matchesRoleType(job.job_title));

    // If we have matching jobs, return the first one
    if (matchingJobs.length > 0) {
      return NextResponse.json({
        job: matchingJobs[0]
      });
    }

    // If no matches, return the first job anyway (as requested by user)
    return NextResponse.json({
      job: jobs[0]
    });

  } catch (error) {
    console.error('Error fetching job listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job listing' },
      { status: 500 }
    );
  }
}
