import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const offset = (page - 1) * limit;

    // Import cookies at runtime (Next.js 15+ requirement)
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
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get candidate ID and role preferences
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id, role_type')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id);

    // Get matches for sorting (limit to first 200 to avoid performance issues)
    // This ensures page 1 users see matches with jobs, while keeping query fast
    const fetchLimit = Math.max(200, offset + limit);
    const { data: allMatches, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, score, matched_at, startup_id')
      .eq('candidate_id', candidate.id)
      .order('score', { ascending: false })
      .limit(fetchLimit);

    if (matchError) {
      return NextResponse.json(
        { error: `Failed to load matches: ${matchError.message}` },
        { status: 500 }
      );
    }

    if (!allMatches || allMatches.length === 0) {
      return NextResponse.json({
        matches: [],
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasMore: false,
        },
      });
    }

    // Get startup IDs
    const startupIds = Array.from(
      new Set(
        allMatches
          .map((m) => m.startup_id)
          .filter((id): id is string => !!id)
      )
    );

    // Fetch all jobs for startups in one query
    const jobsByStartupId: Record<string, Array<{
      job_title: string;
      job_url: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
    }>> = {};
    const startupsWithJobs = new Set<string>();
    
    if (startupIds.length > 0) {
      const { data: allJobs, error: jobsError } = await supabaseAdmin
        .from('jobs')
        .select('startup_id, job_title, job_url, job_type, salary_range, experience_level')
        .in('startup_id', startupIds)
        .not('job_url', 'is', null);

      if (!jobsError && allJobs) {
        for (const job of allJobs) {
          if (job.startup_id) {
            if (!jobsByStartupId[job.startup_id]) {
              jobsByStartupId[job.startup_id] = [];
            }
            jobsByStartupId[job.startup_id].push({
              job_title: job.job_title,
              job_url: job.job_url,
              job_type: job.job_type || undefined,
              salary_range: job.salary_range || undefined,
              experience_level: job.experience_level || undefined,
            });
            startupsWithJobs.add(job.startup_id);
          }
        }
      }
    }

    // Sort matches: prioritize those with job listings
    const sortedMatches = [...allMatches].sort((a, b) => {
      const aHasJobs = a.startup_id ? startupsWithJobs.has(a.startup_id) : false;
      const bHasJobs = b.startup_id ? startupsWithJobs.has(b.startup_id) : false;

      // First sort by job availability
      if (aHasJobs && !bHasJobs) return -1;
      if (!aHasJobs && bHasJobs) return 1;

      // Then by score (already sorted from query, but ensure it's maintained)
      return b.score - a.score;
    });

    // Apply pagination AFTER sorting
    const rawMatches = sortedMatches.slice(offset, offset + limit);

    // Load startup data
    let startupsById: Record<
      string,
      {
        id: string;
        name: string;
        industry: string;
        location: string;
        yc_description?: string;
        team_size?: string;
        funding_stage: string;
        funding_amount: string;
        tags: string;
        website: string;
        founder_emails?: string;
        founder_names?: string;
        founder_linkedin?: string;
        founder_twitter_urls?: string;
        founder_backgrounds?: string;
        founders_pfp?: string;
        batch?: string;
        description?: string;
        company_logo?: string;
        yc_link?: string;
        company_twitter_url?: string;
        founders?: Array<{
          id: string;
          name: string;
          email?: string;
          role?: string;
          linkedin_url?: string;
          twitter_url?: string;
          background?: string;
          profile_picture?: string;
        }>;
      }
    > = {};

    if (startupIds.length > 0) {
      const { data: startupRows, error: startupsError } = await supabaseAdmin
        .from('startups')
        .select('*')
        .in('id', startupIds);

      if (!startupsError && startupRows) {
        // Fetch founders from founders table for all startups
        const { data: foundersRows, error: foundersError } = await supabaseAdmin
          .from('founders')
          .select('id, startup_id, name, email, role, linkedin_url, twitter_url, background')
          .in('startup_id', startupIds)
          .order('created_at', { ascending: true });

        // Group founders by startup_id and map profile pictures
        const foundersByStartupId: Record<string, Array<{
          id: string;
          name: string;
          email?: string;
          role?: string;
          linkedin_url?: string;
          twitter_url?: string;
          background?: string;
          profile_picture?: string;
        }>> = {};

        if (!foundersError && foundersRows) {
          for (const founder of foundersRows) {
            if (!foundersByStartupId[founder.startup_id]) {
              foundersByStartupId[founder.startup_id] = [];
            }
            foundersByStartupId[founder.startup_id].push({
              id: founder.id,
              name: founder.name,
              email: founder.email ?? undefined,
              role: founder.role ?? undefined,
              linkedin_url: founder.linkedin_url ?? undefined,
              twitter_url: founder.twitter_url ?? undefined,
              background: founder.background ?? undefined,
              // profile_picture will be mapped below from founders_pfp array
            });
          }
        }

        for (const s of startupRows) {
          // Parse founders_pfp array (could be array or comma-separated string)
          const foundersPfpArray: string[] = s.founders_pfp
            ? Array.isArray(s.founders_pfp)
              ? s.founders_pfp.map((url: any) => String(url).trim()).filter((url: string) => url && url !== '')
              : String(s.founders_pfp).split(',').map((url: string) => url.trim()).filter((url: string) => url && url !== '')
            : [];

          // Map profile pictures to founders by index
          const founders = foundersByStartupId[s.id] || [];
          const foundersWithPfp = founders.map((founder, index) => ({
            ...founder,
            profile_picture: foundersPfpArray[index] || undefined,
          }));

          startupsById[s.id] = {
            id: s.id,
            name: s.name,
            industry: s.industry || '',
            location: s.location || '',
            yc_description: s.yc_description ?? undefined,
            team_size: s.team_size ?? undefined,
            funding_stage: s.funding_stage || '',
            funding_amount: s.funding_amount || '',
            tags: s.tags || '',
            website: s.website || '',
            founder_emails: s.founder_emails ?? undefined,
            founder_names: s.founder_names ?? undefined,
            founder_linkedin: s.founder_linkedin ?? undefined,
            founder_twitter_urls: s.founder_twitter_urls ?? undefined,
            founder_backgrounds: s.founder_backgrounds ?? undefined,
            founders_pfp: s.founders_pfp ?? undefined,
            batch: s.batch ?? undefined,
            description: s.description ?? undefined,
            company_logo: s.company_logo ?? undefined,
            yc_link: s.yc_link ?? undefined,
            company_twitter_url: s.company_twitter_url ?? undefined,
            founders: foundersWithPfp,
          };
        }
      }
    }

    // Role matching patterns for finding best job match
    const rolePatterns: { [key: string]: string[] } = {
      'pm': ['product manager', 'pm', 'product lead', 'product owner', 'product'],
      'swe': ['software engineer', 'swe', 'engineer', 'software developer', 'developer'],
      'sde': ['software development engineer', 'sde', 'software engineer', 'developer', 'engineer'],
      'full stack': ['full stack', 'fullstack', 'full-stack', 'software engineer', 'swe', 'engineer'],
      'frontend': ['frontend', 'front-end', 'front end', 'ui engineer', 'software engineer', 'engineer', 'react', 'vue', 'angular'],
      'backend': ['backend', 'back-end', 'back end', 'server', 'api', 'software engineer', 'engineer'],
      'ml': ['machine learning', 'ml engineer', 'ml', 'ai engineer', 'data scientist', 'deep learning'],
      'ai': ['ai engineer', 'artificial intelligence', 'ai', 'machine learning', 'ml', 'deep learning'],
      'data science': ['data scientist', 'data science', 'data engineer', 'ml engineer', 'analytics', 'data analyst'],
      'devops': ['devops', 'dev ops', 'infrastructure', 'site reliability', 'sre', 'platform engineer', 'cloud engineer'],
      'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
      'security': ['security', 'infosec', 'cybersecurity', 'appsec', 'security engineer', 'secops'],
      'qa': ['qa', 'quality assurance', 'test', 'sdet', 'test engineer', 'quality engineer', 'testing'],
      'design': ['designer', 'design', 'visual designer', 'ui designer', 'ux designer', 'graphic designer'],
      'product design': ['product designer', 'product design', 'ux designer', 'ui/ux', 'ux/ui'],
    };

    // Function to find best matching job based on role preferences
    const findBestJob = (jobs: Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string }>) => {
      if (jobs.length === 0) return null;
      
      const roleTypes = candidate.role_type || [];
      if (roleTypes.length === 0) return jobs[0]; // No preferences, return first job

      for (const job of jobs) {
        const titleLower = job.job_title.toLowerCase();

        for (const roleType of roleTypes) {
          const roleLower = roleType.toLowerCase();
          const patterns = rolePatterns[roleLower] || [roleLower];

          for (const pattern of patterns) {
            if (titleLower.includes(pattern)) {
              return job;
            }
          }
        }
      }

      return jobs[0]; // Fallback to first job if no match found
    };

    // Join matches with startup data and add job data
    const matches = rawMatches.map((m) => {
      const startup = startupsById[m.startup_id] ?? null;
      const jobs = startup?.id ? jobsByStartupId[startup.id] || [] : [];
      const bestJob = findBestJob(jobs);

      return {
        id: m.id,
        score: m.score,
        matched_at: m.matched_at,
        startup: startup,
        has_job_listings: jobs.length > 0,
        job: bestJob ? {
          job_title: bestJob.job_title,
          job_url: bestJob.job_url,
          job_type: bestJob.job_type,
          salary_range: bestJob.salary_range,
          experience_level: bestJob.experience_level,
        } : null,
      };
    });

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      matches,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

