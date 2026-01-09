import { startInterview, initializeOrchestrator } from '../../../lib/vapi-orchestrator';
import { supabaseAdmin } from '../../../lib/supabase';

// Ensure orchestrator is listening for events
initializeOrchestrator();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept token from multiple sources for flexibility
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const headerToken = req.headers['x-provisioning-token'];
    const bodyToken = req.body?.token;
    const queryToken = req.query?.token;

    const token = bearerToken || headerToken || bodyToken || queryToken;
    if (!token) {
      return res.status(400).json({ error: 'Missing provisioning token' });
    }

    // Resolve candidate via provisioning token (using admin client for elevated permissions)
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server configuration error: Admin client not available' });
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id, email, name')
      .eq('provisioning_token', token)
      .single();

    if (candidateError || !candidate) {
      return res.status(401).json({ error: 'Invalid provisioning token' });
    }

    // Start interview; server supplies personalization (no PII required from client)
    const result = await startInterview(candidate.id, {
      name: candidate.name,
      email: candidate.email,
    });

    return res.status(200).json({
      message: 'Interview started successfully',
      sessionId: result.sessionId,
      phase: result.phase,
    });
  } catch (e) {
    console.error('[API] Error starting interview by token:', e);
    return res.status(500).json({
      error: 'Failed to start interview',
      details: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}


