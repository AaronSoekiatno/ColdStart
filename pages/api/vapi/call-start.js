import sessionManager from '../../../lib/session-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, callId } = req.body;

    if (!sessionId || !callId) {
        return res.status(400).json({ error: 'Missing sessionId or callId' });
    }

    try {
        await sessionManager.recordVapiCall(sessionId, {
            callId,
            action: 'start'
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[API] Error recording call start:', error);
        return res.status(500).json({ error: 'Failed to record call start' });
    }
}

