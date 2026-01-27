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

    // 3. Check authentication & authorization
    // We import isAdmin dynamically to avoid circular dependencies
    const { isAdmin } = await import('@/lib/admin-auth');
    const isUserAdmin = isAdmin(user.email);

    // 4. Verify resume exists
    let { data: resumeData, error: resumeError } = await supabase
      .from('resumes')
      .select('candidate_id, id')
      .eq('resume_path', resumePath)
      .single();

    // Fallback: Try checking via filename if full path match fails
    // Sometimes 'resumes/' prefix is missing or added inconsistently
    if (resumeError && (resumeError.code === 'PGRST116' || !resumeData)) {
      const filename = resumePath.split('/').pop();
      if (filename) {
          console.log('[Resume Proxy] Exact path match failed, trying filename search:', filename);
          const { data: altResumeData, error: altResumeError } = await supabase
            .from('resumes')
            .select('candidate_id, id')
            .ilike('resume_path', `%${filename}`)
            .limit(1)
            .single();
          
          if (!altResumeError && altResumeData) {
              console.log('[Resume Proxy] Found resume via filename match');
              resumeData = altResumeData;
              resumeError = null;
          }
      }
    }

    if (resumeError || !resumeData) {
      // Admin Override: If user is admin, allow trying to download directly from storage 
      // even if DB record is missing (for legacy or broken records)
      if (isUserAdmin) {
          console.warn('[Resume Proxy] Resume DB record not found, but admin is bypassing check. Attempting raw storage download:', resumePath);
          // Create a mock resumeData to bypass downstream checks
          resumeData = { candidate_id: 'admin-bypass', id: 'admin-bypass' };
      } else {
          console.error('[Resume Proxy] Resume not found:', resumePath, resumeError);
          return NextResponse.json(
            { error: 'Resume not found' },
            { status: 404 }
          );
      }
    }

    // 5. If NOT admin, verify ownership
    if (!isUserAdmin) {
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

      // Verify ownership
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
    }

    // 4. Fetch from Supabase Storage (private bucket)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('[Resume Proxy] Attempting download:', {
        bucket: 'resumes',
        path: resumePath,
    });

    let { data, error } = await supabaseAdmin.storage
      .from('resumes')
      .download(resumePath);

    // Fallback: If path starts with 'resumes/' and failed, try removing the prefix
    // This handles cases where we might have stored relative paths vs absolute paths inconsistently
    if (error && resumePath.startsWith('resumes/')) {
        const altPath = resumePath.replace(/^resumes\//, '');
        console.log('[Resume Proxy] Primary download failed, trying alternative path:', altPath);
        const { data: altData, error: altError } = await supabaseAdmin.storage
            .from('resumes')
            .download(altPath);
        
        if (!altError && altData) {
            console.log('[Resume Proxy] Alternative path successful');
            data = altData;
            error = null;
        }
    }

    if (error || !data) {
      // DEBUG: List files in the parent folder to see what actually exists
      const parentFolder = resumePath.split('/').slice(0, -1).join('/');
      const { data: listData, error: listError } = await supabaseAdmin.storage
        .from('resumes')
        .list(parentFolder);

      console.error('[Resume Proxy] Failed to download resume:', {
          path: resumePath,
          errorStr: JSON.stringify(error),
          errorMessage: error?.message,
          errorCode: (error as any)?.code,
          folderListing: listData ? listData.map(f => f.name) : 'Failed to list',
          folderPath: parentFolder
      });

      return NextResponse.json(
        { error: 'Failed to download resume', details: error?.message },
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
        // Allow inline display in iframes unless download is requested
        'Content-Disposition': request.nextUrl.searchParams.get('download') === 'true' 
          ? `attachment; filename="${resumePath.split('/').pop()}"`
          : 'inline',
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
