import { supabaseAdmin } from '@/lib/supabase';

interface LogPromptParams {
  candidateId?: string;
  sessionId: string;
  prompt: string;
  toolName?: string;
  provider?: string;
  metadata?: Record<string, any>;
}

interface UpdateLogParams {
  logId: string;
  responseStatus: number | string;
  responseTimeMs: number;
  responseText?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Logs a prompt to the Supabase prompt_logs table.
 * Matches the schema used by the legacy claude-code wrapper.
 */
export async function logPrompt({
  candidateId,
  sessionId,
  prompt,
  toolName = 'Chat V2 UI',
  provider = 'anthropic-direct',
  metadata = {},
}: LogPromptParams): Promise<string | null> {
  if (!supabaseAdmin) {
    console.warn('[Logger] Supabase Admin client not available, skipping log.');
    return null;
  }

  try {
    // If candidateId is missing, try to look it up from session_id
    let resolvedCandidateId = candidateId;
    if (!resolvedCandidateId && sessionId) {
      const { data: session } = await supabaseAdmin
        .from('interview_sessions')
        .select('candidate_id')
        .eq('session_id', sessionId)
        .single();
      
      if (session) {
        resolvedCandidateId = session.candidate_id;
      }
    }

    // Create a preview (first 500 chars)
    const preview = prompt.substring(0, 500);

    const { data, error } = await supabaseAdmin
      .from('prompt_logs')
      .insert({
        candidate_id: resolvedCandidateId,
        provider,
        tool_name: toolName,
        prompt_text: prompt,
        prompt_text_preview: preview,
        request_metadata: {
          ...metadata,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          workspace: metadata.workspace || '/',
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Logger] Failed to insert prompt_log:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[Logger] Error in logPrompt:', err);
    return null;
  }
}

/**
 * Updates an existing prompt log with response details.
 */
export async function updateLogResponse({
  logId,
  responseStatus,
  responseTimeMs,
  responseText,
  inputTokens,
  outputTokens,
}: UpdateLogParams): Promise<void> {
  if (!supabaseAdmin || !logId) return;

  try {
    // We only log metadata or status updates. 
    // If responseText is huge, we might truncate or specific schema might allow text.
    // The legacy wrapper sent `response_text` as "Exit Code: X" or similar summary.
    // Here we can send the actual text or a summary.
    
    await supabaseAdmin
      .from('prompt_logs')
      .update({
        response_status: String(responseStatus),
        duration_ms: responseTimeMs,
        response_text: responseText, // Assuming schema allows text
        // Add token usage to metadata if pure columns don't exist
        // or if schema has specific columns (usage_input, usage_output) use them.
        // For now, let's put it in a separate update or assume standard fields.
        // We'll trust the input params map to what was observed in the old script:
        // response_status, response_time_ms were definitely there.
      })
      .eq('id', logId);

  } catch (err) {
    console.error('[Logger] Error in updateLogResponse:', err);
  }
}
