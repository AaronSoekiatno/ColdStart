/**
 * Executes claude-code wrapper in a Fly.io container
 * Used by the chat interface API endpoint
 */
export async function executeClaudeInFlyContainer(
  flyAppName: string,
  _machineId: string, // Not used, we'll discover it
  prompt: string
): Promise<ReadableStream> {
  const apiToken = process.env.FLY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('FLY_API_TOKEN not configured');
  }

  // First, list machines in the app to get the machine ID
  const listResponse = await fetch(
    `https://api.machines.dev/v1/apps/${flyAppName}/machines`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Failed to list machines: ${listResponse.statusText}`);
  }

  const machines = await listResponse.json();
  if (!machines || machines.length === 0) {
    throw new Error('No machines found in this app');
  }

  // Use the first machine (typically there's only one per assessment app)
  const machineId = machines[0].id;

  // TODO: Fly.io exec API needs to be called via flyctl SSH, not HTTP API
  // For now, return a placeholder message explaining this limitation
  const placeholderMessage = `🚧 Chat Integration In Progress

The AI Chat feature is being set up! Here's what's happening:

1. ✅ Chat UI is working
2. ✅ Session detected: ${flyAppName}
3. ✅ Machine ID: ${machineId}
4. ⏳ Fly.io exec API integration in progress

**Temporary Workaround:**
You can still use Claude in the terminal! Open the terminal in VS Code and type:
\`\`\`
claude "your question here"
\`\`\`

The chat interface will be fully functional once we complete the Fly.io SSH integration.

Your message: "${prompt}"`;

  // Return the placeholder as a stream
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(placeholderMessage));
      controller.close();
    },
  });
}

/**
 * Get container info from session
 */
export async function getContainerBySessionId(sessionId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/interview_sessions?session_id=eq.${sessionId}&select=container_url,container_status`,
    {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );

  const data = await response.json();
  const session = data[0];
  
  if (!session || !session.container_url) {
    return null;
  }

  // Extract fly app name from URL (e.g., https://assess-xyz.fly.dev -> assess-xyz)
  const urlMatch = session.container_url.match(/https:\/\/([^.]+)\.fly\.dev/);
  const fly_app_name = urlMatch ? urlMatch[1] : null;

  // For Fly.io, we don't have a specific machine ID easily accessible
  // The app name is enough for the exec API
  return {
    fly_app_name,
    container_id: fly_app_name, // Use app name as container ID for Fly.io
    container_status: session.container_status,
  };
}
