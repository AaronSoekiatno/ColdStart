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
    let { count: totalCount, error: countError } = await supabaseAdmin
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id);

    // Check for Supabase rate limit/quota errors
    if (countError) {
      const errorMessage = countError.message || '';
      const isRateLimit = errorMessage.includes('rate limit') || 
                         errorMessage.includes('quota') || 
                         errorMessage.includes('429') ||
                         errorMessage.includes('too many requests') ||
                         countError.code === 'PGRST301' || // PostgREST rate limit
                         countError.code === 'PGRST116'; // Not found (might be rate limit related)
      
      if (isRateLimit) {
        console.error('[Matches API] Supabase rate limit/quota exceeded on count query:', countError);
        return NextResponse.json(
          { 
            error: 'Database rate limit exceeded. Please try again in a few moments.',
            rateLimit: true 
          },
          { status: 429 }
        );
      }
      console.warn('[Matches API] Error getting match count (non-rate-limit):', countError);
      // Continue with totalCount as undefined if it's not a rate limit
    }

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
      const errorMessage = matchError.message || '';
      const isRateLimit = errorMessage.includes('rate limit') || 
                         errorMessage.includes('quota') || 
                         errorMessage.includes('429') ||
                         errorMessage.includes('too many requests') ||
                         matchError.code === 'PGRST301' ||
                         matchError.code === 'PGRST116';
      
      if (isRateLimit) {
        console.error('[Matches API] Supabase rate limit/quota exceeded on matches query:', matchError);
        return NextResponse.json(
          { 
            error: 'Database rate limit exceeded. Please try again in a few moments.',
            rateLimit: true 
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to load matches: ${matchError.message}` },
        { status: 500 }
      );
    }

    // Get startups that have exceeded daily email limit (15 emails/day)
    // These startups will be temporarily hidden from matches
    const overEmailLimitStartupIds = await getStartupsOverEmailLimit(15);
    
    // Filter out rate-limited startups from matches
    if (allMatches && overEmailLimitStartupIds.size > 0) {
      const originalCount = allMatches.length;
      allMatches = allMatches.filter(m => !overEmailLimitStartupIds.has(m.startup_id));
      if (originalCount !== allMatches.length) {
        console.log(`[Rate Limit] Filtered out ${originalCount - allMatches.length} startups over daily email limit`);
      }
    }

    // If no matches found, try to find instant matches based on onboarding data
    if (!allMatches || allMatches.length === 0) {
      console.log('No pre-computed matches found. Attempting instant matching...');
      const instantMatches = await findInstantMatches(candidate, limit);
      
      if (instantMatches.length > 0) {
        // Use instant matches (also filter out rate-limited startups)
        allMatches = instantMatches.filter(m => !overEmailLimitStartupIds.has(m.startup_id));
        totalCount = allMatches.length;
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
    
    if (startupIds.length === 0 && allMatches.length > 0) {
      console.warn('[Matches API] Warning: Matches exist but no valid startup_ids found');
    }

    // Fetch all jobs for startups in one query
    // First, get jobs that have startup_id set
    const jobsByStartupId: Record<string, Array<{
      job_title: string;
      job_url: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
    }>> = {};
    const startupsWithJobs = new Set<string>();
    // Track which startups have jobs with startup_id set (vs linked by company name)
    const startupsWithDirectJobLinks = new Set<string>();
    
    if (startupIds.length > 0) {
      // Fetch jobs with startup_id
      const { data: allJobs, error: jobsError } = await supabaseAdmin
        .from('jobs')
        .select('startup_id, company_name, job_title, job_url, job_type, salary_range, experience_level')
        .in('startup_id', startupIds)
        .not('job_url', 'is', null);

      if (jobsError) {
        const errorMessage = jobsError.message || '';
        const isRateLimit = errorMessage.includes('rate limit') || 
                           errorMessage.includes('quota') || 
                           errorMessage.includes('429') ||
                           errorMessage.includes('too many requests') ||
                           jobsError.code === 'PGRST301' ||
                           jobsError.code === 'PGRST116';
        
        if (isRateLimit) {
          console.error('[Matches API] Supabase rate limit/quota exceeded on jobs query:', jobsError);
          // Continue without jobs rather than failing completely
          // Jobs are optional, so we'll return matches without job data
        } else {
          console.warn('[Matches API] Error fetching jobs (non-rate-limit):', jobsError);
        }
      }

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
            startupsWithDirectJobLinks.add(job.startup_id); // Track direct links
          }
        }
      }

      // Also fetch jobs without startup_id and link them by company_name
      // We'll need startup names for this, so we'll do it after loading startup data
    }

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
        .select(`
          id, name, industry, location, yc_description, team_size,
          funding_stage, funding_amount, tags, website, founder_emails,
          founder_names, founder_linkedin, founder_twitter_urls,
          founder_backgrounds, founders_pfp, batch, description,
          company_logo, yc_link, company_twitter_url
        `)
        .in('id', startupIds);

      if (startupsError) {
        const errorMessage = startupsError.message || '';
        const isRateLimit = errorMessage.includes('rate limit') || 
                           errorMessage.includes('quota') || 
                           errorMessage.includes('429') ||
                           errorMessage.includes('too many requests') ||
                           startupsError.code === 'PGRST301' ||
                           startupsError.code === 'PGRST116';
        
        if (isRateLimit) {
          console.error('[Matches API] Supabase rate limit/quota exceeded on startups query:', startupsError);
          // Return rate limit error instead of continuing with empty startups
          return NextResponse.json(
            { 
              error: 'Database rate limit exceeded. Please try again in a few moments.',
              rateLimit: true 
            },
            { status: 429 }
          );
        }
        console.error('[Matches API] Error fetching startups (non-rate-limit):', startupsError);
      }
      
      if (!startupsError && startupRows) {
        console.log(`[Matches API] Found ${startupRows.length} startups for ${startupIds.length} startup IDs`);
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

    // Link jobs without startup_id by matching company_name to startup name
    // We'll fetch unlinked jobs and match them in code for case-insensitive matching
    if (startupIds.length > 0 && Object.keys(startupsById).length > 0) {
      // Create a map of startup name (lowercase) to startup ID for quick lookup
      const startupNameToId = new Map<string, string>();
      Object.values(startupsById).forEach(startup => {
        startupNameToId.set(startup.name.toLowerCase().trim(), startup.id);
      });

      // Fetch a reasonable number of unlinked jobs (limit to avoid performance issues)
      // We'll filter in code for case-insensitive matching
      const { data: unlinkedJobs, error: unlinkedJobsError } = await supabaseAdmin
        .from('jobs')
        .select('company_name, job_title, job_url, job_type, salary_range, experience_level')
        .is('startup_id', null)
        .not('job_url', 'is', null)
        .limit(1000); // Reasonable limit to avoid performance issues

      if (!unlinkedJobsError && unlinkedJobs) {
        for (const job of unlinkedJobs) {
          // Find matching startup by case-insensitive name match
          const jobCompanyNameLower = job.company_name?.toLowerCase().trim();
          if (!jobCompanyNameLower) continue;

          const matchingStartupId = startupNameToId.get(jobCompanyNameLower);
          
          // Also try partial matches (e.g., "Company Inc" matches "Company")
          if (!matchingStartupId) {
            for (const [startupNameLower, startupId] of startupNameToId.entries()) {
              if (jobCompanyNameLower === startupNameLower || 
                  jobCompanyNameLower.includes(startupNameLower) ||
                  startupNameLower.includes(jobCompanyNameLower)) {
                const partialMatchStartupId = startupId;
                if (partialMatchStartupId) {
                  if (!jobsByStartupId[partialMatchStartupId]) {
                    jobsByStartupId[partialMatchStartupId] = [];
                  }
                  jobsByStartupId[partialMatchStartupId].push({
                    job_title: job.job_title,
                    job_url: job.job_url,
                    job_type: job.job_type || undefined,
                    salary_range: job.salary_range || undefined,
                    experience_level: job.experience_level || undefined,
                  });
                  startupsWithJobs.add(partialMatchStartupId);
                }
                break;
              }
            }
          } else {
            // Exact match found
            if (!jobsByStartupId[matchingStartupId]) {
              jobsByStartupId[matchingStartupId] = [];
            }
            jobsByStartupId[matchingStartupId].push({
              job_title: job.job_title,
              job_url: job.job_url,
              job_type: job.job_type || undefined,
              salary_range: job.salary_range || undefined,
              experience_level: job.experience_level || undefined,
            });
            startupsWithJobs.add(matchingStartupId);
          }
        }
      }
    }

    // NOW sort matches: prioritize those with job listings
    // Do this AFTER all job linking is complete (both direct and by company name)
    // Prioritize startups with direct job links (startup_id) over those linked by company name
    const sortedMatches = [...allMatches].sort((a, b) => {
      const aHasDirectJobs = a.startup_id ? startupsWithDirectJobLinks.has(a.startup_id) : false;
      const bHasDirectJobs = b.startup_id ? startupsWithDirectJobLinks.has(b.startup_id) : false;
      const aHasJobs = a.startup_id ? startupsWithJobs.has(a.startup_id) : false;
      const bHasJobs = b.startup_id ? startupsWithJobs.has(b.startup_id) : false;

      // First priority: startups with direct job links (startup_id set)
      if (aHasDirectJobs && !bHasDirectJobs) return -1;
      if (!aHasDirectJobs && bHasDirectJobs) return 1;

      // Second priority: startups with jobs (either direct or linked by company name)
      if (aHasJobs && !bHasJobs) return -1;
      if (!aHasJobs && bHasJobs) return 1;

      // Then by score (already sorted from query, but ensure it's maintained)
      return b.score - a.score;
    });

    // Apply pagination AFTER sorting
    const rawMatches = sortedMatches.slice(offset, offset + limit);

    // Role matching patterns for ordering jobs by role preferences
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

    // Function to calculate job relevance score based on role preferences
    // Higher score = better match
    const calculateJobScore = (job: { job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string }): number => {
      const roleTypes = candidate.role_type || [];
      if (roleTypes.length === 0) return 0; // No preferences, all jobs equal

      const titleLower = job.job_title.toLowerCase();
      let maxScore = 0;

      for (const roleType of roleTypes) {
        const roleLower = roleType.toLowerCase();
        const patterns = rolePatterns[roleLower] || [roleLower];

        for (const pattern of patterns) {
          if (titleLower.includes(pattern)) {
            // Exact match gets higher score, partial match gets lower
            const score = titleLower === pattern ? 100 : 
                         titleLower.startsWith(pattern) ? 80 :
                         titleLower.includes(pattern) ? 60 : 0;
            maxScore = Math.max(maxScore, score);
          }
        }
      }

      return maxScore;
    };

    // Function to order jobs by role preferences (highest score first)
    const orderJobsByPreference = (jobs: Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string }>): Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string }> => {
      if (jobs.length === 0) return [];
      
      // Calculate score for each job and sort
      const jobsWithScores = jobs.map(job => ({
        job,
        score: calculateJobScore(job),
      }));

      // Sort by score (descending), then alphabetically by title for ties
      jobsWithScores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.job.job_title.localeCompare(b.job.job_title);
      });

      return jobsWithScores.map(item => item.job);
    };

    // Join matches with startup data and add job data
    // Filter out matches where startup data is missing (these won't display properly)
    const matchesWithStartups = rawMatches.map((m) => {
      const startup = startupsById[m.startup_id] ?? null;
      const allJobs = startup?.id ? jobsByStartupId[startup.id] || [] : [];
      // Order jobs by role preference
      const orderedJobs = orderJobsByPreference(allJobs);

      return {
        id: m.id,
        score: m.score,
        matched_at: m.matched_at,
        startup: startup,
        has_job_listings: orderedJobs.length > 0,
        jobs: orderedJobs.map(job => ({
          job_title: job.job_title,
          job_url: job.job_url,
          job_type: job.job_type,
          salary_range: job.salary_range,
          experience_level: job.experience_level,
        })),
        // Keep 'job' for backward compatibility (first job in ordered list)
        job: orderedJobs.length > 0 ? {
          job_title: orderedJobs[0].job_title,
          job_url: orderedJobs[0].job_url,
          job_type: orderedJobs[0].job_type,
          salary_range: orderedJobs[0].salary_range,
          experience_level: orderedJobs[0].experience_level,
        } : null,
      };
    });
    
    // Filter out matches with null startups and log if any were filtered
    const matches = matchesWithStartups.filter((match) => {
      if (match.startup === null) {
        console.warn(`[Matches API] Filtering out match ${match.id} - startup data not found for startup_id`);
        return false;
      }
      return true;
    });
    
    if (matchesWithStartups.length > matches.length) {
      console.warn(`[Matches API] Filtered out ${matchesWithStartups.length - matches.length} matches due to missing startup data`);
    }

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
    }, {
      headers: {
        // Cache for 5 minutes on CDN, serve stale for 1 hour while revalidating
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
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
 * Get startup IDs that have exceeded the daily email limit
 * Startups receiving too many emails per day are temporarily hidden from matches
 * to prevent email bombardment and ensure fair distribution.
 * 
 * @param limit - Maximum emails per startup per day (default: 15)
 * @returns Set of startup IDs that have exceeded the limit today
 */
async function getStartupsOverEmailLimit(limit: number = 15): Promise<Set<string>> {
  if (!supabaseAdmin) return new Set();
  
  try {
    // Calculate today's date range in UTC
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    // Query to get all generated emails for today
    const { data, error } = await supabaseAdmin
      .from('generated_emails')
      .select('startup_id')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());
    
    if (error) {
      console.error('[Rate Limit] Error querying email counts:', error);
      return new Set();
    }
    
    if (!data || data.length === 0) {
      return new Set();
    }
    
    // Count emails per startup
    const countByStartup = new Map<string, number>();
    for (const row of data) {
      if (row.startup_id) {
        countByStartup.set(row.startup_id, (countByStartup.get(row.startup_id) || 0) + 1);
      }
    }
    
    // Find startups over limit
    const overLimitIds = new Set<string>();
    for (const [startupId, count] of countByStartup) {
      if (count >= limit) {
        overLimitIds.add(startupId);
      }
    }
    
    if (overLimitIds.size > 0) {
      console.log(`[Rate Limit] Found ${overLimitIds.size} startups over daily email limit (${limit})`);
    }
    
    return overLimitIds;
  } catch (error) {
    console.error('[Rate Limit] Exception checking email limits:', error);
    return new Set();
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

