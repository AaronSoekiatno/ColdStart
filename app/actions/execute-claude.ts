'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Executes claude-code wrapper in a Fly.io container via SSH
 * This runs in Node.js runtime (server action)
 */
export async function executeClaudeInFlyContainer(
  flyAppName: string,
  prompt: string
): Promise<string> {
  const apiToken = process.env.FLY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('FLY_API_TOKEN not configured');
  }

  // Escape single quotes for bash command
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  
  try {
    // Use flyctl ssh console to execute command in container
    const command = `flyctl ssh console -a ${flyAppName} -C "claude-code '${escapedPrompt}'"`;
    
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: apiToken,
      },
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr && !stdout) {
      throw new Error(`Execution failed: ${stderr}`);
    }

    return stdout || stderr;
  } catch (error: any) {
    console.error('[Execute Claude] Error:', error);
    throw new Error(`Failed to execute: ${error.message}`);
  }
}
