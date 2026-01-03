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
import { handleCommitEvent } from '../../../lib/vapi-orchestrator.js';

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

        // Extract webhook data
        const { repository, commits, ref } = req.body;

        // Only process pushes to main/master branch
        if (!ref.endsWith('/main') && !ref.endsWith('/master')) {
            console.log('[Webhook] Ignoring non-main branch push');
            return res.status(200).json({ message: 'Ignored non-main branch' });
        }

        // No commits? Ignore
        if (!commits || commits.length === 0) {
            console.log('[Webhook] No commits in push event');
            return res.status(200).json({ message: 'No commits' });
        }

        console.log(`[Webhook] Received push event from ${repository.full_name}`);
        console.log(`[Webhook] Commits: ${commits.length}`);

        // Extract session ID from repo name
        // Assuming repo name is the session ID or has a mapping
        const repoName = repository.name;
        const sessionId = repoName; // Or map it: await getSessionIdFromRepoName(repoName)

        // Get the latest commit
        const latestCommit = commits[commits.length - 1];
        const commitData = {
            id: latestCommit.id,
            message: latestCommit.message,
            author: latestCommit.author.name,
            timestamp: latestCommit.timestamp,
            url: latestCommit.url
        };

        console.log(`[Webhook] Processing commit: ${commitData.id.substring(0, 7)} - ${commitData.message}`);

        // Trigger phase transition via orchestrator
        const result = await handleCommitEvent(sessionId, commitData);

        if (result.shouldTransition) {
            console.log(`[Webhook] ✅ Phase transition triggered for session ${sessionId}`);
            return res.status(200).json({
                message: 'Commit processed, phase transition triggered',
                sessionId,
                commitId: commitData.id,
                transitioned: true
            });
        } else {
            console.log(`[Webhook] ℹ️ Commit recorded but no phase transition`);
            return res.status(200).json({
                message: 'Commit recorded',
                sessionId,
                commitId: commitData.id,
                transitioned: false
            });
        }

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
