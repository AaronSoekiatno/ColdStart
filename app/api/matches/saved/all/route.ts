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
    const cacheKey = `saved_matches:${user.email}:ALL`;
    const cachedIds = await getCache<string[]>(cacheKey);

    if (cachedIds) {
      console.log('[Saved Matches Cache] HIT:', {
        user: user.email,
        count: cachedIds.length,
        cacheKey,
      });

      return NextResponse.json({
        matchIds: cachedIds,
        cached: true,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
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

    // Cache for 1 hour (will be invalidated on save/unsave)
    await setCache(cacheKey, matchIds, 3600);

    console.log('[Saved Matches Cache] Stored:', {
      user: user.email,
      count: matchIds.length,
      cacheKey,
    });

    return NextResponse.json({
      matchIds,
      cached: false,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
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
