import { exec } from 'child_process';
import { promisify } from 'util';
import { generateTarExcludeFileContent } from './filter';

const execAsync = promisify(exec);

export interface SnapshotMetrics {
  /** Total size of the snapshot in bytes */
  totalSize: number;
  /** Number of files included */
  fileCount: number;
  /** Time taken to collect snapshot in milliseconds */
  collectionTime: number;
}

export interface SnapshotResult {
  /** The snapshot tar.gz buffer */
  buffer: Buffer;
  /** Metrics about the snapshot */
  metrics: SnapshotMetrics;
}

/**
 * Clean up Fly.io SSH noise from command output
 */
function cleanupNoise(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.startsWith('Connecting to'))
    .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
    .join('\n')
    .trim();
}

/**
 * Collect a complete workspace snapshot from a Fly.io container
 *
 * Creates a filtered tar.gz archive of the workspace directory
 *
 * @param flyAppName - Fly.io app name (e.g., 'hermes-workspace-abc123')
 * @param sessionId - Session ID for logging/tracking
 * @returns Buffer containing the tar.gz archive and metrics
 * @throws Error if SSH fails, tar fails, or snapshot exceeds size limits
 */
export async function collectWorkspaceSnapshot(
  flyAppName: string,
  sessionId: string
): Promise<SnapshotResult> {
  const startTime = Date.now();

  try {
    console.log(`[Snapshot] Starting collection for session ${sessionId} on ${flyAppName}`);

    // Step 1: Create exclude patterns file on container
    const excludeContent = generateTarExcludeFileContent();
    const base64Exclude = Buffer.from(excludeContent).toString('base64');

    const createExcludeCommand = `echo '${base64Exclude}' | base64 -d > /tmp/snapshot-exclude-${sessionId}.txt && echo "EXCLUDE_FILE_CREATED"`;
    const escapedCreateCmd = createExcludeCommand.replace(/'/g, "'\\''");
    const createCmd = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedCreateCmd}'"`;

    console.log(`[Snapshot] Creating exclude file on container...`);
    const { stdout: createStdout } = await execAsync(createCmd, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 1 * 1024 * 1024,
    });

    if (!cleanupNoise(createStdout).includes('EXCLUDE_FILE_CREATED')) {
      throw new Error('Failed to create exclude file on container');
    }

    // Step 2: Check workspace contents first for debugging
    console.log(`[Snapshot] Checking workspace contents...`);
    const checkCommand = `cd /workspace && ls -la`;
    const escapedCheckCmd = checkCommand.replace(/'/g, "'\\''");
    const checkCmd = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedCheckCmd}'"`;

    try {
      const { stdout: checkStdout } = await execAsync(checkCmd, {
        env: {
          ...process.env,
          FLY_API_TOKEN: process.env.FLY_API_TOKEN,
        },
        timeout: 30000,
        maxBuffer: 1 * 1024 * 1024,
      });
      console.log(`[Snapshot] Workspace contents:\n${cleanupNoise(checkStdout)}`);
    } catch (err) {
      console.warn('[Snapshot] Could not check workspace contents:', err);
    }

    // Step 3: Create tar.gz archive using the exclude file
    // Use tar with gzip compression, excluding patterns from file
    const tarCommand = [
      'cd /workspace',
      `tar czf /tmp/snapshot-${sessionId}.tar.gz --exclude-from=/tmp/snapshot-exclude-${sessionId}.txt .`,
      `ls -l /tmp/snapshot-${sessionId}.tar.gz | awk '{print $5}'`, // Get file size
      'echo "TAR_CREATED"'
    ].join(' && ');

    const escapedTarCmd = tarCommand.replace(/'/g, "'\\''");
    const tarCmd = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedTarCmd}'"`;

    console.log(`[Snapshot] Creating tar.gz archive...`);
    const { stdout: tarStdout } = await execAsync(tarCmd, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 60000, // 60s for tar creation
      maxBuffer: 2 * 1024 * 1024,
    });

    const tarOutput = cleanupNoise(tarStdout);
    if (!tarOutput.includes('TAR_CREATED')) {
      throw new Error('Failed to create tar archive on container');
    }

    // Parse file size from ls output (line before TAR_CREATED)
    // ls -l format: -rw-r--r-- 1 root root 41979 Jan 18 22:35 /tmp/file.tar.gz
    // We need the 5th field (index 4) which is the size in bytes
    const lines = tarOutput.split('\n').filter(l => l.trim());
    const sizeIndex = lines.findIndex(l => l === 'TAR_CREATED') - 1;
    const lsOutputLine = lines[sizeIndex];
    const sizeField = lsOutputLine.split(/\s+/)[4]; // Extract 5th field (size)
    const totalSize = parseInt(sizeField, 10);

    console.log(`[Snapshot] Tar output lines:`, lines);
    console.log(`[Snapshot] Size line [${sizeIndex}]:`, lsOutputLine);
    console.log(`[Snapshot] Extracted size field:`, sizeField, '-> parsed:', totalSize);

    if (isNaN(totalSize) || totalSize === 0) {
      console.error(`[Snapshot] Empty snapshot detected!`);
      console.error(`[Snapshot] Tar output:`, tarOutput);

      // Show what was in the exclude file
      try {
        const catExcludeCmd = `flyctl ssh console -a ${flyAppName} -C "cat /tmp/snapshot-exclude-${sessionId}.txt"`;
        const { stdout: excludeContent } = await execAsync(catExcludeCmd, {
          env: {
            ...process.env,
            FLY_API_TOKEN: process.env.FLY_API_TOKEN,
          },
          timeout: 15000,
        });
        console.error(`[Snapshot] Exclude patterns:\n${cleanupNoise(excludeContent)}`);
      } catch (err) {
        console.error('[Snapshot] Could not read exclude file:', err);
      }

      await cleanupRemoteFiles(flyAppName, sessionId);
      throw new Error('Snapshot is empty (0 bytes) - check if files are being over-filtered');
    }

    // Check size limit (50MB)
    const { MAX_SNAPSHOT_SIZE } = await import('./filter');
    if (totalSize > MAX_SNAPSHOT_SIZE) {
      // Cleanup before throwing
      await cleanupRemoteFiles(flyAppName, sessionId);
      throw new Error(`Snapshot size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(MAX_SNAPSHOT_SIZE / 1024 / 1024)}MB`);
    }

    console.log(`[Snapshot] Archive created: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    // Step 3: Download tar.gz via base64 encoding (safe for binary transfer over SSH)
    const downloadCommand = [
      `base64 /tmp/snapshot-${sessionId}.tar.gz`,
      'echo "BASE64_COMPLETE"'
    ].join(' && ');

    const escapedDownloadCmd = downloadCommand.replace(/'/g, "'\\''");
    const downloadCmd = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedDownloadCmd}'"`;

    console.log(`[Snapshot] Downloading snapshot...`);
    const { stdout: downloadStdout } = await execAsync(downloadCmd, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 120000, // 2 minutes for large downloads
      maxBuffer: 150 * 1024 * 1024, // 150MB buffer (base64 is ~33% larger)
    });

    const downloadOutput = cleanupNoise(downloadStdout);
    if (!downloadOutput.includes('BASE64_COMPLETE')) {
      throw new Error('Failed to download snapshot from container');
    }

    // Extract base64 content (everything before BASE64_COMPLETE)
    const base64Content = downloadOutput
      .split('\n')
      .filter(line => line !== 'BASE64_COMPLETE' && line.trim() !== '')
      .join('');

    // Decode base64 to Buffer
    const buffer = Buffer.from(base64Content, 'base64');

    if (buffer.length !== totalSize) {
      console.warn(`[Snapshot] Size mismatch: expected ${totalSize}, got ${buffer.length}`);
    }

    console.log(`[Snapshot] Download complete: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Step 4: Cleanup remote files
    await cleanupRemoteFiles(flyAppName, sessionId);

    // Calculate file count (approximate from tar listing)
    const fileCount = await getFileCount(flyAppName, sessionId, buffer);

    const collectionTime = Date.now() - startTime;
    console.log(`[Snapshot] Collection complete in ${(collectionTime / 1000).toFixed(2)}s`);

    return {
      buffer,
      metrics: {
        totalSize: buffer.length,
        fileCount,
        collectionTime,
      },
    };
  } catch (error: any) {
    // Attempt cleanup on error
    try {
      await cleanupRemoteFiles(flyAppName, sessionId);
    } catch (cleanupError) {
      console.error('[Snapshot] Cleanup failed:', cleanupError);
    }

    if (error.message.includes('timeout')) {
      throw new Error(`Snapshot collection timeout: ${error.message}`);
    }

    throw new Error(`Failed to collect workspace snapshot: ${error.message}`);
  }
}

/**
 * Cleanup temporary files on the remote container
 */
async function cleanupRemoteFiles(flyAppName: string, sessionId: string): Promise<void> {
  try {
    const cleanupCommand = `rm -f /tmp/snapshot-${sessionId}.tar.gz /tmp/snapshot-exclude-${sessionId}.txt && echo "CLEANUP_COMPLETE"`;
    const escapedCmd = cleanupCommand.replace(/'/g, "'\\''");
    const cmd = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedCmd}'"`;

    await execAsync(cmd, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 15000,
    });

    console.log(`[Snapshot] Remote cleanup complete for session ${sessionId}`);
  } catch (error: any) {
    console.error(`[Snapshot] Cleanup failed: ${error.message}`);
    // Don't throw - cleanup is best-effort
  }
}

/**
 * Get approximate file count from tar archive
 * Uses tar-stream to count files locally
 */
async function getFileCount(
  _flyAppName: string,
  _sessionId: string,
  buffer: Buffer
): Promise<number> {
  try {
    // Use tar-stream locally to count files
    const { countFilesInTarGz } = await import('./tar-utils');
    return await countFilesInTarGz(buffer);
  } catch (error) {
    console.warn('[Snapshot] Could not determine file count:', error);
    return 0;
  }
}
