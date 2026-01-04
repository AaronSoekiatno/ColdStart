/**
 * API Route: Get Session
 * 
 * GET /api/sessions/[sessionId]
 * 
 * Retrieves current status of an interview session.
 * Returns: { sessionId, currentPhase, status, ... }
 */

import { getSession } from '../../../lib/session-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Missing sessionId' });
        }

        const session = await getSession(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        return res.status(200).json(session);

    } catch (error) {
        console.error(`[API] Error fetching session ${req.query.sessionId}:`, error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
}
