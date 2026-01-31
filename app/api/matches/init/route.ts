import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
import { getCache, setCache } from '@/lib/redis-cache';

/**
 * GET /api/matches/init
 * 
 * Consolidated endpoint to fetch all data needed for the matches page in a single request.
 * This significantly reduces Vercel Function Invocations and Edge Requests.
 * 
 * Includes:
 * 1. Candidate Info (subscription, preferences)
 * 2. Saved Matches IDs (both match_ids and startup_ids)
 * 3. GitHub Analysis Results
 * 4. Assessment Status
 * 5. Page 1 of Matches (first 20 items)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Fetch Candidate Info (with caching check)
    const candidateCacheKey = `candidate_info:${user.email}`;
    let candidate = await getCache<any>(candidateCacheKey);

    if (!candidate) {
      const { data, error } = await supabaseAdmin
        .from('candidates')
        .select('id, subscription_tier, subscription_status, stripe_customer_id, role_type, job_type, skills, beta_access, onboarding_completed, github_username, github_access_token, assessment_repo_url, assessment_started_at, assessment_repo_created_at, years_of_experience')
        .eq('email', user.email)
        .single();
      
      if (!error && data) {
        candidate = data;
        await setCache(candidateCacheKey, candidate, 86400); // 24h cache
      }
    }

    if (!candidate) {
      return NextResponse.json({
        error: 'Candidate not found',
        needsOnboarding: true
      }, { status: 404 });
    }

    // Enforce onboarding completion and GitHub connection
    if (!candidate.onboarding_completed) {
      return NextResponse.json({
        error: 'Onboarding not completed',
        needsOnboarding: true,
        onboardingCompleted: false
      }, { status: 403 });
    }

    // Enforce GitHub connection (required for onboarding)
    if (!candidate.github_access_token) {
      return NextResponse.json({
        error: 'GitHub not connected',
        needsOnboarding: true,
        githubRequired: true
      }, { status: 403 });
    }

    // 2. Fetch everything else in parallel now that we have candidate.id
    const [savedMatchesData, githubData, assessmentData, matchesResponse] = await Promise.all([
      // Saved Matches
      fetchSavedMatchesInternal(user, candidate.id),
      // GitHub Results
      fetchGitHubResultsInternal(candidate.id),
      // Assessment Status logic (already in candidate object but formatted here)
      formatAssessmentStatusInternal(candidate),
      // Page 1 Matches (Calling the internal endpoint or duplicating logic)
      // Since we want to save invocations, we'll fetch from the DB directly
      fetchMatchesFirstPageInternal(candidate)
    ]);

    const duration = Date.now() - startTime;
    console.log(`[Init Matches] Consolidated fetch complete in ${duration}ms for ${user.email}`);

    return NextResponse.json({
      candidate,
      savedMatches: savedMatchesData,
      githubAnalysis: githubData,
      assessment: assessmentData,
      matches: matchesResponse.items || [],
      pagination: matchesResponse.pagination,
      onboardingCompleted: candidate.onboarding_completed === true,
      isPremium: isSubscribed(candidate)
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Response-Time': `${duration}ms`
      }
    });

  } catch (error) {
    console.error('[Init Matches] Fatal error:', error);
    return NextResponse.json({ error: 'Failed to initialize matches' }, { status: 500 });
  }
}

// Internal Helper Functions (Logic extracted from existing endpoints)

async function fetchSavedMatchesInternal(user: any, candidateId: string) {
  const cacheKey = `saved_matches:${user.email}:ALL_V2`;
  const cachedData = await getCache<{ matchIds: string[]; startupIds: string[] }>(cacheKey);

  if (cachedData) return cachedData;

  const { data: savedMatches } = await supabaseAdmin!
    .from('saved_matches')
    .select('match_id')
    .eq('user_id', user.id);

  const matchIds = savedMatches?.map(sm => sm.match_id) || [];
  let startupIds: string[] = [];

  if (matchIds.length > 0) {
    const { data: matches } = await supabaseAdmin!
      .from('matches')
      .select('startup_id')
      .in('id', matchIds);
    
    if (matches) {
      startupIds = matches.map(m => m.startup_id).filter((id): id is string => !!id);
    }
  }

  const result = { matchIds, startupIds };
  await setCache(cacheKey, result, 3600);
  return result;
}

async function fetchGitHubResultsInternal(candidateId: string) {
  try {
    const { data: analyses, error: analysesError } = await supabaseAdmin!
      .from('github_code_analyses')
      .select(`
        *,
        repository:github_repositories(
          id, name, full_name, language, languages, stargazers_count, forks_count
        )
      `)
      .eq('candidate_id', candidateId);

    if (analysesError) {
      console.error('[Init GitHub] Error querying analyses:', analysesError);
      return { repositories: [], total_count: 0, has_results: false };
    }

    if (!analyses || analyses.length === 0) {
      return { repositories: [], total_count: 0, has_results: false };
    }

    // Format individual repositories
    const repositories = analyses.map(analysis => ({
      id: analysis.repository_id,
      name: analysis.repository?.name || 'Unknown',
      full_name: analysis.repository?.full_name || '',
      language: analysis.repository?.language,
      languages: analysis.repository?.languages || {},
      stargazers_count: analysis.repository?.stargazers_count || 0,
      forks_count: analysis.repository?.forks_count || 0,
      quality_score: analysis.overall_score,
      extraction_status: analysis.extraction_status,
      analyzed_at: analysis.created_at,
    }));

    // Calculate aggregations for the UI
    const totalLanguages: Record<string, number> = {};
    let totalBytesTotal = 0;
    let avgQualityScore = 0;
    let scoreCount = 0;

    repositories.forEach(repo => {
      // Aggregate languages
      if (repo.languages) {
        Object.entries(repo.languages).forEach(([lang, bytes]) => {
          const val = Number(bytes);
          totalLanguages[lang] = (totalLanguages[lang] || 0) + val;
          totalBytesTotal += val;
        });
      }

      // Average quality
      if (repo.quality_score !== null && repo.quality_score !== undefined) {
        avgQualityScore += repo.quality_score;
        scoreCount++;
      }
    });

    const topLanguages = Object.entries(totalLanguages)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([lang, bytes]) => ({
        language: lang,
        bytes: Number(bytes),
        percentage: totalBytesTotal > 0 ? Math.round((Number(bytes) / totalBytesTotal) * 100) : 0,
      }));

    return {
      repositories,
      aggregate_stats: {
        total_repositories: repositories.length,
        top_languages: topLanguages,
        average_quality_score: scoreCount > 0 ? Math.round(avgQualityScore / scoreCount) : null,
      },
      total_count: repositories.length,
      has_results: true,
    };
  } catch (error) {
    console.error('[Init GitHub] Fatal error:', error);
    return { repositories: [], total_count: 0, has_results: false };
  }
}

function formatAssessmentStatusInternal(candidate: any) {
  if (!candidate.assessment_repo_url) {
    return { status: 'not_started', repoUrl: null };
  }
  return {
    status: candidate.assessment_started_at ? 'in_progress' : 'not_started',
    repoUrl: candidate.assessment_repo_url,
    startedAt: candidate.assessment_started_at,
  };
}

async function fetchMatchesFirstPageInternal(candidate: any) {
  try {
    const startTime = Date.now();
    // 1. Fetch matches
    const { data: rawMatches, error: matchesError } = await supabaseAdmin!
      .from('matches')
      .select('id, score, matched_at, startup_id')
      .eq('candidate_id', candidate.id)
      .order('score', { ascending: false })
      .limit(20);

    if (matchesError) {
      console.error('[Matches Init] DB Error fetching matches:', matchesError);
      return { items: [], pagination: { total: 0, hasMore: false } };
    }

    if (!rawMatches || rawMatches.length === 0) {
      console.log('[Matches Init] No matches found for candidate UUID:', candidate.id);
      return { items: [], pagination: { total: 0, hasMore: false } };
    }

    const startupIds = Array.from(new Set(
      rawMatches.map(m => m.startup_id).filter((id): id is string => !!id && typeof id === 'string')
    ));
    
    console.log(`[Matches Init] Found ${rawMatches.length} raw matches leading to ${startupIds.length} unique startups`);
    if (startupIds.length > 0) {
      console.log(`[Matches Init] Sample Startup IDs (first 3): ${startupIds.slice(0, 3).join(', ')}`);
    } else {
      console.warn('[Matches Init] All matches had NULL startup_id');
      return { items: [], pagination: { total: 0, hasMore: false } };
    }

    // 2. Fetch data in parallel
    const [startups3Result, startups1Result, jobsResult, unlinkedJobsResult] = await Promise.all([
      // Startups3
      supabaseAdmin!
        .from('startups3')
        .select(`
          id, name, industry, location, yc_description, team_size,
          funding_amount, website, founder_emails,
          founder_names, founder_linkedin, founder_twitter_urls,
          founder_backgrounds, founders_pfp, batch, description,
          company_logo, yc_link, company_twitter_url, keywords
        `)
        .in('id', startupIds),
      // Startups (startups1) - User suggested looking here for missing data
      supabaseAdmin!
        .from('startups')
        .select(`
          id, name, industry, location, yc_description, team_size,
          funding_amount, website, founder_emails,
          founder_names, founder_linkedin, founder_twitter_urls,
          founder_backgrounds, founders_pfp, batch, description,
          company_logo, yc_link, company_twitter_url, keywords
        `)
        .in('id', startupIds),
      // Linked Jobs
      supabaseAdmin!.from('jobs').select('*').in('startup_id', startupIds).not('job_url', 'is', null),
      // Unlinked Jobs
      supabaseAdmin!.from('jobs').select('*').is('startup_id', null).not('job_url', 'is', null).limit(300)
    ]);

    const { data: s3Rows, error: s3Error } = startups3Result;
    const { data: s1Rows, error: s1Error } = startups1Result;
    const { data: allLinkedJobs, error: jError } = jobsResult;
    const { data: unlinkedJobs } = unlinkedJobsResult;

    if (s3Error) console.error('[Matches Init] Error fetching startups3:', s3Error);
    if (s1Error) console.error('[Matches Init] Error fetching startups1:', s1Error);
    if (jError) console.warn('[Matches Init] Error fetching jobs:', jError);

    console.log(`[Matches Init] DB returned ${s3Rows?.length || 0} from startups3 and ${s1Rows?.length || 0} from startups1`);

    // 3. Map and merge startups for O(1) lookup
    const startupsById: Record<string, any> = {};
    const allUniqueRows = [...(s3Rows || []), ...(s1Rows || [])];
    
    for (const s of allUniqueRows) {
      if (!s.id) continue;
      const existing = startupsById[s.id];
      
      if (!existing) {
        startupsById[s.id] = { ...s };
      } else {
        // Multi-table merge logic: If s has more data than existing, merge them
        // Priority fields are emails, batch, and name
        const getScore = (row: any) => {
          let score = 0;
          if (row.founder_emails && row.founder_emails.length > 5) score += 10;
          if (row.batch) score += 5;
          if (row.yc_description) score += 2;
          if (row.company_logo) score += 1;
          return score;
        };

        if (getScore(s) > getScore(existing)) {
          // If the new one is significantly better, take its fields
          Object.keys(s).forEach(key => {
            const k = key as keyof typeof s;
            if (s[k] && !existing[k]) (existing as any)[k] = s[k];
          });
          // Special case: if base score is higher, maybe we prefer its name and basic info
          if (getScore(s) > getScore(existing) + 5) {
             // Overwrite core fields if new record is much higher quality
             if (s.founder_emails) existing.founder_emails = s.founder_emails;
             if (s.founder_names) existing.founder_names = s.founder_names;
             if (s.batch) existing.batch = s.batch;
          }
        } else {
          // New one is lower score, but might have individual fields missing in existing
          Object.keys(s).forEach(key => {
            const k = key as keyof typeof s;
            if (s[k] && !existing[k]) (existing as any)[k] = s[k];
          });
        }
      }
    }

    // Process merged records (parse founders etc)
    Object.values(startupsById).forEach(s => {
      const parseField = (field: any) => {
        if (!field) return [];
        if (Array.isArray(field)) return field.map(v => String(v).trim()).filter(v => v);
        return String(field).split(',').map(v => v.trim()).filter(v => v);
      };

      const names = parseField(s.founder_names);
      const emails = parseField(s.founder_emails);
      const backgrounds = parseField(s.founder_backgrounds);
      const linkedins = parseField(s.founder_linkedin);
      const twitters = parseField(s.founder_twitter_urls);
      const pfps = parseField(s.founders_pfp);

      const maxFounders = Math.max(names.length, emails.length, backgrounds.length, linkedins.length, twitters.length);
      const founders = [];
      for (let i = 0; i < maxFounders; i++) {
        if (names[i]) {
          founders.push({
            id: `${s.id}-founder-${i}`,
            name: names[i],
            email: emails[i] || null,
            background: backgrounds[i] || null,
            linkedin_url: linkedins[i] || null,
            twitter_url: twitters[i] || null,
            profile_picture: pfps[i] || null,
          });
        }
      }

      startupsById[s.id] = {
        ...s,
        founders,
        industry: s.industry || 'Unknown',
        location: s.location || 'Unknown',
        website: s.website || '',
      };
    });

    // 4. Link Jobs
    const jobsByStartupId: Record<string, any[]> = {};
    const addJob = (sId: string, job: any) => {
      if (!jobsByStartupId[sId]) jobsByStartupId[sId] = [];
      jobsByStartupId[sId].push({
        job_title: job.job_title,
        job_url: job.job_url,
        job_type: job.job_type,
        salary_range: job.salary_range,
        experience_level: job.experience_level,
        created_at: job.created_at,
      });
    };

    allLinkedJobs?.forEach(j => {
      if (j.startup_id) addJob(j.startup_id, j);
    });

    // Fuzzy matching for unlinked jobs
    if (unlinkedJobs) {
      const allStartupsList = Object.values(startupsById);
      const nameToId = new Map<string, string>(
        allStartupsList.map(s => [String(s.name).toLowerCase().trim(), String(s.id)])
      );
      for (const job of unlinkedJobs) {
        const cName = job.company_name?.toLowerCase().trim();
        if (!cName) continue;
        const sId = nameToId.get(cName);
        if (sId) {
          addJob(sId, job);
        } else {
          for (const [sName, sId2] of nameToId.entries()) {
            if (cName.includes(sName) || sName.includes(cName)) {
              addJob(sId2, job);
              break;
            }
          }
        }
      }
    }

    // 5. Build final items list
    const items = rawMatches.map(m => {
      const startup = startupsById[m.startup_id];
      if (!startup) {
        console.warn(`[Matches Init] No startup data found in startups3 for ID: ${m.startup_id}`);
        return null;
      }

      const jobs = jobsByStartupId[m.startup_id] || [];
      return {
        id: m.id,
        score: m.score,
        matched_at: m.matched_at,
        startup,
        jobs,
        has_job_listings: jobs.length > 0
      };
    }).filter((m): m is any => m !== null);

    const duration = Date.now() - startTime;
    console.log(`[Matches Init] Internal processing took ${duration}ms. Produced ${items.length} matches.`);

    return {
      items,
      pagination: {
        total: items.length, // approximation for page 1
        hasMore: items.length === 20
      }
    };
  } catch (error) {
    console.error('[Matches Init] Fatal internal error:', error);
    return { items: [], pagination: { total: 0, hasMore: false } };
  }
}

function isSubscribed(candidate: any): boolean {
  if (!candidate) return false;
  return candidate.subscription_tier === 'premium' && candidate.subscription_status === 'active';
}
