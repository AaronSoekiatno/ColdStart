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
