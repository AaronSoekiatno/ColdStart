import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, getLinkedInImports } from '@/lib/supabase';

/**
 * GET /api/linkedin/imports
 * Get all LinkedIn import history for the authenticated user
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

    // Fetch import history
    const imports = await getLinkedInImports(candidate.id);

    return NextResponse.json({
      success: true,
      imports,
    });
  } catch (error) {
    console.error('Error fetching LinkedIn imports:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch imports',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
