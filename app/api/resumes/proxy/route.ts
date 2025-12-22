import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
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
    
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // 2. Get resume path from query parameters
    const resumePath = request.nextUrl.searchParams.get('path');
    if (!resumePath) {
      return NextResponse.json(
        { error: 'Missing resume path parameter' },
        { status: 400 }
      );
    }

    // 3. Verify user owns this resume (security check)
    const { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .select('candidate_id, id')
      .eq('resume_path', resumePath)
      .single();

    if (resumeError || !resumeData) {
      console.error('[Resume Proxy] Resume not found:', resumePath, resumeError);
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Get candidate ID for current user
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', user.email)
      .single();

    if (candidateError || !candidate) {
      console.error('[Resume Proxy] Candidate not found for user:', user.email);
      return NextResponse.json(
        { error: 'Candidate profile not found' },
        { status: 404 }
      );
    }

    // Security check: verify ownership
    if (resumeData.candidate_id !== candidate.id) {
      console.warn('[Resume Proxy] Access denied - User attempting to access another user\'s resume:', {
        userId: user.id,
        candidateId: candidate.id,
        resumeCandidateId: resumeData.candidate_id,
      });
      return NextResponse.json(
        { error: 'Access denied - This is not your resume' },
        { status: 403 }
      );
    }

    // 4. Fetch from Supabase Storage (private bucket)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin.storage
      .from('resumes')
      .download(resumePath);

    if (error || !data) {
      console.error('[Resume Proxy] Failed to download resume:', error);
      return NextResponse.json(
        { error: 'Failed to download resume' },
        { status: 500 }
      );
    }

    // 5. Convert to buffer
    const buffer = Buffer.from(await data.arrayBuffer());

    // 6. Return with browser and CDN caching headers
    const cacheControl = 'private, max-age=3600, s-maxage=3600, must-revalidate';
    
    // Log cache delivery for monitoring egress shift
    console.log('[Resume Proxy] Cache delivery:', {
      resumePath,
      candidateId: resumeData.candidate_id,
      cacheControl,
      timestamp: new Date().toISOString(),
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        // Private cache with CDN support:
        // - private: prevents public caching (only authenticated user can access)
        // - max-age=3600: browser caches for 1 hour
        // - s-maxage=3600: CDN caches for 1 hour (moves to cached egress quota)
        // - must-revalidate: ensures fresh content after expiration
        'Cache-Control': cacheControl,
        // ETag for cache validation
        'ETag': `"${resumePath}"`,
        // Allow inline display in iframes
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    console.error('[Resume Proxy] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
