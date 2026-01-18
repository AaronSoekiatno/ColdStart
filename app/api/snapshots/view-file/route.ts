import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { downloadSnapshot } from '@/lib/snapshot/storage';
import { extractFileFromTarGz } from '@/lib/snapshot/tar-utils';

export const runtime = 'nodejs';

/**
 * GET /api/snapshots/view-file?sessionId=xxx&filePath=xxx&timestamp=xxx
 *
 * Extracts and returns a single file from a snapshot
 *
 * Query params:
 * - sessionId: Required - Session ID
 * - filePath: Required - File path within snapshot (e.g., "app/page.tsx")
 * - timestamp: Optional - Specific snapshot timestamp. If not provided, uses latest.
 *
 * Returns: File content with appropriate Content-Type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const filePath = searchParams.get('filePath');
    const timestamp = searchParams.get('timestamp');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'File path is required' },
        { status: 400 }
      );
    }

    // Authenticate user
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

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get candidate info
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, email')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Verify user owns this session
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('session_id, candidate_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.candidate_id !== candidate.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this session' },
        { status: 403 }
      );
    }

    // Query session_commits to find the snapshot
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    let query = supabaseAdmin
      .from('session_commits')
      .select('snapshot_storage_path')
      .eq('session_id', sessionId)
      .not('snapshot_storage_path', 'is', null);

    if (timestamp) {
      query = query
        .gte('created_at', timestamp)
        .order('created_at', { ascending: true })
        .limit(1);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data: snapshots, error: queryError } = await query;

    if (queryError) {
      console.error('[Snapshot View File] Query error:', queryError);
      return NextResponse.json(
        { success: false, error: 'Failed to find snapshot' },
        { status: 500 }
      );
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No snapshot found for this session' },
        { status: 404 }
      );
    }

    const snapshot = snapshots[0];
    const storagePath = snapshot.snapshot_storage_path;

    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: 'Snapshot storage path is missing' },
        { status: 500 }
      );
    }

    console.log(`[Snapshot View File] Downloading snapshot: ${storagePath}`);

    // Download snapshot from storage
    let buffer: Buffer;
    try {
      buffer = await downloadSnapshot(storagePath);
    } catch (error: any) {
      console.error('[Snapshot View File] Download failed:', error);
      return NextResponse.json(
        { success: false, error: `Failed to download snapshot: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`[Snapshot View File] Extracting file: ${filePath}`);

    // Extract the specific file from tar.gz
    let fileContent: string | null;
    try {
      fileContent = await extractFileFromTarGz(buffer, filePath);
    } catch (error: any) {
      console.error('[Snapshot View File] Extraction failed:', error);
      return NextResponse.json(
        { success: false, error: `Failed to extract file: ${error.message}` },
        { status: 500 }
      );
    }

    if (fileContent === null) {
      return NextResponse.json(
        { success: false, error: `File not found in snapshot: ${filePath}` },
        { status: 404 }
      );
    }

    // Determine content type from file extension
    const contentType = getContentType(filePath);

    // Return file content
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-File-Path': filePath,
        'X-File-Size': Buffer.byteLength(fileContent, 'utf-8').toString(),
      },
    });
  } catch (error: any) {
    console.error('[Snapshot View File] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Determine Content-Type from file extension
 */
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Code files
    ts: 'text/plain; charset=utf-8',
    tsx: 'text/plain; charset=utf-8',
    js: 'text/plain; charset=utf-8',
    jsx: 'text/plain; charset=utf-8',
    py: 'text/plain; charset=utf-8',
    go: 'text/plain; charset=utf-8',
    rs: 'text/plain; charset=utf-8',
    java: 'text/plain; charset=utf-8',
    cpp: 'text/plain; charset=utf-8',
    c: 'text/plain; charset=utf-8',
    h: 'text/plain; charset=utf-8',
    rb: 'text/plain; charset=utf-8',
    php: 'text/plain; charset=utf-8',
    swift: 'text/plain; charset=utf-8',
    kt: 'text/plain; charset=utf-8',

    // Web files
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    scss: 'text/plain; charset=utf-8',
    sass: 'text/plain; charset=utf-8',
    less: 'text/plain; charset=utf-8',

    // Config files
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    yaml: 'text/plain; charset=utf-8',
    yml: 'text/plain; charset=utf-8',
    toml: 'text/plain; charset=utf-8',
    ini: 'text/plain; charset=utf-8',

    // Documentation
    md: 'text/markdown; charset=utf-8',
    txt: 'text/plain; charset=utf-8',

    // SQL
    sql: 'text/plain; charset=utf-8',

    // Shell scripts
    sh: 'text/plain; charset=utf-8',
    bash: 'text/plain; charset=utf-8',
    zsh: 'text/plain; charset=utf-8',
  };

  return mimeTypes[ext || ''] || 'text/plain; charset=utf-8';
}
