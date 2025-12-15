import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API route to fetch startup logos for the landing page deck
 * Returns startups with logos, filtering out null/empty logos
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
      .select('id, name, company_logo')
      .not('company_logo', 'is', null)
      .neq('company_logo', '')
      .limit(200); // Fetch more logos to ensure we have enough for 6x24 grid (144 logos)

    if (error) {
      console.error('Error fetching startup logos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch startup logos' },
        { status: 500 }
      );
    }

    // Filter out any startups without valid logo URLs
    const startupsWithLogos = (startups || []).filter(
      (startup) => startup.company_logo && startup.company_logo.trim() !== ''
    );

    return NextResponse.json({
      startups: startupsWithLogos,
      count: startupsWithLogos.length,
    });
  } catch (error) {
    console.error('Exception fetching startup logos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
