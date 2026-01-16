import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Workspace file access via SSH to Fly.io container
 */

export interface ReadFileOptions {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface ListDirectoryOptions {
  path: string;
  recursive?: boolean;
}

export interface SearchCodeOptions {
  query: string;
  filePattern?: string;
  caseSensitive?: boolean;
}

/**
 * Read a file from the workspace
 */
export async function readWorkspaceFile(
  flyAppName: string,
  options: ReadFileOptions
): Promise<string> {
  const { path, startLine, endLine } = options;

  // Validate path (prevent directory traversal)
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }

  try {
    let command: string;

    if (startLine !== undefined || endLine !== undefined) {
      // Read specific line range
      const start = startLine || 1;
      const end = endLine || 999999;
      command = `flyctl ssh console -a ${flyAppName} -C "sed -n '${start},${end}p' /workspace/${path}"`;
    } else {
      // Read entire file
      command = `flyctl ssh console -a ${flyAppName} -C "cat /workspace/${path}"`;
    }

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000, // 30s timeout
      maxBuffer: 5 * 1024 * 1024, // 5MB max
    });

    if (stderr && stderr.includes('No such file')) {
      throw new Error(`File not found: ${path}`);
    }

    return stdout;
  } catch (error: any) {
    if (error.message.includes('File not found')) {
      throw error;
    }
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

/**
 * List directory contents
 */
export async function listWorkspaceDirectory(
  flyAppName: string,
  options: ListDirectoryOptions
): Promise<string> {
  const { path, recursive } = options;

  // Validate path
  if (path.includes('..') || (path !== '.' && path.startsWith('/'))) {
    throw new Error('Invalid directory path');
  }

  try {
    const dirPath = path === '.' ? '/workspace' : `/workspace/${path}`;
    const lsCommand = recursive ? 'ls -laR' : 'ls -la';
    const command = `flyctl ssh console -a ${flyAppName} -C "${lsCommand} ${dirPath}"`;

    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024, // 2MB max
    });

    return stdout;
  } catch (error: any) {
    throw new Error(`Failed to list directory: ${error.message}`);
  }
}

/**
 * Search for code patterns in workspace
 */
export async function searchWorkspaceCode(
  flyAppName: string,
  options: SearchCodeOptions
): Promise<string> {
  const { query, filePattern, caseSensitive } = options;

  // Escape query for shell
  const escapedQuery = query.replace(/'/g, "'\\''");

  try {
    const caseFlag = caseSensitive ? '' : '-i';
    const pattern = filePattern || '*';
    
    // Use grep with line numbers and context
    const command = `flyctl ssh console -a ${flyAppName} -C "cd /workspace && grep -rn ${caseFlag} '${escapedQuery}' --include='${pattern}' . 2>/dev/null | head -n 50"`;

    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    });

    if (!stdout || stdout.trim() === '') {
      return `No matches found for "${query}"`;
    }

    return stdout;
  } catch (error: any) {
    // grep returns exit code 1 if no matches, which is not an error
    if (error.code === 1) {
      return `No matches found for "${query}"`;
    }
    throw new Error(`Failed to search code: ${error.message}`);
  }
}
