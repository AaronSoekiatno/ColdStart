import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, isSubscribed, setPrimaryResume } from '@/lib/supabase';

export async function POST(request: NextRequest) {
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

    const { resumeId } = await request.json();

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Missing resumeId' },
        { status: 400 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found.' },
        { status: 404 }
      );
    }

    // Check if user is premium (only premium users can set primary resume)
    const isPremium = isSubscribed(candidate);

    if (!isPremium) {
      return NextResponse.json(
        {
          error: 'Setting a primary resume is a Premium feature. Upgrade to Premium to use this feature.',
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Set the resume as primary
    await setPrimaryResume(candidate.id, resumeId);

    return NextResponse.json({
      success: true,
      message: 'Primary resume updated successfully',
    });
  } catch (error) {
    console.error('Error setting primary resume:', error);
    return NextResponse.json(
      {
        error: 'Failed to set primary resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
