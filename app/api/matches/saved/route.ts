import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

    // Fetch saved matches with full match details
    const { data: savedMatches, error: savedError } = await supabase
      .from('saved_matches')
      .select(`
        id,
        match_id,
        saved_at,
        matches (
          id,
          score,
          matched_at,
          has_job_listings,
          startup_id,
          startups3 (
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
            founders (
              id,
              name,
              email,
              role,
              linkedin_url,
              twitter_url,
              background,
              profile_picture
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    if (savedError) {
      console.error('Error fetching saved matches:', savedError);
      return NextResponse.json(
        { error: 'Failed to fetch saved matches' },
        { status: 500 }
      );
    }

    // Transform data to match the expected format
    const transformedMatches = savedMatches?.map((saved: any) => ({
      id: saved.matches.id,
      score: saved.matches.score,
      matched_at: saved.matches.matched_at,
      has_job_listings: saved.matches.has_job_listings,
      startup: saved.matches.startups3,
    })) || [];

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

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
        return NextResponse.json(
          { error: 'Match already saved' },
          { status: 409 }
        );
      }
      console.error('Error saving match:', error);
      return NextResponse.json(
        { error: 'Failed to save match' },
        { status: 500 }
      );
    }

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
