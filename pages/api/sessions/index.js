/**
 * API Route: Create Session
 * 
 * POST /api/sessions
 * 
 * Creates a new interview session.
 * Body: { candidateId, candidateName }
 * Returns: { sessionId, ...sessionData }
 */

import { createSession } from '../../../lib/session-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { candidateId, candidateName } = req.body;

        if (!candidateId) {
            return res.status(400).json({ error: 'Missing candidateId' });
        }

        // Create the session
        const session = await createSession(candidateId, {
            name: candidateName || 'Unknown Candidate'
        });

        return res.status(201).json(session);

    } catch (error) {
        console.error('[API] Error creating session:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
}
