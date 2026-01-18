import { exec } from 'child_process';
import { promisify } from 'util';
import { createTwoFilesPatch } from 'diff';

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

export interface WriteFileOptions {
  path: string;
  content: string;
}

export interface RunCommandOptions {
  command: string;
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
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
    });

    // Clean up Fly.io noise from stdout/stderr
    // Remove "Connecting to..." and SSH session details
    const cleanupNoise = (text: string) => {
      return text
        .split('\n')
        .filter(line => !line.startsWith('Connecting to'))
        .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
        .join('\n')
        .trim();
    };

    const cleanStdout = cleanupNoise(stdout);
    const cleanStderr = cleanupNoise(stderr);

    if (cleanStderr && (cleanStderr.includes('No such file') || cleanStderr.includes('not found'))) {
      throw new Error(`File not found: ${path}`);
    }

    if (!cleanStdout && cleanStderr) {
      throw new Error(cleanStderr);
    }

    return cleanStdout;
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

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const cleanupNoise = (text: string) => {
      return text
        .split('\n')
        .filter(line => !line.startsWith('Connecting to'))
        .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
        .join('\n')
        .trim();
    };

    const cleanStdout = cleanupNoise(stdout);
    return cleanStdout;
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
    
    // Use grep with line numbers and context - wrapped in bash -c for proper chaining
    const innerCommand = `cd /workspace && grep -rn ${caseFlag} '${escapedQuery}' --include='${pattern}' . 2>/dev/null | head -n 50`;
    const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
    
    const command = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const cleanupNoise = (text: string) => {
      return text
        .split('\n')
        .filter(line => !line.startsWith('Connecting to'))
        .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
        .join('\n')
        .trim();
    };

    const cleanStdout = cleanupNoise(stdout);

    if (!cleanStdout || cleanStdout === '') {
      return `No matches found for "${query}"`;
    }

    return cleanStdout;
  } catch (error: any) {
    // grep returns exit code 1 if no matches, which is not an error
    if (error.code === 1) {
      return `No matches found for "${query}"`;
    }
    throw new Error(`Failed to search code: ${error.message}`);
  }
}

/**
 * Write content to a file in the workspace
 */
