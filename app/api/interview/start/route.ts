import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
import { startInterview, initializeOrchestrator } from '@/lib/vapi-orchestrator';

/**
 * POST /api/interview/start
 * Start an interview for the authenticated user
 * Creates a new interview session and provisions a Docker container
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

    // Get candidate record
    const candidate = await getCandidate(user.email, true);
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate profile not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // Initialize orchestrator
    initializeOrchestrator();

    // Start interview directly using authenticated user's candidate ID
    const result = await startInterview(candidate.id, {
      name: candidate.name,
      email: candidate.email,
    });

    const data = {
      sessionId: result.sessionId,
      phase: result.phase,
    };
    
    // Provision Docker Container
    // ============================================
    const origin = request.nextUrl.origin;
    if (data.sessionId && candidate) {
      try {
        console.log('[Interview Start] Provisioning container for session:', data.sessionId);
        const containerResponse = await fetch(`${origin}/api/topcandidates/provision-container`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({
            sessionId: data.sessionId,
          }),
        });

        if (containerResponse.ok) {
          const containerData = await containerResponse.json();
          console.log('[Interview Start] Container provisioned:', containerData.containerUrl);
          
          // Add container info to response
          data.containerUrl = containerData.containerUrl;
          data.containerPassword = containerData.containerPassword;
          data.type = 'container'; // Signal to frontend to use container view
        } else {
          console.error('[Interview Start] Container provisioning failed:', await containerResponse.text());
        }
      } catch (containerError) {
        console.error('[Interview Start] Error provisioning container:', containerError);
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

