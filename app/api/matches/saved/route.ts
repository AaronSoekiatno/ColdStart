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

    // Create a map of startup_id -> startup data
    const startupsById = new Map((startups || []).map((s: any) => [s.id, s]));
    const matchesById = new Map(matches.map((m: any) => [m.id, m]));

    // Combine the data
    const savedMatches = rawSavedMatches
      .map((saved: any) => {
        const match = matchesById.get(saved.match_id);
        if (!match) return null;

        const startup = match.startup_id ? startupsById.get(match.startup_id) : null;
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
    }>> = {};

    if (startupIds.length > 0 && supabaseAdmin) {
      // Batch queries to avoid Supabase limits
      const BATCH_SIZE = 100;
      const allJobs: any[] = [];
      
      for (let i = 0; i < startupIds.length; i += BATCH_SIZE) {
        const batch = startupIds.slice(i, i + BATCH_SIZE);
        const { data: batchJobs, error: jobsError } = await supabaseAdmin
          .from('jobs')
          .select('startup_id, job_title, job_url, job_type, salary_range, experience_level')
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
          });
        }
      }
    }

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
        const jobs = startupId ? (jobsByStartupId[startupId] || []) : [];
        
        return {
          id: matchesData.id,
          score: matchesData.score,
          matched_at: matchesData.matched_at,
          has_job_listings: jobs.length > 0,
          jobs: jobs.length > 0 ? jobs : undefined,
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
    const { matchId } = body;

    console.log('[Save Match POST] Received request:', { userId: user.id, matchId });

    if (!matchId) {
      console.error('[Save Match POST] Missing matchId');
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Verify the match exists first
    if (!supabaseAdmin) {
      console.error('[Save Match POST] supabaseAdmin not available');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { data: matchExists, error: matchCheckError } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .single();

    if (matchCheckError || !matchExists) {
      console.error('[Save Match POST] Match does not exist:', { matchId, error: matchCheckError });
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    console.log('[Save Match POST] Match exists, inserting saved match...');

    // Insert saved match
    const { data, error } = await supabase
      .from('saved_matches')
      .insert({
        user_id: user.id,
        match_id: matchId,
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

    console.log('[Save Match POST] Successfully saved match:', { savedMatchId: data?.id, matchId });
    
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
