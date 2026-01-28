import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { downloadSnapshot } from '@/lib/snapshot/storage';

export const runtime = 'nodejs';

/**
 * GET /api/snapshots/download?sessionId=xxx&timestamp=xxx
 *
 * Downloads a snapshot tar.gz file
 *
 * Query params:
 * - sessionId: Required - Session ID to download snapshot from
 * - timestamp: Optional - Specific snapshot timestamp (ISO format). If not provided, downloads latest.
 *
 * Returns: Binary tar.gz file with Content-Disposition header
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sessionId = searchParams.get('sessionId');
    const timestamp = searchParams.get('timestamp');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
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
      .select('snapshot_storage_path, snapshot_size_bytes, created_at, commit_message')
      .eq('session_id', sessionId)
      .not('snapshot_storage_path', 'is', null);

    if (timestamp) {
      // Find snapshot closest to the requested timestamp
      query = query
        .gte('created_at', timestamp)
        .order('created_at', { ascending: true })
        .limit(1);
    } else {
      // Get latest snapshot
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data: snapshots, error: queryError } = await query;

    if (queryError) {
      console.error('[Snapshot Download] Query error:', queryError);
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

    console.log(`[Snapshot Download] Downloading snapshot: ${storagePath}`);

    // Download from Supabase Storage
    let buffer: Buffer;
    try {
      buffer = await downloadSnapshot(storagePath);
    } catch (error: any) {
      console.error('[Snapshot Download] Download failed:', error);
      return NextResponse.json(
        { success: false, error: `Failed to download snapshot: ${error.message}` },
        { status: 500 }
      );
    }

    // Extract filename from storage path
    // Format: {sessionId}/{timestamp}-snapshot.tar.gz
    const fileName = storagePath.split('/').pop() || 'snapshot.tar.gz';

    // Return binary response with appropriate headers
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'X-Snapshot-Size': snapshot.snapshot_size_bytes?.toString() || buffer.length.toString(),
        'X-Snapshot-Created': snapshot.created_at || '',
        'X-Snapshot-Message': snapshot.commit_message || '',
      },
    });
  } catch (error: any) {
    console.error('[Snapshot Download] Unexpected error:', error);
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
