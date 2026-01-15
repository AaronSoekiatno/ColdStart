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

  // Escape for shell
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  
  try {
    // Use echo to pipe prompt - avoids stdin waiting issues
    // Run as root with HOME set to /home/coder so paths work
    const command = `flyctl ssh console -a ${flyAppName} -C "bash -c 'export HOME=/home/coder PATH=/home/coder/.local/bin:/home/coder/.npm-global/bin:/usr/bin:/bin && echo \\"${escapedPrompt}\\" | /home/coder/.local/bin/claude-code'"`;
    
    console.log('[Execute Claude] Starting command for app:', flyAppName);
    console.log('[Execute Claude] Prompt:', prompt.substring(0, 100));
    
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        FLY_API_TOKEN: apiToken,
      },
      timeout: 120000, // 2 minutes for now (debugging)
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    console.log('[Execute Claude] Success! stdout length:', stdout?.length);
    console.log('[Execute Claude] stderr:', stderr?.substring(0, 200));

    // Return combined output
    return stdout || stderr || 'No output received';
  } catch (error: any) {
    console.error('[Execute Claude] Error:', error.message);
    console.error('[Execute Claude] stderr:', error.stderr?.substring(0, 500));
    console.error('[Execute Claude] stdout:', error.stdout?.substring(0, 500));
    
    // Include stderr in error message for debugging
    const errorDetails = error.stderr || error.stdout || error.message;
    throw new Error(`Failed to execute: ${errorDetails}`);
  }
}
