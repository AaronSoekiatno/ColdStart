import { getInterviewStatus } from '../../../lib/vapi-orchestrator';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
    }

    try {
        const status = getInterviewStatus(sessionId);

        if (!status) {
            return res.status(404).json({ error: 'Session not found' });
        }

        return res.status(200).json(status);

    } catch (error) {
        console.error(`[API] Error fetching status for ${sessionId}:`, error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
