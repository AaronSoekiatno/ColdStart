import { exec } from 'child_process';
import { promisify } from 'util';
import { createTwoFilesPatch } from 'diff';
import { execInContainer } from '@/lib/container-orchestration/exec-command';

const execAsync = promisify(exec);

/**
 * Get local docker container name
 */
async function getLocalContainerName(): Promise<string> {
  const getContainerByImage = `docker ps --filter "ancestor=hermes-assessment:latest" --format "{{.Names}}" | head -n 1`;
  const { stdout } = await execAsync(getContainerByImage);
  const containerName = stdout.trim();

  if (!containerName) {
    throw new Error('No local assessment container found');
  }

  return containerName;
}

/**
 * Utility to normalize paths by stripping '@/' prefix
 */
function normalizePath(path: string): string {
  if (path.startsWith('@/')) {
    return path.substring(2);
  }
  return path;
}

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
  const { path: rawPath, startLine, endLine } = options;
  const path = normalizePath(rawPath);

  // Validate path (prevent directory traversal)
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }

  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  try {
    let command: string;

    if (isLocal) {
      const containerName = await getLocalContainerName();
      if (startLine !== undefined || endLine !== undefined) {
        const start = startLine || 1;
        const end = endLine || 999999;
        command = `docker exec ${containerName} sed -n '${start},${end}p' /workspace/${path}`;
      } else {
        command = `docker exec ${containerName} cat /workspace/${path}`;
      }
    } else {
      if (startLine !== undefined || endLine !== undefined) {
        const start = startLine || 1;
        const end = endLine || 999999;
        command = `flyctl ssh console -a ${flyAppName} -C "sed -n '${start},${end}p' /workspace/${path}"`;
      } else {
        command = `flyctl ssh console -a ${flyAppName} -C "cat /workspace/${path}"`;
      }
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
 * Read ALL files from the workspace as a record (for preloading)
 */
export async function readAllWorkspaceFiles(
    flyAppName: string
): Promise<Record<string, string>> {
     const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

     // Node script to recurse and read files, skipping node_modules, .git, etc.
     // Returns a big JSON object.
     const script = `
const fs = require('fs');
const path = require('path');
const root = '/workspace';

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir).sort();
  files.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === '.vite' || file === '.vitest-cache') return;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

try {
  const files = getAllFiles(root);
  const result = {};
  files.forEach(f => {
    try {
        const relative = path.relative(root, f);
        // Skip huge files > 1MB
        if (fs.statSync(f).size < 1000000) {
             result[relative] = fs.readFileSync(f, 'utf8');
        }
    } catch(e) {}
  });
  console.log('JSON_START');
  console.log(JSON.stringify(result));
  console.log('JSON_END');
} catch(e) {
  console.error(e);
}
`;

     // Compress script to one line
     const oneLiner = script.replace(/\\n/g, ' ').replace(/\\s+/g, ' ');

     try {
         let command: string;
         // Cleanly escape the script for bash
         // Since the script uses single quotes, we wrap in double quotes and escape internal double quotes if any (json has double quotes)
         // Actually, better to pass as base64 to avoid escaping hell
        
         const base64Script = Buffer.from(script).toString('base64');
         const runner = `node -e "eval(Buffer.from('${base64Script}', 'base64').toString())"`;
         
         if (isLocal) {
            const containerName = await getLocalContainerName();
            command = `docker exec ${containerName} ${runner}`;
         } else {
             // For Fly.io we need to be careful with quotes in ssh command
             command = `flyctl ssh console -a ${flyAppName} -C "${runner.replace(/"/g, '\\"')}"`;
         }
         
         const { stdout } = await execAsync(command, {
            env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN },
            timeout: 60000,
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
         });

         const jsonStr = stdout.split('JSON_START')[1]?.split('JSON_END')[0];
         if (!jsonStr) {
             throw new Error('Failed to parse read-all output');
         }
         
         return JSON.parse(jsonStr);
     } catch (e: any) {
         console.error('Failed to read all files:', e);
         throw new Error(`Failed to read all files: ${e.message}`);
     }
}

/**
 * List directory contents
 */
export async function listWorkspaceDirectory(
  flyAppName: string,
  options: ListDirectoryOptions
): Promise<string> {
  const { path: rawPath, recursive } = options;
  const path = normalizePath(rawPath);

  // Validate path
  if (path.includes('..') || (path !== '.' && path.startsWith('/'))) {
    throw new Error('Invalid directory path');
  }

  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  try {
    const dirPath = path === '.' ? '/workspace' : `/workspace/${path}`;
    const lsCommand = recursive ? 'ls -laR' : 'ls -la';

    let command: string;
    if (isLocal) {
      const containerName = await getLocalContainerName();
      command = `docker exec ${containerName} ${lsCommand} ${dirPath}`;
    } else {
      command = `flyctl ssh console -a ${flyAppName} -C "${lsCommand} ${dirPath}"`;
    }

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large directory trees
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
    
    // Prevent overwhelming the context window
    const MAX_OUTPUT_SIZE = 50000; // ~50KB of text
    if (cleanStdout.length > MAX_OUTPUT_SIZE) {
      const truncated = cleanStdout.substring(0, MAX_OUTPUT_SIZE);
      const lineCount = cleanStdout.split('\n').length;
      const shownLines = truncated.split('\n').length;
      return `${truncated}\n\n... [Output truncated: showing ${shownLines} of ${lineCount} lines. Total size: ${cleanStdout.length} chars. Use recursive=false or specify a subdirectory for more focused results.]`;
    }
    
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
  const { query, filePattern: rawPattern, caseSensitive } = options;
  const filePattern = rawPattern ? normalizePath(rawPattern) : undefined;

  // Escape query for shell
  const escapedQuery = query.replace(/'/g, "'\\''");

  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  try {
    const caseFlag = caseSensitive ? '' : '-i';
    const pattern = filePattern || '*';

    const innerCommand = `cd /workspace && grep -rn ${caseFlag} '${escapedQuery}' --include='${pattern}' . 2>/dev/null | head -n 50`;

    let command: string;
    if (isLocal) {
      const containerName = await getLocalContainerName();
      command = `docker exec ${containerName} bash -c "${innerCommand}"`;
    } else {
      const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
      command = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;
    }

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large search results
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

    // Prevent overwhelming the context window
    const MAX_OUTPUT_SIZE = 50000;
    if (cleanStdout.length > MAX_OUTPUT_SIZE) {
      const truncated = cleanStdout.substring(0, MAX_OUTPUT_SIZE);
      const lineCount = cleanStdout.split('\n').length;
      const shownLines = truncated.split('\n').length;
      return `${truncated}\n\n... [Search results truncated: showing ${shownLines} of ${lineCount} matches. Use a more specific query or file_pattern.]`;
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
  const { path: rawPath, content } = options;
  const path = normalizePath(rawPath);

  // Validate path
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }

  // Determine if local or Fly.io
  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  console.log(`[writeWorkspaceFile] Writing to ${path}, isLocal: ${isLocal}, flyAppName: ${flyAppName}`);

  try {
    // 4. Calculate Diff (if file existed)
    let originalArrowContent = '';
    let diff = '';

    try {
        // Read original content first
        let readCmd: string;
        if (isLocal) {
            // Local docker container
            const containerName = await getLocalContainerName();
            readCmd = `docker exec ${containerName} cat /workspace/${path}`;
        } else {
            // Fly.io container
            readCmd = `flyctl ssh console -a ${flyAppName} -C "cat /workspace/${path}"`;
        }

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
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    const base64Content = Buffer.from(content).toString('base64');

    let commandParts = [];
    if (dirPath) {
      commandParts.push(`mkdir -p /workspace/${dirPath}`);
    }
    commandParts.push(`echo '${base64Content}' | base64 -d > /workspace/${path}`);
    commandParts.push('echo "WRITE_OP_COMPLETE"');

    const innerCommand = commandParts.join(' && ');

    let fullCommand: string;
    if (isLocal) {
        // Local docker container
        const containerName = await getLocalContainerName();
        fullCommand = `docker exec ${containerName} bash -c "${innerCommand}"`;
    } else {
        // Fly.io container
        const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
        fullCommand = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;
    }

    console.log(`[writeWorkspaceFile] Executing: ${fullCommand.substring(0, 150)}...`);

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

export interface EditFileOptions {
  path: string;
  startLine: number;
  endLine: number;
  newContent: string;
}

/**
 * Edit specific lines in a file (surgical edit)
 */
export async function editWorkspaceFile(
  flyAppName: string,
  options: EditFileOptions
): Promise<string> {
  const { path: rawPath, startLine, endLine, newContent } = options;
  const path = normalizePath(rawPath);

  // Validate path
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }

  // Validate line numbers
  if (startLine < 1 || endLine < startLine) {
    throw new Error('Invalid line range');
  }

  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  try {
    // 1. Read the original file
    const originalContent = await readWorkspaceFile(flyAppName, { path });
    const lines = originalContent.split('\n');

    // 2. Validate line range
    if (startLine > lines.length || endLine > lines.length) {
      throw new Error(`Line range ${startLine}-${endLine} exceeds file length (${lines.length} lines)`);
    }

    // 3. Build new file content
    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const newLines = newContent.split('\n');

    const updatedContent = [...before, ...newLines, ...after].join('\n');

    // 4. Generate diff
    const fileName = path.split('/').pop() || 'file';
    const diff = createTwoFilesPatch(
      fileName,
      fileName,
      originalContent,
      updatedContent,
      'Original',
      'Edited'
    );

    // 5. Write the updated content
    const base64Content = Buffer.from(updatedContent).toString('base64');
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';

    let commandParts = [];
    if (dirPath) {
      commandParts.push(`mkdir -p /workspace/${dirPath}`);
    }
    commandParts.push(`echo '${base64Content}' | base64 -d > /workspace/${path}`);
    commandParts.push('echo "EDIT_OP_COMPLETE"');

    const innerCommand = commandParts.join(' && ');

    let fullCommand: string;
    if (isLocal) {
        const containerName = await getLocalContainerName();
        fullCommand = `docker exec ${containerName} bash -c "${innerCommand}"`;
    } else {
        const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
        fullCommand = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;
    }

    console.log(`[editWorkspaceFile] Editing lines ${startLine}-${endLine} in ${path}, isLocal: ${isLocal}`);

    const { stdout, stderr } = await execAsync(fullCommand, {
      env: {
        ...process.env,
        FLY_API_TOKEN: process.env.FLY_API_TOKEN,
      },
      timeout: 30000,
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

    if (!cleanStdout.includes('EDIT_OP_COMPLETE')) {
      throw new Error(`Edit operation failed or incomplete. Stderr: ${cleanStderr}`);
    }

    if (cleanStderr && cleanStderr.includes('Permission denied')) {
      throw new Error(`Permission denied editing: ${path}`);
    }

    // Return structured result
    return JSON.stringify({
      status: 'success',
      path,
      linesEdited: `${startLine}-${endLine}`,
      diff,
      originalContent
    });

  } catch (error: any) {
    throw new Error(`Failed to edit file: ${error.message}`);
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

  const isLocal = !flyAppName || flyAppName.includes('localhost') || flyAppName.includes('127.0.0.1');

  try {
    const innerCommand = `cd /workspace && ${command}`;

    let sshCommand: string;
    if (isLocal) {
      const containerName = await getLocalContainerName();
      sshCommand = `docker exec ${containerName} bash -c "${innerCommand}"`;
    } else {
      const escapedInnerCommand = innerCommand.replace(/'/g, "'\\''");
      sshCommand = `flyctl ssh console -a ${flyAppName} -C "bash -c '${escapedInnerCommand}'"`;
    }

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
