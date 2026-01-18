import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'session-snapshots';

/**
 * Get Supabase admin client with service role key
 * Required for storage operations that bypass RLS
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export interface UploadSnapshotResult {
  /** Storage path where snapshot was saved */
  storagePath: string;
  /** Size of uploaded snapshot in bytes */
  size: number;
  /** Public URL for the snapshot (if bucket is public) or signed URL */
  url?: string;
}

export interface SnapshotInfo {
  /** Storage path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Created at timestamp */
  createdAt: Date;
  /** Metadata if available */
  metadata?: Record<string, any>;
}

/**
 * Upload a snapshot to Supabase Storage
 *
 * Uploads the tar.gz buffer to the session-snapshots bucket
 *
 * @param sessionId - Session ID for organizing snapshots
 * @param buffer - The tar.gz snapshot buffer
 * @param timestamp - Optional timestamp for the snapshot (defaults to now)
 * @returns Storage path, size, and URL
 */
export async function uploadSnapshot(
  sessionId: string,
  buffer: Buffer,
  timestamp?: Date
): Promise<UploadSnapshotResult> {
  const supabase = getSupabaseAdmin();

  // Generate storage path: {sessionId}/{timestamp}-snapshot.tar.gz
  const ts = timestamp || new Date();
  const timestampStr = ts.toISOString().replace(/[:.]/g, '-');
  const fileName = `${timestampStr}-snapshot.tar.gz`;
  const storagePath = `${sessionId}/${fileName}`;

  console.log(`[Storage] Uploading snapshot to ${BUCKET_NAME}/${storagePath}`);

  try {
    const { error: uploadError, data } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'application/gzip',
        upsert: false, // Don't overwrite - each snapshot should be unique
      });

    if (uploadError) {
      console.error('[Storage] Upload error:', uploadError);
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`);
    }

    console.log(`[Storage] Successfully uploaded snapshot: ${storagePath}`);

    // Get signed URL for download (valid for 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 31536000); // 365 days in seconds

    let url: string | undefined;
    if (signedError) {
      console.warn('[Storage] Failed to create signed URL:', signedError);
    } else {
      url = signedData?.signedUrl;
    }

    return {
      storagePath,
      size: buffer.length,
      url,
    };
  } catch (error: any) {
    console.error('[Storage] Upload failed:', error);
    throw new Error(`Failed to upload snapshot to storage: ${error.message}`);
  }
}

/**
 * Download a snapshot from Supabase Storage
 *
 * @param storagePath - Full storage path (e.g., "session_123/2024-01-15-snapshot.tar.gz")
 * @returns Buffer containing the snapshot data
 */
export async function downloadSnapshot(storagePath: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();

  console.log(`[Storage] Downloading snapshot from ${BUCKET_NAME}/${storagePath}`);

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      console.error('[Storage] Download error:', error);
      throw new Error(`Failed to download snapshot: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Storage] Successfully downloaded snapshot: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

    return buffer;
  } catch (error: any) {
    console.error('[Storage] Download failed:', error);
    throw new Error(`Failed to download snapshot from storage: ${error.message}`);
  }
}

/**
 * List all snapshots for a session
 *
 * @param sessionId - Session ID to list snapshots for
 * @returns Array of snapshot information
 */
export async function listSnapshots(sessionId: string): Promise<SnapshotInfo[]> {
  const supabase = getSupabaseAdmin();

  console.log(`[Storage] Listing snapshots for session ${sessionId}`);

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(sessionId, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('[Storage] List error:', error);
      throw new Error(`Failed to list snapshots: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Convert storage list results to SnapshotInfo
    const snapshots: SnapshotInfo[] = data
      .filter(file => file.name.endsWith('.tar.gz'))
      .map(file => ({
        path: `${sessionId}/${file.name}`,
        size: file.metadata?.size || 0,
        createdAt: new Date(file.created_at),
        metadata: file.metadata,
      }));

    console.log(`[Storage] Found ${snapshots.length} snapshots for session ${sessionId}`);

    return snapshots;
  } catch (error: any) {
    console.error('[Storage] List failed:', error);
    throw new Error(`Failed to list snapshots from storage: ${error.message}`);
  }
}

/**
 * Delete a snapshot from storage
 *
 * @param storagePath - Full storage path to delete
 */
export async function deleteSnapshot(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  console.log(`[Storage] Deleting snapshot ${storagePath}`);

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error('[Storage] Delete error:', error);
      throw new Error(`Failed to delete snapshot: ${error.message}`);
    }

    console.log(`[Storage] Successfully deleted snapshot: ${storagePath}`);
  } catch (error: any) {
    console.error('[Storage] Delete failed:', error);
    throw new Error(`Failed to delete snapshot from storage: ${error.message}`);
  }
}

/**
 * Get a signed download URL for a snapshot
 *
 * @param storagePath - Full storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned');
    }

    return data.signedUrl;
  } catch (error: any) {
    console.error('[Storage] Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
}
