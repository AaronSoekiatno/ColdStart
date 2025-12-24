import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteCache } from '@/lib/redis-cache';

// GET: Fetch all saved matches for the authenticated user
export async function GET(req: NextRequest) {
  try {
    // Create server client with cookies
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, let's check if there are any saved matches at all for this user
    const { data: rawSavedMatches, error: rawError } = await supabase
      .from('saved_matches')
      .select('id, match_id, saved_at')
      .eq('user_id', user.id);

    if (rawError) {
      console.error('[Saved Matches GET] Error fetching raw saved matches:', rawError);
    }

    if (!rawSavedMatches || rawSavedMatches.length === 0) {
      return NextResponse.json({
        matches: [],
        count: 0,
      });
    }

    // Get the match IDs
    const matchIds = rawSavedMatches.map((s: any) => s.match_id).filter((id: any) => !!id);

    // Fetch matches and their startups separately to avoid join issues
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('matches')
      .select('id, score, matched_at, startup_id')
      .in('id', matchIds);

    if (matchesError) {
      console.error('[Saved Matches GET] Error fetching matches:', matchesError);
    }

    if (!matches || matches.length === 0) {
      console.warn('[Saved Matches GET] No matches found for saved match IDs');
      return NextResponse.json({
        matches: [],
        count: 0,
      });
    }

    // Get startup IDs from matches
    const matchStartupIds = matches
      .map((m: any) => m.startup_id)
      .filter((id: string | null): id is string => !!id);

    // Fetch startups
    const { data: startups, error: startupsError } = await supabaseAdmin
      .from('startups3')
      .select(`
        id,
        name,
        industry,
        location,
        funding_amount,
        website,
        founder_emails,
        founder_names,
        founder_linkedin,
        founder_twitter_urls,
        founder_backgrounds,
        founders_pfp,
        batch,
        description,
        company_logo,
        yc_link,
        company_twitter_url,
        yc_description,
        team_size,
        keywords
      `)
      .in('id', matchStartupIds)
      .not('name', 'is', null)
      .not('industry', 'is', null)
      .not('location', 'is', null)
      .not('batch', 'is', null);

    if (startupsError) {
      console.error('[Saved Matches GET] Error fetching startups:', startupsError);
    }

    // Create a map of startup_id -> startup data (convert Map to Record for easier access)
    const startupsById: Record<string, any> = {};
    (startups || []).forEach((s: any) => {
      startupsById[s.id] = s;
    });
    const matchesById = new Map(matches.map((m: any) => [m.id, m]));

    // Combine the data
    const savedMatches = rawSavedMatches
      .map((saved: any) => {
        const match = matchesById.get(saved.match_id);
        if (!match) return null;

        const startup = match.startup_id ? startupsById[match.startup_id] : null;
        if (!startup) return null;

        return {
          id: saved.id,
          match_id: saved.match_id,
          saved_at: saved.saved_at,
          matches: {
            ...match,
            startups3: startup,
          },
        };
      })
      .filter((s: any) => s !== null);

    // Get candidate preferences for filtering (job_type, years_of_experience, role_type)
    let candidate: { 
      id: string; 
      role_type: string[] | null;
      job_type: string | null;
      years_of_experience: string | null;
    } | null = null;
    
    if (supabaseAdmin && user.email) {
      const { data: candidateData } = await supabaseAdmin
        .from('candidates')
        .select('id, role_type, job_type, years_of_experience')
        .eq('email', user.email)
        .maybeSingle();
      candidate = candidateData || null;
    }

    // Get startup IDs from the combined data
    const startupIds = savedMatches
      .map((saved: any) => saved.matches?.startup_id)
      .filter((id: string | null | undefined): id is string => !!id);
    
    // Fetch jobs for these startups to determine has_job_listings
    const jobsByStartupId: Record<string, Array<{
      job_title: string;
      job_url: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
      created_at?: string;
    }>> = {};

    if (startupIds.length > 0 && supabaseAdmin) {
      // Batch queries to avoid Supabase limits
      const BATCH_SIZE = 100;
      const allJobs: any[] = [];
      
      for (let i = 0; i < startupIds.length; i += BATCH_SIZE) {
        const batch = startupIds.slice(i, i + BATCH_SIZE);
        const { data: batchJobs, error: jobsError } = await supabaseAdmin
          .from('jobs')
          .select('startup_id, job_title, job_url, job_type, salary_range, experience_level, created_at')
          .in('startup_id', batch)
          .not('job_url', 'is', null);
        
        if (!jobsError && batchJobs) {
          allJobs.push(...batchJobs);
        }
      }

      // Group jobs by startup_id
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
            created_at: job.created_at || undefined,
          });
        }
      }
    }

    // Also link jobs without startup_id by matching company_name to startup name
    // This matches the logic in /api/matches to ensure consistency
    if (startupIds.length > 0 && supabaseAdmin && Object.keys(startupsById).length > 0) {
      // Create a map of startup name (lowercase) to startup ID for quick lookup
      const startupNameToId = new Map<string, string>();
      Object.values(startupsById).forEach(startup => {
        startupNameToId.set(startup.name.toLowerCase().trim(), startup.id);
      });

      // Fetch unlinked jobs (limit to avoid performance issues)
      const { data: unlinkedJobs, error: unlinkedJobsError } = await supabaseAdmin
        .from('jobs')
        .select('company_name, job_title, job_url, job_type, salary_range, experience_level, created_at')
        .is('startup_id', null)
        .not('job_url', 'is', null)
        .limit(300);

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
                if (!jobsByStartupId[startupId]) {
                  jobsByStartupId[startupId] = [];
                }
                jobsByStartupId[startupId].push({
                  job_title: job.job_title,
                  job_url: job.job_url,
                  job_type: job.job_type || undefined,
                  salary_range: job.salary_range || undefined,
                  experience_level: job.experience_level || undefined,
                  created_at: job.created_at || undefined,
                });
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
              created_at: job.created_at || undefined,
            });
          }
        }
      }
    }

    // Helper functions for job filtering (same as in /api/matches)
    const parseCandidateYearsOfExperience = (yearsStr: string | null | undefined): number | null => {
      if (!yearsStr) return null;
      const trimmed = yearsStr.trim().toLowerCase();
      if (trimmed === 'no-experience') return 0;
      if (trimmed === 'less-than-1') return 0;
      if (trimmed === '1-2') return 2;
      if (trimmed === '2-5') return 5;
      if (trimmed === '5-10') return 10;
      if (trimmed === '10-plus') return 10;
      if (trimmed.endsWith('+')) {
        const num = parseInt(trimmed.slice(0, -1));
        return isNaN(num) ? null : num;
      }
      const rangeMatch = trimmed.match(/^(\d+)(?:-(\d+))?$/);
      if (rangeMatch) {
        const max = rangeMatch[2] ? parseInt(rangeMatch[2]) : parseInt(rangeMatch[1]);
        return isNaN(max) ? null : max;
      }
      const num = parseInt(trimmed);
      return isNaN(num) ? null : num;
    };

    const parseJobExperienceLevel = (experienceLevel: string | null | undefined): number | null => {
      if (!experienceLevel) return null;
      const lower = experienceLevel.toLowerCase().trim();
      if (lower.includes('any') && (lower.includes('experience') || lower.includes('new grad') || lower.includes('grad'))) {
        return 0;
      }
      if (lower.includes('no experience') || lower.includes('experience not required')) {
        return 0;
      }
      if (lower.includes('entry') || lower.includes('new grad') || lower.includes('new graduate')) {
        return 0;
      }
      const rangeMatch = lower.match(/(\d+)(?:\s*-\s*(\d+))?\s*years?/);
      if (rangeMatch) {
        const max = rangeMatch[2] ? parseInt(rangeMatch[2]) : parseInt(rangeMatch[1]);
        return isNaN(max) ? null : max;
      }
      const plusMatch = lower.match(/(\d+)\+\s*years?/);
      if (plusMatch) {
        const num = parseInt(plusMatch[1]);
        return isNaN(num) ? null : num;
      }
      const singleMatch = lower.match(/(\d+)\s*years?/);
      if (singleMatch) {
        const num = parseInt(singleMatch[1]);
        return isNaN(num) ? null : num;
      }
      if (lower.includes('junior')) return 2;
      if (lower.includes('associate')) return 3;
      if (lower.includes('mid')) return 5;
      if (lower.includes('senior') || lower.includes('lead')) return 7;
      if (lower.includes('principal') || lower.includes('staff')) return 10;
      return null;
    };

    const filterJobsByType = (
      jobs: Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }>,
      candidateJobType: string | null | undefined
    ): Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }> => {
      if (!candidateJobType) return jobs;
      const normalizedCandidateType = candidateJobType.toLowerCase().trim();
      return jobs.filter(job => {
        if (!job.job_type) return true;
        const normalizedJobType = job.job_type.toLowerCase().trim();
        if (normalizedCandidateType === 'full-time') {
          return normalizedJobType === 'full-time' || 
                 normalizedJobType === 'fulltime' ||
                 (normalizedJobType.startsWith('full-time') && !normalizedJobType.includes('not') && !normalizedJobType.includes('non')) ||
                 (normalizedJobType.startsWith('fulltime') && !normalizedJobType.includes('not') && !normalizedJobType.includes('non'));
        } else if (normalizedCandidateType === 'part-time' || normalizedCandidateType === 'internship') {
          return normalizedJobType === 'internship' ||
                 normalizedJobType === 'intern' ||
                 normalizedJobType.startsWith('internship') ||
                 normalizedJobType.startsWith('intern') ||
                 normalizedJobType === 'part-time' ||
                 normalizedJobType === 'parttime' ||
                 normalizedJobType.startsWith('part-time') ||
                 normalizedJobType.startsWith('parttime') ||
                 normalizedJobType.includes('contract');
        }
        return true;
      });
    };

    const filterJobsByExperience = (
      jobs: Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }>,
      candidateYearsOfExperience: string | null | undefined
    ): Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }> => {
      if (!candidateYearsOfExperience) return jobs;
      const candidateMaxYears = parseCandidateYearsOfExperience(candidateYearsOfExperience);
      if (candidateMaxYears === null) return jobs;
      if (candidateMaxYears === 0) return jobs;
      return jobs.filter(job => {
        if (!job.experience_level) return true;
        const jobMaxYears = parseJobExperienceLevel(job.experience_level);
        if (jobMaxYears === null) return true;
        return jobMaxYears <= candidateMaxYears;
      });
    };

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

    const calculateJobScore = (job: { job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }): number => {
      const roleTypes = candidate?.role_type || [];
      if (roleTypes.length === 0) return 0;
      const titleLower = job.job_title.toLowerCase();
      let maxScore = 0;
      for (const roleType of roleTypes) {
        const roleLower = roleType.toLowerCase();
        const patterns = rolePatterns[roleLower] || [roleLower];
        for (const pattern of patterns) {
          if (titleLower.includes(pattern)) {
            const score = titleLower === pattern ? 100 : 
                         titleLower.startsWith(pattern) ? 80 :
                         titleLower.includes(pattern) ? 60 : 0;
            maxScore = Math.max(maxScore, score);
          }
        }
      }
      return maxScore;
    };

    const orderJobsByPreference = (jobs: Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }>): Array<{ job_title: string; job_url: string; job_type?: string; salary_range?: string; experience_level?: string; created_at?: string }> => {
      if (jobs.length === 0) return [];
      const jobsWithScores = jobs.map(job => ({
        job,
        score: calculateJobScore(job),
      }));
      jobsWithScores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.job.job_title.localeCompare(b.job.job_title);
      });
      return jobsWithScores.map(item => item.job);
    };

    // Transform data to match the expected format
    const transformedMatches = savedMatches
      .map((saved: any) => {
        const matchesData = saved.matches;
        const startups3Data = matchesData?.startups3;
        
        if (!matchesData || !startups3Data) {
          console.warn('[Saved Matches API] Filtering out saved match - missing data:', {
            savedId: saved.id,
            hasMatch: !!matchesData,
            hasStartup: !!startups3Data,
          });
          return null;
        }
        
        const startupId = matchesData.startup_id;
        let allJobs = startupId ? (jobsByStartupId[startupId] || []) : [];
        
        // Deduplicate jobs by job_url (in case same job was added via startup_id and company_name matching)
        const seenJobUrls = new Set<string>();
        allJobs = allJobs.filter(job => {
          if (!job.job_url) return false;
          if (seenJobUrls.has(job.job_url)) {
            return false; // Duplicate
          }
          seenJobUrls.add(job.job_url);
          return true;
        });
        
        // Apply server-side filtering based on candidate preferences (same as regular matches)
        // Filter by job_type first
        allJobs = filterJobsByType(allJobs, candidate?.job_type);
        
        // Then filter by experience_level
        allJobs = filterJobsByExperience(allJobs, candidate?.years_of_experience);
        
        // Order jobs by role preference (after filtering)
        const orderedJobs = orderJobsByPreference(allJobs);
        
        return {
          id: matchesData.id,
          score: matchesData.score,
          matched_at: matchesData.matched_at,
          has_job_listings: orderedJobs.length > 0,
          jobs: orderedJobs.length > 0 ? orderedJobs : undefined,
          // Keep 'job' for backward compatibility (first job in ordered list)
          job: orderedJobs.length > 0 ? orderedJobs[0] : null,
          startup: startups3Data,
        };
      })
      .filter((match: any): match is NonNullable<typeof match> => match !== null);
    
    return NextResponse.json({
      matches: transformedMatches,
      count: transformedMatches.length,
    });

  } catch (error) {
    console.error('Error in saved matches endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Save a match
export async function POST(req: NextRequest) {
  try {
    // Create server client with cookies
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

    if (authError || !user) {
      console.error('[Save Match POST] Unauthorized:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { matchId, startupId } = body;

    console.log('[Save Match POST] Received request:', { userId: user.id, matchId, startupId });

    if (!matchId) {
      console.error('[Save Match POST] Missing matchId');
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Get candidate_id from user email
    let candidateId: string | null = null;
    if (supabaseAdmin && user.email) {
      const { data: candidate } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      candidateId = candidate?.id || null;
    }

    // Verify the match exists, or try to find current match by startup_id
    let actualMatchId = matchId;
    if (supabaseAdmin) {
      const { data: matchExists, error: matchCheckError } = await supabaseAdmin
        .from('matches')
        .select('id')
        .eq('id', matchId)
        .maybeSingle();

      if (matchCheckError || !matchExists) {
        console.warn('[Save Match POST] Match does not exist, attempting to find current match:', { 
          matchId, 
          startupId,
          candidateId,
          error: matchCheckError?.message,
        });

        // Try to find the current match for this startup+candidate combination
        if (startupId && candidateId) {
          const { data: currentMatch, error: findError } = await supabaseAdmin
            .from('matches')
            .select('id')
            .eq('candidate_id', candidateId)
            .eq('startup_id', startupId)
            .maybeSingle();

          if (!findError && currentMatch) {
            console.log('[Save Match POST] Found current match for startup:', {
              oldMatchId: matchId,
              newMatchId: currentMatch.id,
              startupId,
            });
            actualMatchId = currentMatch.id;
          } else {
            console.warn('[Save Match POST] Could not find current match:', {
              startupId,
              candidateId,
              error: findError?.message,
            });
          }
        }
      } else {
        console.log('[Save Match POST] Match verified in database, inserting saved match...');
      }
    }

    // Insert saved match (use actualMatchId which may be the current match if old one was deleted)
    const { data, error } = await supabase
      .from('saved_matches')
      .insert({
        user_id: user.id,
        match_id: actualMatchId,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate error
      if (error.code === '23505') {
        console.log('[Save Match POST] Match already saved (duplicate)');
        return NextResponse.json(
          { error: 'Match already saved' },
          { status: 409 }
        );
      }
      // Check if it's a foreign key violation (match doesn't exist)
      if (error.code === '23503') {
        console.error('[Save Match POST] Match does not exist (foreign key violation):', { 
          originalMatchId: matchId,
          attemptedMatchId: actualMatchId,
          startupId,
          candidateId,
        });
        return NextResponse.json(
          { error: 'Match not found in database', details: 'The match you are trying to save does not exist. This may happen if matches were recently updated. Please refresh the page and try again.' },
          { status: 404 }
        );
      }
      console.error('[Save Match POST] Error saving match:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: 'Failed to save match', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Save Match POST] Successfully saved match:', { 
      savedMatchId: data?.id, 
      originalMatchId: matchId,
      actualMatchId: actualMatchId,
      note: actualMatchId !== matchId ? 'Used current match ID instead of original' : 'Used original match ID',
    });
    
    // Invalidate cache so next fetch gets fresh data
    const cacheKey = `saved_matches:${user.email}:ALL`;
    await deleteCache(cacheKey);
    console.log('[Save Match POST] Invalidated cache:', cacheKey);
    
    return NextResponse.json({
      success: true,
      savedMatch: data,
    });

  } catch (error) {
    console.error('Error in save match endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Unsave a match
export async function DELETE(req: NextRequest) {
  try {
    // Create server client with cookies
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

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Delete saved match
    const { error } = await supabase
      .from('saved_matches')
      .delete()
      .eq('user_id', user.id)
      .eq('match_id', matchId);

    if (error) {
      console.error('Error unsaving match:', error);
      return NextResponse.json(
        { error: 'Failed to unsave match' },
        { status: 500 }
      );
    }

    // Invalidate cache so next fetch gets fresh data
    const cacheKey = `saved_matches:${user.email}:ALL`;
    await deleteCache(cacheKey);
    console.log('[Unsave Match DELETE] Invalidated cache:', cacheKey);

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('Error in unsave match endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
