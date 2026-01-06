import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCandidate, deleteResume, getResume, getResumeCountForCandidate, getResumesForCandidate, setPrimaryResume } from '@/lib/supabase';

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

    // If this is the primary resume and there are other resumes, set another one as primary first
    if (resume.is_primary) {
      const allResumes = await getResumesForCandidate(candidate.id);
      const otherResume = allResumes.find(r => r.id !== resumeId && r.is_active);
      
      if (otherResume) {
        // Set another resume as primary before deleting this one
        await setPrimaryResume(candidate.id, otherResume.id);
      }
      // If this is the only resume, we'll just delete it (no need to set another as primary)
    }

    // Delete the resume (soft delete - sets is_active to false)
    await deleteResume(resumeId);

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

