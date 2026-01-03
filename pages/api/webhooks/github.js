/**
 * GitHub Webhook Handler
 * 
 * Receives push events from GitHub and triggers phase transitions
 * when commits are detected during BUILD or FIX phases.
 * 
 * Setup:
 * 1. Deploy this endpoint or expose via ngrok
 * 2. Add webhook in GitHub repo settings:
 *    - Payload URL: https://your-domain.com/api/webhooks/github
 *    - Content type: application/json
 *    - Events: Just the push event
 *    - Secret: (set GITHUB_WEBHOOK_SECRET env var)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { handleCommitEvent, handleTestEvent } from '../../../lib/vapi-orchestrator.js';

export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify webhook signature (security)
        const signature = req.headers['x-hub-signature-256'];
        const isValid = verifyGitHubSignature(req.body, signature);

        if (!isValid) {
            console.error('[Webhook] Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Determine event type
        const eventType = req.headers['x-github-event'] || 'push';

        // --- HANDLE PUSH EVENTS ---
        if (eventType === 'push') {
            const { repository, commits, ref } = req.body;

            // Only process pushes to main/master
            if (!ref.endsWith('/main') && !ref.endsWith('/master')) {
                return res.status(200).json({ message: 'Ignored non-main branch' });
            }

            if (!commits || commits.length === 0) return res.status(200).json({ message: 'No commits' });

            const repoName = repository.name;
            const sessionId = repoName;

            // Record the commit (Activity)
            const latestCommit = commits[commits.length - 1];
            await handleCommitEvent(sessionId, {
                id: latestCommit.id,
                message: latestCommit.message,
                author: latestCommit.author.name,
                timestamp: latestCommit.timestamp,
                url: latestCommit.url
            });

            return res.status(200).json({ message: 'Commit recorded' });
        }

        // --- HANDLE CHECK SUITE (TEST_RESULTS) ---
        if (eventType === 'check_suite') {
            const { action, check_suite, repository } = req.body;

            // We only care when the suite is COMPLETED
            if (action !== 'completed') {
                return res.status(200).json({ message: 'Ignored check_suite status (not completed)' });
            }

            const sessionId = repository.name;
            const conclusion = check_suite.conclusion; // 'success', 'failure', 'neutral'

            console.log(`[Webhook] Check Suite Completed for ${sessionId}: ${conclusion}`);

            // Delegate to Orchestrator to decide if we transition
            const result = await handleTestEvent(sessionId, {
                status: check_suite.status,
                conclusion: conclusion,
                head_sha: check_suite.head_sha
            });

            if (result.transition) {
                return res.status(200).json({ message: 'Transition triggered by passing tests' });
            } else {
                return res.status(200).json({ message: 'Test result recorded', conclusion });
            }
        }

        return res.status(200).json({ message: 'Ignored event type' });

    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Verify GitHub webhook signature for security
 */
function verifyGitHubSignature(payload, signature) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Skip verification in development if no secret set
    if (!secret) {
        console.warn('[Webhook] ⚠️ No GITHUB_WEBHOOK_SECRET set, skipping signature verification');
        return true;
    }

    if (!signature) {
        return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}

/**
 * Optional: Map repo name to session ID if they're different
 */
async function getSessionIdFromRepoName(repoName) {
    // If repo name IS the session ID, just return it
    return repoName;

    // Otherwise, query database for mapping
    // const session = await supabase
    //   .from('interview_sessions')
    //   .select('session_id')
    //   .eq('repo_name', repoName)
    //   .single();
    // return session.data?.session_id;
}
