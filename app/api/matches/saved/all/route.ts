import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getCache, setCache } from '@/lib/redis-cache';

// GET: Get all saved match IDs for the current user (batched)
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try cache first
    const cacheKey = `saved_matches:${user.email}:ALL_V2`;
    const cachedData = await getCache<{ matchIds: string[]; startupIds: string[] }>(cacheKey);

    if (cachedData) {
      console.log('[Saved Matches Cache] HIT:', {
        user: user.email,
        matchCount: cachedData.matchIds?.length,
        startupCount: cachedData.startupIds?.length,
        cacheKey,
      });

      return NextResponse.json({
        matchIds: cachedData.matchIds || [],
        startupIds: cachedData.startupIds || [],
        cached: true,
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60',
          'X-Cache-Status': 'HIT',
        },
      });
    }

    // Cache miss - fetch from database
    console.log('[Saved Matches Cache] MISS - Fetching from database:', {
      user: user.email,
      cacheKey,
    });

    const { data: savedMatches, error } = await supabase
      .from('saved_matches')
      .select('match_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching saved matches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch saved matches' },
        { status: 500 }
      );
    }

    // Extract match IDs
    const matchIds = savedMatches?.map(sm => sm.match_id) || [];

    // Also get startup_ids for these matches (to handle match ID changes)
    // This allows frontend to check by startup_id instead of match_id
    let startupIds: string[] = [];
    if (matchIds.length > 0) {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, startup_id')
        .in('id', matchIds);
      
      if (!matchesError && matches) {
        startupIds = matches
          .map(m => m.startup_id)
          .filter((id): id is string => !!id);
        console.log('[Saved Matches Cache] Fetched startup_ids for saved matches:', {
          matchCount: matchIds.length,
          startupCount: startupIds.length,
        });
      }
    }

    // Cache for 1 hour (will be invalidated on save/unsave)
    await setCache(cacheKey, { matchIds, startupIds }, 3600);

    console.log('[Saved Matches Cache] Stored:', {
      user: user.email,
      matchCount: matchIds.length,
      startupCount: startupIds.length,
      cacheKey,
    });

    return NextResponse.json({
      matchIds,
      startupIds,
      cached: false,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'X-Cache-Status': 'MISS',
      },
    });

  } catch (error) {
    console.error('Error in saved matches batch endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
