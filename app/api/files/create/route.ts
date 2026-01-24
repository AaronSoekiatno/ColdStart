import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { execInContainer } from '@/lib/container-orchestration/exec-command';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, path, type } = await request.json();

    if (!sessionId || !path || !type) {
      return NextResponse.json({ error: 'Session ID, path, and type are required' }, { status: 400 });
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

    // Sanitize path
    if (path.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    let command = '';
    
    if (type === 'folder') {
      command = `mkdir -p "/workspace/${path}"`;
    } else {
      // Ensure parent directory exists, then touch file
      // Extract directory path: everything before the last slash
      const parts = path.split('/');
      parts.pop(); // remove filename
      const dir = parts.join('/');
      
      if (dir) {
        command = `/bin/bash -c 'mkdir -p "/workspace/${dir}" && touch "/workspace/${path}"'`;
      } else {
        command = `touch "/workspace/${path}"`;
      }
    }
    
    console.log(`[API files/create] Creating ${type} at ${path} in session ${sessionId}`);
    
    const { stderr } = await execInContainer(sessionId, session.container_url, command);

    if (stderr) {
      console.warn(`[API files/create] Container stderr: ${stderr}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API files/create] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
