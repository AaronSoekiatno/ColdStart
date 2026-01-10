import sessionManager from '../../../lib/session-manager.js';
import { transitionPhase } from '../../../lib/vapi-orchestrator.js';
import { getPhase, TRANSITION_TRIGGER } from '../../../lib/interview-phases.js';

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

        // Check if this phase should transition on vapi_end
        const phase = getPhase(phaseId);
        if (phase && phase.transitionTrigger === TRANSITION_TRIGGER.VAPI_END) {
            console.log(`[API] Phase ${phaseId} transitions on vapi_end, triggering transition...`);
            try {
                const transitionResult = await transitionPhase(sessionId, 'vapi_end');
                console.log(`[API] Successfully transitioned from ${phaseId} to ${transitionResult.currentPhase?.id || 'next phase'}`);
                return res.status(200).json({ 
                    success: true, 
                    messagesStored: messages?.length || 0,
                    phaseTransitioned: true,
                    newPhase: transitionResult.currentPhase?.id
                });
            } catch (transitionError) {
                console.error(`[API] Error transitioning phase:`, transitionError);
                // Don't fail the request - messages are already stored
                return res.status(200).json({ 
                    success: true, 
                    messagesStored: messages?.length || 0,
                    phaseTransitionError: transitionError.message
                });
            }
        }

        return res.status(200).json({ success: true, messagesStored: messages?.length || 0 });
    } catch (error) {
        console.error('[API] Error recording call end:', error);
        return res.status(500).json({ error: 'Failed to record call end', details: error.message });
    }
}
