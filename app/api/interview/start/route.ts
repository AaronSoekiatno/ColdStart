import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

/**
 * POST /api/interview/start
 * Start an interview for the authenticated user
 * Gets the provisioning token from the candidate record and starts the interview
 */
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

    // Get candidate record with provisioning token
    const candidate = await getCandidate(user.email, true);
    if (!candidate || !candidate.provisioning_token) {
      return NextResponse.json(
        { error: 'No assessment access found. Please start an assessment first.' },
        { status: 404 }
      );
    }

    // Call the token-based start endpoint
    const origin = request.nextUrl.origin;
    const startResponse = await fetch(`${origin}/api/interview/start-by-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${candidate.provisioning_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to start interview' },
        { status: startResponse.status }
      );
    }

    const data = await startResponse.json();
    
    // After interview session is created, create repository if it doesn't exist
    // and inject sessionId into .hermes/config.json
    if (data.sessionId && candidate) {
      try {
        // Create or update repository with sessionId
        const repoResponse = await fetch(`${origin}/api/topcandidates/create-assessment-repo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({
            sessionId: data.sessionId, // Pass sessionId to repo creation
          }),
        });

        if (repoResponse.ok) {
          const repoData = await repoResponse.json();
          console.log('[Interview Start] Repository created/updated with sessionId:', data.sessionId);
          
          return NextResponse.json({
            ...data,
            repoUrl: repoData.repoUrl,
            cloneUrl: repoData.cloneUrl,
          });
        } else {
          // Log error but don't fail interview start if repo creation fails
          const errorData = await repoResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.warn('[Interview Start] Failed to create/update repository:', errorData.error);
        }
      } catch (repoError) {
        // Log error but don't fail interview start
        console.error('[Interview Start] Error creating repository:', repoError);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error starting interview:', error);
    return NextResponse.json(
      { error: 'Failed to start interview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

