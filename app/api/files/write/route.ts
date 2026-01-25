import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { execInContainer } from '@/lib/container-orchestration/exec-command';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, path, content } = await request.json();

    if (!sessionId || !path) {
      return NextResponse.json({ error: 'Session ID and path are required' }, { status: 400 });
    }

    // Authenticate
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

    // Get container URL
    let session;
    if (process.env.NODE_ENV === 'development' && sessionId === 'local-dev-session') {
      session = { container_url: 'http://localhost:8080' };
    } else {
      const { data: dbSession } = await supabase
        .from('interview_sessions')
        .select('container_url')
        .eq('session_id', sessionId)
        .single();
      session = dbSession;
    }

    if (!session || !session.container_url) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    // Sanitize path (avoid traversal)
    if (path.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Base64 encode content
    const base64Content = Buffer.from(content || '').toString('base64');
    
    // Ensure parent directory exists and write content
    // We wrap in bash -c to ensure pipe and redirection work correctly in both local and remote environments
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    let innerCommand = '';
    
    if (dirPath) {
        innerCommand = `mkdir -p "/workspace/${dirPath}" && echo "${base64Content}" | base64 -d > "/workspace/${path}"`;
    } else {
        innerCommand = `echo "${base64Content}" | base64 -d > "/workspace/${path}"`;
    }

    // Wrap in bash -c to ensure the host shell doesn't interpret I/O redirection
    // Use single quotes for the bash command string, as base64Content is alnum+symbols safe for double quotes
    const command = `/bin/bash -c '${innerCommand}'`;
    
    console.log(`[API files/write] Writing to ${path} in session ${sessionId}`);

    try {
      const { stderr } = await execInContainer(sessionId, session.container_url, command);

      if (stderr) {
        console.warn(`[API files/write] Container stderr: ${stderr}`);
        // Some stderrs are warnings, don't fail hard
      }

      // Broadcast file update
      if (supabaseAdmin) {
          // Run in background
          supabaseAdmin.channel(`session:${sessionId}`)
              .send({
                  type: 'broadcast',
                  event: 'file_update',
                  payload: { path, timestamp: Date.now() }
              })
              .then(() => {
                   // Remove channel is implicit/handled by client usually, but explicit cleanup if needed:
                   // supabaseAdmin.removeChannel(...)
              })
              .catch(console.error);
      }

      return NextResponse.json({ success: true });
    } catch (execError: any) {
      console.error('[API files/write] Container execution error:', execError);

      // Provide user-friendly error messages
      if (execError.message?.includes('connection reset') || execError.message?.includes('tunnel')) {
        return NextResponse.json({
          error: 'Connection to container lost. Please try again.'
        }, { status: 503 });
      }

      throw execError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('[API files/write] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to save file'
    }, { status: 500 });
  }
}
