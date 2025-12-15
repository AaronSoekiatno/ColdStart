import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getCandidate } from '@/lib/supabase';

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
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookie setting might fail in route handlers
            }
          },
        },
      }
    );

    // Check authentication
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

    // Get resumeId from query params
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Missing resumeId parameter' },
        { status: 400 }
      );
    }

    // Get service role client for database access
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Get the resume from database
    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (resumeError || !resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Verify the resume belongs to this user's candidate profile
    const candidate = await getCandidate(user.email);

    if (!candidate || resume.candidate_id !== candidate.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Return the resume text and structured data
    return NextResponse.json({
      success: true,
      resumeText: resume.full_text,
      // Prefer per-resume structured_data; fall back to legacy candidate-level structured_resume_data
      structuredResumeData: resume.structured_data || (candidate as any).structured_resume_data || null,
    });
  } catch (error) {
    console.error('Error in get-resume API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
