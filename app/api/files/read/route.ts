import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { execInContainer } from '@/lib/container-orchestration/exec-command';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const path = searchParams.get('path');

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

    const command = `cat /workspace/${path}`;
    const { stdout } = await execInContainer(sessionId, session.container_url, command);

    return NextResponse.json({ content: stdout });
  } catch (error: any) {
    console.error('[API files/read] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
