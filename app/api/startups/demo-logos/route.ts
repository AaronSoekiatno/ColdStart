import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API route to fetch company logos for demo startups on landing page
 * Query param: names - comma-separated list of startup names
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const namesParam = searchParams.get('names');
    
    if (!namesParam) {
      return NextResponse.json(
        { error: 'Names parameter required' },
        { status: 400 }
      );
    }

    const startupNames = namesParam.split(',').map(name => name.trim());

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Fetch logos for the specified startups
    const { data: startups, error } = await supabaseAdmin
      .from('startups')
      .select('name, company_logo')
      .in('name', startupNames);

    if (error) {
      console.error('Error fetching demo startup logos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch startup logos' },
        { status: 500 }
      );
    }

    // Create a map of startup name to logo URL
    const logos: Record<string, string> = {};
    (startups || []).forEach((startup) => {
      if (startup.company_logo && startup.company_logo.trim() !== '') {
        logos[startup.name] = startup.company_logo;
      }
    });

    return NextResponse.json({ logos });
  } catch (error) {
    console.error('Exception fetching demo startup logos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
