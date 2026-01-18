import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { collectWorkspaceSnapshot } from '@/lib/snapshot/ssh-collector';
import { uploadSnapshot } from '@/lib/snapshot/storage';
import { countFilesInTarGz } from '@/lib/snapshot/tar-utils';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for snapshot collection

interface CreateSnapshotRequest {
  sessionId: string;
  trigger?: 'manual' | 'test_completion' | 'phase_transition' | 'commit';
  commitHash?: string;
  message?: string;
}

/**
 * POST /api/snapshots/create
 *
 * Creates a snapshot of the workspace from a running container
 *
 * Flow:
 * 1. Authenticate user
 * 2. Retrieve session from DB and verify container is running
 * 3. Extract Fly app name from container_url
 * 4. Collect workspace snapshot via SSH
 * 5. Upload to Supabase Storage
 * 6. Log to session_commits table
 * 7. Return snapshot metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateSnapshotRequest = await request.json();
    const { sessionId, trigger = 'manual', commitHash, message } = body;

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
      .select('id, email, github_username')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Get session from DB
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('session_id, container_url, container_status, candidate_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[Snapshot] Session query error:', sessionError);
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.candidate_id !== candidate.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this session' },
        { status: 403 }
      );
    }

    // Verify container is running
    if (session.container_status !== 'running' || !session.container_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Container is not running',
          containerStatus: session.container_status,
        },
        { status: 503 }
      );
    }

    // Extract Fly app name from container_url
    // Expected format: https://hermes-workspace-abc123.fly.dev or similar
    const flyAppName = extractFlyAppName(session.container_url);
    if (!flyAppName) {
      console.error('[Snapshot] Could not extract Fly app name from:', session.container_url);
      return NextResponse.json(
        { success: false, error: 'Invalid container URL format' },
        { status: 500 }
      );
    }

    console.log(`[Snapshot] Creating snapshot for session ${sessionId}, Fly app: ${flyAppName}`);

    // Collect workspace snapshot via SSH
    let snapshotResult;
    try {
      snapshotResult = await collectWorkspaceSnapshot(flyAppName, sessionId);
    } catch (error: any) {
      console.error('[Snapshot] Collection failed:', error);

      // Handle specific error cases
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { success: false, error: 'Snapshot collection timeout' },
          { status: 504 }
        );
      }

      if (error.message.includes('exceeds limit')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 413 }
        );
      }

      return NextResponse.json(
        { success: false, error: `Failed to collect snapshot: ${error.message}` },
        { status: 500 }
      );
    }

    // Get file count from buffer
    let fileCount = snapshotResult.metrics.fileCount;
    if (fileCount === 0) {
      try {
        fileCount = await countFilesInTarGz(snapshotResult.buffer);
      } catch (error) {
        console.warn('[Snapshot] Could not count files:', error);
      }
    }

    // Upload to Supabase Storage
    let uploadResult;
    try {
      uploadResult = await uploadSnapshot(sessionId, snapshotResult.buffer);
    } catch (error: any) {
      console.error('[Snapshot] Upload failed:', error);
      return NextResponse.json(
        { success: false, error: `Failed to upload snapshot: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`[Snapshot] Uploaded to storage: ${uploadResult.storagePath}`);

    // Log to session_commits table using the RPC function
    // Use service role client for RPC call
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[Snapshot] SUPABASE_SERVICE_ROLE_KEY not set');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Call log_session_commit RPC
    // Derive repo name from session ID or use candidate info
    const repoName = `session-${sessionId.split('_').pop() || sessionId}`;

    // Use 'push' as event type (required by session_commits constraint)
    // The actual trigger is stored in the commit message
    const { data: commitResult, error: commitError } = await supabaseAdmin.rpc(
      'log_session_commit',
      {
        p_candidate_id: candidate.github_username || candidate.email,
        p_event: 'push', // session_commits table only allows 'push' or 'pull_request'
        p_added_lines: 0, // Not tracking line changes for snapshots
        p_deleted_lines: 0,
        p_commit_message: message || `Snapshot: ${trigger}`,
        p_repo_name: repoName,
        p_commit_hash: commitHash || null,
        p_commit_author: candidate.github_username || candidate.email,
        p_commit_timestamp: new Date().toISOString(),
        p_snapshot_storage_path: uploadResult.storagePath,
        p_snapshot_size_bytes: uploadResult.size,
        p_session_id: sessionId,
      }
    );

    if (commitError) {
      console.error('[Snapshot] Failed to log session commit:', commitError);
      // Don't fail the request - snapshot is already uploaded
    } else {
      console.log('[Snapshot] Logged to session_commits:', commitResult);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      snapshotId: commitResult?.commit_id || null,
      storagePath: uploadResult.storagePath,
      size: uploadResult.size,
      url: uploadResult.url,
      metrics: {
        totalSize: uploadResult.size,
        fileCount,
        collectionTime: snapshotResult.metrics.collectionTime,
      },
      trigger,
    });
  } catch (error: any) {
    console.error('[Snapshot] Unexpected error:', error);
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
 * Extract Fly app name from container URL
 *
 * @param containerUrl - URL like "https://hermes-workspace-abc123.fly.dev"
 * @returns Fly app name like "hermes-workspace-abc123"
 */
function extractFlyAppName(containerUrl: string): string | null {
  try {
    const url = new URL(containerUrl);
    // Extract hostname and remove .fly.dev suffix
    const hostname = url.hostname;
    if (hostname.endsWith('.fly.dev')) {
      return hostname.replace('.fly.dev', '');
    }
    // If not a fly.dev URL, return the hostname as-is
    return hostname;
  } catch (error) {
    console.error('[Snapshot] Invalid URL:', containerUrl);
    return null;
  }
}
