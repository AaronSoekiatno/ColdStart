import {
    pauseInterview,
    resumeInterview,
    forcePhaseTransition,
    addExtraTime,
    endInterviewEarly,
    cancelInterviewEarly
} from '../../../lib/vapi-orchestrator';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, action, payload } = req.body;

    if (!sessionId || !action) {
        return res.status(400).json({ error: 'Missing sessionId or action' });
    }

    console.log(`[API] Control action: ${action} for session ${sessionId}`);

    try {
        let result = null;

        switch (action) {
            case 'pause':
                pauseInterview(sessionId);
                result = { message: 'Interview paused' };
                break;
            case 'resume':
                resumeInterview(sessionId);
                result = { message: 'Interview resumed' };
                break;
            case 'next_phase':
                // payload.targetPhase needs to be provided, or we logic it out?
                // For simplicity, let's assume UI knows the target or we just "skip"
                if (!payload?.targetPhase) {
                    throw new Error('Missing targetPhase in payload');
                }
                const transitionResult = await forcePhaseTransition(sessionId, payload.targetPhase);
                result = {
                    message: 'Transitioned successfully',
                    newPhase: transitionResult.phase.id
                };
                break;
            case 'add_time':
                if (!payload?.seconds) {
                    throw new Error('Missing seconds in payload');
                }
                addExtraTime(sessionId, payload.seconds);
                result = { message: `Added ${payload.seconds} seconds` };
                break;
            case 'end_interview':
                const endResult = await endInterviewEarly(sessionId, 'admin_manual');
                result = { message: 'Interview ended', summary: endResult };
                break;
            case 'stop_call':
                // Stop call and cancel interview (marks as incomplete)
                const cancelResult = await cancelInterviewEarly(sessionId, 'user_stopped_call');
                result = { message: 'Call stopped and interview cancelled', summary: cancelResult };
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error(`[API] Control error for ${sessionId}:`, error);
        return res.status(500).json({
            error: 'Command failed',
            details: error.message
        });
    }
}
