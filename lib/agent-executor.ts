import { execSync } from 'child_process';

/**
 * Executes claude-code wrapper in a Fly.io container
 * Used by the chat interface API endpoint
 */
export async function executeClaudeInFlyContainer(
  flyAppName: string,
  machineId: string,
  prompt: string
): Promise<ReadableStream> {
  const apiToken = process.env.FLY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('FLY_API_TOKEN not configured');
  }

  // Escape prompt for shell execution
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  
  const response = await fetch(
    `https://api.machines.dev/v1/apps/${flyAppName}/machines/${machineId}/exec`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cmd: ['/bin/bash', '-c', `claude-code "${escapedPrompt}"`],
        timeout: 300, // 5 minutes
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Fly.io exec failed: ${response.statusText}`);
  }

  return response.body!;
}

/**
 * Executes claude-code wrapper in a local Docker container
 * Used for local development
 */
export function executeClaudeInDockerContainer(
  containerId: string,
  prompt: string
): ReadableStream {
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  
  try {
    // Use docker exec with streaming output
    const command = `docker exec -i ${containerId} bash -c "claude-code \\"${escapedPrompt}\\""`;
    
    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    // Convert output to stream
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(output));
        controller.close();
      },
    });
  } catch (error: any) {
    throw new Error(`Docker exec failed: ${error.message}`);
  }
}

/**
 * Get container info from session
 */
export async function getContainerBySessionId(sessionId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/assessment_sessions?id=eq.${sessionId}&select=container_id,fly_app_name,environment`,
    {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );

  const data = await response.json();
  return data[0] || null;
}
