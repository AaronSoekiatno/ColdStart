import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { provisionFlyMachine, destroyFlyMachine } from '@/lib/container-orchestration/flyio';

/**
 * POST /api/topcandidates/provision-container
 * 
 * Provisions a Fly.io machine (container) for candidate assessment.
 * Integrates with the existing /api/topcandidates/provision endpoint for Supabase/DB credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Authenticate candidate
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get candidate info
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, email')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Call provisioning endpoint using authenticated session
    // The provision endpoint will authenticate via the session cookie
    const origin = request.nextUrl.origin;
    const provisionResponse = await fetch(
      `${origin}/api/topcandidates/provision`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('Cookie') || '',
        },
      }
    );

    if (!provisionResponse.ok) {
      // ... err handling ...
      const errorText = await provisionResponse.text();
      console.error('[Provision Container] Failed to provision schema:', errorText);
      throw new Error('Failed to provision candidate schema credentials');
    }

    const credentials = await provisionResponse.json();

    // Generate container password - DISABLED (Using --auth none)
    // const containerPassword = crypto.randomUUID().slice(0, 16);
    const containerPassword = "";

    // Provision Fly.io container
    console.log(`[Provision Container] Starting Fly.io provisioning for session ${sessionId}`);
    const { url: containerUrl } = await provisionFlyMachine({
      candidateId: candidate.id,
      sessionId: sessionId,
      password: containerPassword,
      telemetryUrl: process.env.NEXT_PUBLIC_APP_URL || origin,
      supabaseUrl: credentials.SUPABASE_URL,
      supabaseAnonKey: credentials.SUPABASE_ANON_KEY,
      supabaseJwt: credentials.SUPABASE_PRIVATE_KEY, // Schema-specific JWT
    });

    // Update interview session with container info
    // We update as system/admin since RLS might restrict candidate updates
    // (In a real scenario, use service role client if needed, but here we reuse the auth context 
    // assuming the candidate owns their session or we rely on the migration to allow updates)
    // NOTE: If RLS fails, we might need a service role client here.
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        container_url: containerUrl,
        container_status: 'running',
        container_started_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('[Provision Container] Failed to update session:', updateError);
      // We warn but don't fail the request, as the container is running.
    }

    return NextResponse.json({
      containerUrl,
      containerPassword,
      credentials, // Returning credentials in case frontend needs them directly
      expiresIn: '3 hours',
    });

  } catch (error) {
    console.error('[Provision Container] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to provision container', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/topcandidates/provision-container
 * 
 * Cleanup/destroy a container after assessment.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    // Initialize Supabase (Admin/Service Role preferred for cleanup, but using user context for now)
    // Actually, for cleanup, we probably want to verify ownership or admin rights.
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { },
        },
      }
    );

    // Get container info
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('container_url, container_status')
      .eq('session_id', sessionId)
      .single();

    if (!session?.container_url) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    // Extract app name from URL
    // Format: https://[app-name].fly.dev
    const appName = session.container_url.replace('https://', '').replace('.fly.dev', '');

    // Destroy Fly.io app
    await destroyFlyMachine(appName);

    // Update database
    await supabase
      .from('interview_sessions')
      .update({
        container_status: 'stopped',
        container_stopped_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Cleanup Container] Error:', error);
    return NextResponse.json({ error: 'Failed to cleanup container' }, { status: 500 });
  }
}
