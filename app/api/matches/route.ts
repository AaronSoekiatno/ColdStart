import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { emailLimitCache } from '@/lib/cache';

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
      // Fetch jobs with startup_id - batch queries to avoid Supabase limits
      // Supabase has limits on .in() queries (typically ~100-200 items)
      const BATCH_SIZE = 100;
      const allJobs: any[] = [];
      
      for (let i = 0; i < startupIds.length; i += BATCH_SIZE) {
        const batch = startupIds.slice(i, i + BATCH_SIZE);
        const { data: batchJobs, error: jobsError } = await supabaseAdmin
          .from('jobs')
          .select('startup_id, company_name, job_title, job_url, job_type, salary_range, experience_level')
          .in('startup_id', batch)
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
          } else {
            console.warn(`[Matches API] Error fetching jobs batch ${i / BATCH_SIZE + 1}:`, jobsError.message);
          }
        } else if (batchJobs) {
          allJobs.push(...batchJobs);
        }
      }

      // Process all fetched jobs
      if (allJobs.length > 0) {
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
        funding_amount?: string;
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
      // Batch queries to avoid Supabase limits on .in() queries
      // Supabase typically limits .in() to ~100-200 items
      const BATCH_SIZE = 100;
      const startupRows: any[] = [];
      let startupsError: any = null;
      
        for (let i = 0; i < startupIds.length; i += BATCH_SIZE) {
          const batch = startupIds.slice(i, i + BATCH_SIZE);
          const { data: batchStartups, error: batchError } = await supabaseAdmin
            .from('startups3')
            .select(`
              id, name, industry, location, yc_description, team_size,
              funding_amount, website, founder_emails,
              founder_names, founder_linkedin, founder_twitter_urls,
              founder_backgrounds, founders_pfp, batch, description,
              company_logo, yc_link, company_twitter_url
            `)
            .in('id', batch)
            // Filter out startups with null values in critical fields at database level
            .not('name', 'is', null)
            .not('industry', 'is', null)
            .not('location', 'is', null)
            .not('batch', 'is', null);
            // Note: We'll filter description and founder fields in code since they need OR logic
        
        if (batchError) {
          const errorMessage = batchError.message || '';
          const isRateLimit = errorMessage.includes('rate limit') || 
                             errorMessage.includes('quota') || 
                             errorMessage.includes('429') ||
                             errorMessage.includes('too many requests') ||
                             batchError.code === 'PGRST301' ||
                             batchError.code === 'PGRST116';
          
          if (isRateLimit) {
            console.error(`[Matches API] Supabase rate limit on startups batch ${i / BATCH_SIZE + 1}:`, batchError);
            startupsError = batchError;
            break; // Stop processing batches on rate limit
          }
          console.error(`[Matches API] Error fetching startups batch ${i / BATCH_SIZE + 1}:`, batchError.message);
          startupsError = batchError;
        } else if (batchStartups) {
          startupRows.push(...batchStartups);
        }
      }

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
        // Founders data is stored in startups3 columns, not a separate table
        // Parse founder data from comma-separated columns in startups3
        for (const s of startupRows) {
          // Parse founder names (comma-separated)
          const founderNames = s.founder_names 
            ? s.founder_names.split(',').map((n: string) => n.trim()).filter((n: string) => n)
            : [];
          
          // Parse founder emails (comma-separated)
          const founderEmails = s.founder_emails
            ? s.founder_emails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
            : [];
          
          // Parse founder backgrounds (comma-separated)
          const founderBackgrounds = s.founder_backgrounds
            ? s.founder_backgrounds.split(',').map((b: string) => b.trim()).filter((b: string) => b)
            : [];
          
          // Parse founder LinkedIn URLs (comma-separated)
          const founderLinkedIn = s.founder_linkedin
            ? s.founder_linkedin.split(',').map((l: string) => l.trim()).filter((l: string) => l)
            : [];
          
          // Parse founder Twitter URLs (comma-separated)
          const founderTwitter = s.founder_twitter_urls
            ? (Array.isArray(s.founder_twitter_urls) 
                ? s.founder_twitter_urls.map((t: any) => String(t).trim()).filter((t: string) => t)
                : String(s.founder_twitter_urls).split(',').map((t: string) => t.trim()).filter((t: string) => t))
            : [];
          
          // Parse founders_pfp array (could be array or comma-separated string)
          const foundersPfpArray: string[] = s.founders_pfp
            ? Array.isArray(s.founders_pfp)
              ? s.founders_pfp.map((url: any) => String(url).trim()).filter((url: string) => url && url !== '')
              : String(s.founders_pfp).split(',').map((url: string) => url.trim()).filter((url: string) => url && url !== '')
            : [];

          // Build founders array from parsed data
          // Match by index across all arrays
          const maxFounders = Math.max(
            founderNames.length,
            founderEmails.length,
            founderBackgrounds.length,
            founderLinkedIn.length,
            founderTwitter.length
          );
          
          const founders = [];
          for (let i = 0; i < maxFounders; i++) {
            if (founderNames[i]) {
              founders.push({
                id: `${s.id}-founder-${i}`, // Generate a unique ID
                name: founderNames[i],
                email: founderEmails[i] || undefined,
                background: founderBackgrounds[i] || undefined,
                linkedin_url: founderLinkedIn[i] || undefined,
                twitter_url: founderTwitter[i] || undefined,
                profile_picture: foundersPfpArray[i] || undefined,
              });
            }
          }

          startupsById[s.id] = {
            id: s.id,
            name: s.name,
            industry: s.industry || '',
            location: s.location || '',
            yc_description: s.yc_description ?? undefined,
            team_size: s.team_size ?? undefined,
            funding_amount: s.funding_amount ?? undefined,
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
            founders: founders,
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
      // OPTIMIZATION: Reduced from 1000 to 300 to cut egress by ~70%
      // We'll filter in code for case-insensitive matching
      const { data: unlinkedJobs, error: unlinkedJobsError } = await supabaseAdmin
        .from('jobs')
        .select('company_name, job_title, job_url, job_type, salary_range, experience_level')
        .is('startup_id', null)
        .not('job_url', 'is', null)
        .limit(300); // Reduced from 1000 to save egress

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

    // Don't paginate yet - we need to load job data for all matches first,
    // then sort with job prioritization, then paginate
    // This ensures startups with jobs appear first across all pages

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
    // Use allMatches (not rawMatches) so we can sort by jobs before paginating
    // Filter out matches where startup data is missing (these won't display properly)
    const matchesWithStartups = allMatches.map((m) => {
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
    
    // Filter out matches with null startups or incomplete data FIRST
    // Only show startups that have all required fields (no null values)
    const completeMatches = matchesWithStartups.filter((match) => {
      if (match.startup === null) {
        return false;
      }
      
      const startup = match.startup;
      
      // Check for null/empty values in critical fields
      // Description is required (either description or yc_description)
      const hasDescription = (startup.description && startup.description.trim()) || 
                            (startup.yc_description && startup.yc_description.trim());
      
      // Batch is required
      const hasBatch = startup.batch && startup.batch.trim();
      
      // Founder information is required (either founder_names or founders array)
      const hasFounders = (startup.founder_names && startup.founder_names.trim()) || 
                         (startup.founders && startup.founders.length > 0);
      
      // Basic required fields
      const hasName = startup.name && startup.name.trim();
      const hasIndustry = startup.industry && startup.industry.trim();
      const hasLocation = startup.location && startup.location.trim();
      
      // Check if all required fields are present
      const isComplete = hasDescription && hasBatch && hasFounders && hasName && hasIndustry && hasLocation;
      
      if (!isComplete) {
        const missingFields = [];
        if (!hasDescription) missingFields.push('description');
        if (!hasBatch) missingFields.push('batch');
        if (!hasFounders) missingFields.push('founders');
        if (!hasName) missingFields.push('name');
        if (!hasIndustry) missingFields.push('industry');
        if (!hasLocation) missingFields.push('location');
        
        return false;
      }
      
      return true;
    });
    
    // NOW sort: prioritize startups with jobs, then by score
    // This ensures users see job opportunities first, while still respecting match quality
    const sortedMatches = [...completeMatches].sort((a, b) => {
      // First, prioritize startups with jobs
      const aHasJobs = a.has_job_listings && a.jobs && a.jobs.length > 0;
      const bHasJobs = b.has_job_listings && b.jobs && b.jobs.length > 0;
      
      if (aHasJobs && !bHasJobs) {
        return -1; // a comes first (has jobs)
      }
      if (!aHasJobs && bHasJobs) {
        return 1; // b comes first (has jobs)
      }
      
      // If both have jobs or both don't have jobs, sort by score
      return b.score - a.score;
    });

    // Apply pagination AFTER sorting with job prioritization
    const matches = sortedMatches.slice(offset, offset + limit);
    

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
 * Uses 1-minute in-memory cache to reduce database queries.
 * 
 * @param limit - Maximum emails per startup per day (default: 15)
 * @returns Set of startup IDs that have exceeded the limit today
 */
async function getStartupsOverEmailLimit(limit: number = 15): Promise<Set<string>> {
  if (!supabaseAdmin) return new Set();
  
  // Check cache first (1 minute TTL)
  const cacheKey = `email-limit-${limit}`;
  const cached = emailLimitCache.get<Set<string>>(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // Calculate today's date range in UTC
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    // OPTIMIZATION: Only select startup_id column and use limit to reduce data transfer
    // We fetch a reasonable batch (500) to count in JS - most days won't have this many emails
    const { data, error } = await supabaseAdmin
      .from('generated_emails')
      .select('startup_id')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .limit(500);  // Cap egress - if more than 500 emails/day, some limit checks may miss
    
    if (error) {
      console.error('[Rate Limit] Error querying email counts:', error);
      return new Set();
    }
    
    if (!data || data.length === 0) {
      emailLimitCache.set(cacheKey, new Set<string>());
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
    
    // Cache result for 1 minute
    emailLimitCache.set(cacheKey, overLimitIds);
    
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
    const uniqueStartupIds: string[] = [];

    // First, collect unique startup IDs from jobs
    for (const job of jobs) {
      if (job.startup_id && !startupIds.has(job.startup_id)) {
        startupIds.add(job.startup_id);
        uniqueStartupIds.push(job.startup_id);
      }
    }

    if (uniqueStartupIds.length === 0) return [];

    // Validate that these startup IDs actually exist in startups3
    const { data: validStartups, error: validationError } = await supabaseAdmin
      .from('startups3')
      .select('id')
      .in('id', uniqueStartupIds);

    if (validationError) {
      console.error('Error validating startup IDs:', validationError);
      return [];
    }

    // Create a set of valid startup IDs
    const validStartupIdSet = new Set((validStartups || []).map(s => s.id));
    
    // Filter out invalid startup IDs and create matches
    const matchesToInsert: any[] = [];
    const invalidStartupIds: string[] = [];

    for (const startupId of uniqueStartupIds) {
      if (validStartupIdSet.has(startupId)) {
        matchesToInsert.push({
          candidate_id: candidate.id,
          startup_id: startupId,
          score: 0.85, // High default score for exact role match
          matched_at: new Date().toISOString()
        });

        if (matchesToInsert.length >= limit * 2) break; // Stop when we have enough
      } else {
        invalidStartupIds.push(startupId);
      }
    }

    if (invalidStartupIds.length > 0) {
      console.warn(`[Instant Matches] Skipped ${invalidStartupIds.length} invalid startup IDs that don't exist in startups3:`, invalidStartupIds.slice(0, 5));
    }

    if (matchesToInsert.length === 0) {
      console.log('[Instant Matches] No valid matches to insert after validation');
      return [];
    }

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


