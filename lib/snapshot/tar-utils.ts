import { Extract } from 'tar-stream';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

export interface TarFileEntry {
  /** File path within the archive */
  path: string;
  /** File size in bytes */
  size: number;
  /** File type (file, directory, symlink, etc.) */
  type: string;
  /** Modification time */
  mtime?: Date;
}

/**
 * Extract a single file from a tar.gz buffer
 *
 * @param buffer - The tar.gz buffer
 * @param targetPath - The file path to extract (e.g., "app/page.tsx")
 * @returns File content as string, or null if not found
 */
export async function extractFileFromTarGz(
  buffer: Buffer,
  targetPath: string
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const extract = new Extract();
    const gunzip = createGunzip();
    let found = false;

    extract.on('entry', (header, stream, next) => {
      // Normalize paths - remove leading ./ if present
      const normalizedHeaderPath = header.name.replace(/^\.\//, '');
      const normalizedTargetPath = targetPath.replace(/^\.\//, '');

      if (normalizedHeaderPath === normalizedTargetPath) {
        found = true;
        const chunks: Buffer[] = [];

        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const content = Buffer.concat(chunks).toString('utf-8');
          resolve(content);
          // Don't call next() - we're done
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to read file from tar: ${err.message}`));
        });
      } else {
        // Skip this entry
        stream.on('end', () => {
          next();
        });
        stream.resume(); // Drain the stream
      }
    });

    extract.on('finish', () => {
      if (!found) {
        resolve(null);
      }
    });

    extract.on('error', (err) => {
      reject(new Error(`Tar extraction error: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Gunzip error: ${err.message}`));
    });

    // Create readable stream from buffer and pipe through gunzip to extract
    const readable = Readable.from(buffer);
    readable.pipe(gunzip).pipe(extract);
  });
}

/**
 * List all files in a tar.gz buffer
 *
 * @param buffer - The tar.gz buffer
 * @returns Array of file paths
 */
export async function listFilesInTarGz(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extract = new Extract();
    const gunzip = createGunzip();
    const files: string[] = [];

    extract.on('entry', (header, stream, next) => {
      // Only add actual files (not directories)
      if (header.type === 'file') {
        // Normalize path - remove leading ./
        const normalizedPath = header.name.replace(/^\.\//, '');
        files.push(normalizedPath);
      }

      // Drain the stream and move to next entry
      stream.on('end', () => {
        next();
      });
      stream.resume();
    });

    extract.on('finish', () => {
      resolve(files);
    });

    extract.on('error', (err) => {
      reject(new Error(`Tar extraction error: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Gunzip error: ${err.message}`));
    });

    // Create readable stream from buffer and pipe through gunzip to extract
    const readable = Readable.from(buffer);
    readable.pipe(gunzip).pipe(extract);
  });
}

/**
 * Get detailed information about all entries in a tar.gz buffer
 *
 * @param buffer - The tar.gz buffer
 * @returns Array of file entry information
 */
export async function listEntriesInTarGz(buffer: Buffer): Promise<TarFileEntry[]> {
  return new Promise((resolve, reject) => {
    const extract = new Extract();
    const gunzip = createGunzip();
    const entries: TarFileEntry[] = [];

    extract.on('entry', (header, stream, next) => {
      // Normalize path - remove leading ./
      const normalizedPath = header.name.replace(/^\.\//, '');

      entries.push({
        path: normalizedPath,
        size: header.size || 0,
        type: header.type,
        mtime: header.mtime,
      });

      // Drain the stream and move to next entry
      stream.on('end', () => {
        next();
      });
      stream.resume();
    });

    extract.on('finish', () => {
      resolve(entries);
    });

    extract.on('error', (err) => {
      reject(new Error(`Tar extraction error: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Gunzip error: ${err.message}`));
    });

    // Create readable stream from buffer and pipe through gunzip to extract
    const readable = Readable.from(buffer);
    readable.pipe(gunzip).pipe(extract);
  });
}

/**
 * Extract multiple files from a tar.gz buffer
 *
 * @param buffer - The tar.gz buffer
 * @param targetPaths - Array of file paths to extract
 * @returns Map of file paths to their content (only includes found files)
 */
export async function extractMultipleFilesFromTarGz(
  buffer: Buffer,
  targetPaths: string[]
): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const extract = new Extract();
    const gunzip = createGunzip();
    const results = new Map<string, string>();
    const normalizedTargets = new Set(targetPaths.map(p => p.replace(/^\.\//, '')));

    extract.on('entry', (header, stream, next) => {
      const normalizedPath = header.name.replace(/^\.\//, '');

      if (normalizedTargets.has(normalizedPath)) {
        const chunks: Buffer[] = [];

        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const content = Buffer.concat(chunks).toString('utf-8');
          results.set(normalizedPath, content);
          next();
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to read file from tar: ${err.message}`));
        });
      } else {
        // Skip this entry
        stream.on('end', () => {
          next();
        });
        stream.resume();
      }
    });

    extract.on('finish', () => {
      resolve(results);
    });

    extract.on('error', (err) => {
      reject(new Error(`Tar extraction error: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Gunzip error: ${err.message}`));
    });

    // Create readable stream from buffer and pipe through gunzip to extract
    const readable = Readable.from(buffer);
    readable.pipe(gunzip).pipe(extract);
  });
}

/**
 * Get the total number of files in a tar.gz buffer
 *
 * @param buffer - The tar.gz buffer
 * @returns Number of files (excluding directories)
 */
export async function countFilesInTarGz(buffer: Buffer): Promise<number> {
  const files = await listFilesInTarGz(buffer);
  return files.length;
}
