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

    // Get candidate ID
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get total count
    let { count: totalCount } = await supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id);

    // Get matches for sorting (limit to first 200 to avoid performance issues)
    // This ensures page 1 users see matches with jobs, while keeping query fast
    const fetchLimit = Math.max(200, offset + limit);
    let { data: allMatches, error: matchError } = await supabaseAdmin
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

    // If no matches found, try to find instant matches based on onboarding data
    if (!allMatches || allMatches.length === 0) {
      console.log('No pre-computed matches found. Attempting instant matching...');
      const instantMatches = await findInstantMatches(candidate, limit);
      
      if (instantMatches.length > 0) {
        // Use instant matches
        allMatches = instantMatches;
        totalCount = instantMatches.length;
      }
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

    // Check which startups have jobs with job_url
    const startupsWithJobs = new Set<string>();
    if (startupIds.length > 0) {
      const { data: jobsData } = await supabaseAdmin
        .from('jobs')
        .select('startup_id')
        .in('startup_id', startupIds)
        .not('job_url', 'is', null);

      if (jobsData) {
        jobsData.forEach(job => {
          if (job.startup_id) {
            startupsWithJobs.add(job.startup_id);
          }
        });
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

    // Join matches with startup data and add has_job_listings flag
    const matches = rawMatches.map((m) => ({
      id: m.id,
      score: m.score,
      matched_at: m.matched_at,
      startup: startupsById[m.startup_id] ?? null,
      has_job_listings: m.startup_id ? startupsWithJobs.has(m.startup_id) : false,
    }));

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

/**
 * Find instant matches for a candidate based on their onboarding preferences
 * This queries the jobs table directly to find relevant roles
 */
async function findInstantMatches(candidate: any, limit: number): Promise<any[]> {
  try {
    if (!supabaseAdmin) return [];

    const jobType = candidate.job_type;
    const roleTypes = candidate.role_type || [];
    const yearsOfExperience = candidate.years_of_experience;
    
    if (!roleTypes.length) return [];

    console.log('Finding instant matches for:', { jobType, roleTypes, yearsOfExperience });

    // Build query for jobs
    let query = supabaseAdmin
      .from('jobs')
      .select('startup_id, job_title, job_type')
      .not('startup_id', 'is', null);

    // Filter by job type if specified
    if (jobType) {
      // Map 'full-time'/etc to 'fulltime' if needed, or query both
      // The jobs table seems to use 'fulltime' based on scraper
      // Candidate table uses 'full-time'
      // Map 'full-time'/etc to database values
      // DB has 'Full-time' and 'Contract' (title case)
      // Frontend sends 'full-time', 'part-time', 'internship'
      
      if (jobType === 'full-time') {
         query = query.ilike('job_type', '%Full-time%');
      } else if (jobType === 'part-time') {
         query = query.ilike('job_type', '%Part-time%');
      } else if (jobType === 'internship') {
         // Database currently doesn't seem to have explicit 'Internship' type in checked sample
         // but logic should search for it or look in title as fallback
         query = query.or(`job_type.ilike.%Intern%,job_title.ilike.%Intern%`);
      } else {
         const normalizedJobType = jobType.replace('-', ' '); 
         query = query.ilike('job_type', `%${normalizedJobType}%`);
      }
    }

    // Filter by roles (OR condition)
    if (roleTypes.length > 0) {
      // Create an OR filter for job_role or job_title
      // e.g. job_role.ilike.%SWE%,job_role.ilike.%Backend%
      const roleConditions = roleTypes.map((role: string) => {
        // Map common roles to search terms
        const term = role === 'SWE' ? 'Software Engineer' :
                     role === 'SDE' ? 'Software Developer' :
                     role === 'PM' ? 'Product Manager' :
                     role;
        return `job_title.ilike.%${term}%`;
      }).join(',');
      
      query = query.or(roleConditions);
    }

    // Filter by Years of Experience / Seniority
    if (yearsOfExperience) {
      if (yearsOfExperience === '5-10' || yearsOfExperience === '10-plus') {
        // Prefer Senior roles
        // We can't easily do a "prefer" sort with basic Supabase query without RPC, 
        // but we can try to filter OR just let title match handle it if we add "Senior" to search terms.
        // For now, let's try to query for Senior titles explicitly if possible, or just log it.
        // Better strategy: Exclude "Intern" or "Junior" unless they want that.
        query = query.not('job_title', 'ilike', '%Intern%');
        query = query.not('job_title', 'ilike', '%Junior%');
      } else if (yearsOfExperience === 'no-experience' || yearsOfExperience === 'less-than-1' || yearsOfExperience === '1-2') {
        // Exclude Senior/Lead/Staff roles
        // Use a filter on job_title
        query = query.not('job_title', 'ilike', '%Senior%');
        query = query.not('job_title', 'ilike', '%Sr.%');
        query = query.not('job_title', 'ilike', '%Lead%');
        query = query.not('job_title', 'ilike', '%Staff%');
        query = query.not('job_title', 'ilike', '%Principal%');
      }
    }

    // Get jobs (limit to 50 significant matches)
    const { data: jobs, error } = await query.limit(50);

    if (error) {
      console.error('Error querying jobs for instant match:', error);
      return [];
    }

    if (!jobs || jobs.length === 0) {
      return [];
    }

    // Group by startup and create unique matches
    const startupIds = new Set<string>();
    const matchesToInsert: any[] = [];

    for (const job of jobs) {
      if (job.startup_id && !startupIds.has(job.startup_id)) {
        startupIds.add(job.startup_id);
        
        matchesToInsert.push({
          candidate_id: candidate.id,
          startup_id: job.startup_id,
          score: 0.85, // High default score for exact role match
          matched_at: new Date().toISOString()
        });

        if (matchesToInsert.length >= limit * 2) break; // Stop when we have enough
      }
    }

    if (matchesToInsert.length === 0) return [];

    console.log(`Persisting ${matchesToInsert.length} instant matches to DB...`);

    // Persist matches to database
    // validation: ensure candidate.id is present
    if (!candidate.id) {
       console.error('No candidate ID provided for instant matches');
       return [];
    }

    const { data: insertedMatches, error: insertError } = await supabaseAdmin
      .from('matches')
      .upsert(matchesToInsert, { onConflict: 'candidate_id,startup_id' })
      .select();

    if (insertError) {
      console.error('Error persisting instant matches:', insertError);
      return [];
    }

    return insertedMatches || [];
  } catch (error) {
    console.error('Exception in findInstantMatches:', error);
    return [];
  }
}

