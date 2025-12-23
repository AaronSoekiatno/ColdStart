import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// GET: Check if a match is saved
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

    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Check if match is saved
    const { data, error } = await supabase
      .from('saved_matches')
      .select('id')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .maybeSingle();

    if (error) {
      console.error('Error checking saved match:', error);
      return NextResponse.json(
        { error: 'Failed to check if match is saved' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      isSaved: !!data,
    });

  } catch (error) {
    console.error('Error in check saved match endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
