import sessionManager from '../../../lib/session-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, phaseId, callId, duration, messages } = req.body;

    if (!sessionId || !phaseId) {
        return res.status(400).json({ error: 'Missing sessionId or phaseId' });
    }

    try {
        // Record call end in session
        await sessionManager.recordVapiCall(sessionId, {
            callId,
            action: 'end',
            duration
        });

        // Store conversation messages
        if (messages && messages.length > 0) {
            await sessionManager.storeConversationMessages(sessionId, phaseId, messages);
            console.log(`[API] Stored ${messages.length} messages for session ${sessionId}, phase ${phaseId}`);
        } else {
            console.warn(`[API] No messages to store for session ${sessionId}, phase ${phaseId}`);
        }

        return res.status(200).json({ success: true, messagesStored: messages?.length || 0 });
    } catch (error) {
        console.error('[API] Error recording call end:', error);
        return res.status(500).json({ error: 'Failed to record call end', details: error.message });
    }
}
