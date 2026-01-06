import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, updateResume, getResume } from '@/lib/supabase';

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

    const { resumeId, name } = await request.json();

    if (!resumeId || !name) {
      return NextResponse.json(
        { error: 'Missing resumeId or name' },
        { status: 400 }
      );
    }

    // Validate name length
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: 'Resume name cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 255) {
      return NextResponse.json(
        { error: 'Resume name must be 255 characters or less' },
        { status: 400 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate profile or ID not found.' },
        { status: 404 }
      );
    }

    // Verify the resume belongs to this candidate
    const resume = await getResume(resumeId);
    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found.' },
        { status: 404 }
      );
    }

    if (resume.candidate_id !== candidate.id) {
      return NextResponse.json(
        { error: 'Unauthorized. This resume does not belong to you.' },
        { status: 403 }
      );
    }

    // Update the resume name
    await updateResume(resumeId, { name: trimmedName });

    return NextResponse.json({
      success: true,
      message: 'Resume name updated successfully',
    });
  } catch (error) {
    console.error('Error updating resume name:', error);
    return NextResponse.json(
      {
        error: 'Failed to update resume name',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
