import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, getFounderConnections } from '@/lib/supabase';

/**
 * GET /api/linkedin/connections
 * Get all LinkedIn connections for the authenticated user
 * Query params:
 * - matched: 'true' to get only matched connections
 */
export async function GET(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate profile not found.' },
        { status: 404 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const onlyMatched = searchParams.get('matched') === 'true';

    // Fetch connections
    const connections = await getFounderConnections(candidate.id, onlyMatched);

    // If matched=true, also fetch the matched candidate details
    if (onlyMatched && connections.length > 0) {
      const matchedCandidateIds = connections
        .filter(c => c.matched_candidate_id)
        .map(c => c.matched_candidate_id);

      const { data: matchedCandidates } = await supabase
        .from('candidates')
        .select('id, name, email, skills, location, university, years_of_experience')
        .in('id', matchedCandidateIds);

      // Enrich connections with matched candidate data
      const enrichedConnections = connections.map(connection => ({
        ...connection,
        matched_candidate: matchedCandidates?.find(
          c => c.id === connection.matched_candidate_id
        ),
      }));

      return NextResponse.json({
        success: true,
        connections: enrichedConnections,
        totalCount: enrichedConnections.length,
      });
    }

    return NextResponse.json({
      success: true,
      connections,
      totalCount: connections.length,
    });
  } catch (error) {
    console.error('Error fetching LinkedIn connections:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/linkedin/connections
 * Delete all LinkedIn connections for the authenticated user
 */
export async function DELETE(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate profile not found.' },
        { status: 404 }
      );
    }

    // Delete all LinkedIn imports and connections (cascade delete will handle connections)
    const { error: deleteError } = await supabase
      .from('linkedin_imports')
      .delete()
      .eq('user_id', candidate.id);

    if (deleteError) {
      throw new Error(`Failed to delete LinkedIn data: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'All LinkedIn data deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting LinkedIn connections:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
