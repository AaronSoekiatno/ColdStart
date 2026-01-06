import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API route to fetch founder profile pictures for the landing page
 * Returns startups with founders_pfp, filtering out null/empty arrays
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const { data: startups, error } = await supabaseAdmin
      .from('startups')
      .select('id, name, founders_pfp, founder_names')
      .not('founders_pfp', 'is', null)
      .limit(100);

    if (error) {
      console.error('Error fetching founder profile pictures:', error);
      return NextResponse.json(
        { error: 'Failed to fetch founder profile pictures' },
        { status: 500 }
      );
    }

    // Filter and process startups with valid founder profile pictures
    const startupsWithFounders = (startups || [])
      .map((startup: any) => {
        // Parse founders_pfp - handle both array and string formats
        let foundersPfp: string[] = [];
        
        if (Array.isArray(startup.founders_pfp)) {
          foundersPfp = startup.founders_pfp
            .map((url: any) => String(url).trim())
            .filter((url: string) => url && url !== '');
        } else if (typeof startup.founders_pfp === 'string') {
          foundersPfp = startup.founders_pfp
            .split(',')
            .map((url: string) => url.trim())
            .filter((url: string) => url && url !== '');
        }

        // Parse founder names
        const founderNames = startup.founder_names
          ? startup.founder_names.split(',').map((n: string) => n.trim()).filter((n: string) => n)
          : [];

        // Only return if we have at least one valid profile picture
        if (foundersPfp.length > 0) {
          return {
            id: startup.id,
            name: startup.name,
            founders_pfp: foundersPfp,
            founder_names: founderNames,
          };
        }
        return null;
      })
      .filter((item: any) => item !== null);

    return NextResponse.json({
      startups: startupsWithFounders,
      count: startupsWithFounders.length,
    }, {
      headers: {
        // Cache for 24 hours on CDN, serve stale for 1 week while revalidating
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Exception fetching founder profile pictures:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