export async function writeWorkspaceFile(
  flyAppName: string,
  options: WriteFileOptions
): Promise<string> {
  const { path, content } = options;

  // Validate path
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }

  try {
    // 4. Calculate Diff (if file existed)
    // We need to read the file *before* writing to it to get the diff. 
    // Optimization: We can do this in parallel or just before writing.
    
    let originalArrowContent = '';
    let diff = '';

    try {
        // Attempt to read the file first to get original content
        // We use our own readWorkspaceFile but need to be careful about recursion if we were calling it from elsewhere, but here it's fine.
        // Actually, let's use the low-level command to avoid overhead.
        const readCmd = `flyctl ssh console -a ${flyAppName} -C "cat /workspace/${path}"`;
        const { stdout: readStdout } = await execAsync(readCmd, {
             env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN },
             timeout: 10000 
        });
        
        // Clean up noise
        originalArrowContent = readStdout
            .split('\n')
            .filter(line => !line.startsWith('Connecting to') && !line.includes('Error: ssh shell'))
            .join('\n')
            .trim();

         // If the file didn't exist or was empty, originalContent might be empty or error text. 
         // We'll assume if it looks like "cat: ... No such file", it's new.
         if (originalArrowContent.includes('No such file') || originalArrowContent.includes('not found')) {
             originalArrowContent = ''; // New file
         }

    } catch (e) {
        // File likely doesn't exist
        originalArrowContent = '';
    }

    // Generate diff
    // We need to compare originalArrowContent vs content
    // We use createTwoFilesPatch to get a unified diff
    if (originalArrowContent !== content) {
        const fileName = path.split('/').pop() || 'file';
        diff = createTwoFilesPatch(fileName, fileName, originalArrowContent, content, 'Original', 'New');
    } else {
        diff = 'No changes detected.';
    }

    // 5. Execute Write
    // 1. Prepare directory path
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    
    // 2. Prepare content (base64 encoded to avoid shell issues)
    const base64Content = Buffer.from(content).toString('base64');
    
    let commandParts = [];
    if (dirPath) {
      commandParts.push(`mkdir -p /workspace/${dirPath}`);
    }
    commandParts.push(`echo '${base64Content}' | base64 -d > /workspace/${path}`);
    commandParts.push('echo "WRITE_OP_COMPLETE"');
    
    // Join commands and wrap in bash -c to ensure && chaining works
    const innerCommand = commandParts.join(' && ');
    // Escape single quotes for bash single-quoted string
    const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
    
    const fullCommand = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;

    console.log(`[writeWorkspaceFile] Executing: ${fullCommand.substring(0, 100)}...`);

    const { stdout, stderr } = await execAsync(fullCommand, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large files
    });

    const cleanupNoise = (text: string) => {
      return text
        .split('\n')
        .filter(line => !line.startsWith('Connecting to'))
        .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
        .join('\n')
        .trim();
    };

    const cleanStdout = cleanupNoise(stdout);
    const cleanStderr = cleanupNoise(stderr);

    // Check for explicit success marker
    if (!cleanStdout.includes('WRITE_OP_COMPLETE')) {
        // If we don't see the success marker, something went wrong
        throw new Error(`Write operation failed or incomplete. Stderr: ${cleanStderr}`);
    }

    if (cleanStderr && cleanStderr.includes('Permission denied')) {
      throw new Error(`Permission denied writing to: ${path}`);
    }

    // Return structured result
    return JSON.stringify({
        status: 'success',
        path,
        diff,
        originalContent: originalArrowContent 
    });

  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Execute a command in the workspace
 */
export async function runWorkspaceCommand(
  flyAppName: string,
  options: RunCommandOptions
): Promise<string> {
  const { command } = options;

  // Basic command validation (prevent dangerous commands)
  const dangerousPatterns = ['rm -rf /', 'dd if=', 'mkfs', ':(){:|:&};:'];
  if (dangerousPatterns.some(pattern => command.includes(pattern))) {
    throw new Error('Command contains potentially dangerous operations');
  }

  try {
    // Run command in workspace directory
    // Run command in workspace directory
    const innerCommand = `cd /workspace && ${command}`;
    const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
    
    const sshCommand = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;

    const { stdout, stderr } = await execAsync(sshCommand, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 60000, // 60s timeout for commands like npm test
      maxBuffer: 10 * 1024 * 1024,
    });

    const cleanupNoise = (text: string) => {
      return text
        .split('\n')
        .filter(line => !line.startsWith('Connecting to'))
        .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
        .join('\n')
        .trim();
    };

    const cleanStdout = cleanupNoise(stdout);
    const cleanStderr = cleanupNoise(stderr);

    // Combine stdout and stderr for full command output
    const output = [cleanStdout, cleanStderr].filter(Boolean).join('\n\n');

    return output || 'Command executed successfully (no output)';
  } catch (error: any) {
    // Command failures (non-zero exit codes) are expected for things like failing tests
    if (error.stdout || error.stderr) {
      const cleanupNoise = (text: string) => {
        return text
          .split('\n')
          .filter(line => !line.startsWith('Connecting to'))
          .filter(line => !line.includes('Error: ssh shell: Process exited with status'))
          .join('\n')
          .trim();
      };

      const cleanStdout = cleanupNoise(error.stdout || '');
      const cleanStderr = cleanupNoise(error.stderr || '');
      
      return [cleanStdout, cleanStderr].filter(Boolean).join('\n\n') || `Command failed: ${error.message}`;
    }
    
    throw new Error(`Failed to run command: ${error.message}`);
  }
}
