import { startInterview, initializeOrchestrator } from '../../../lib/vapi-orchestrator';
import { createInterviewRepo, addCollaborator, setupWebhook } from '../../../lib/github-repo-manager';

// Ensure orchestrator is listening
initializeOrchestrator();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { candidateName, candidateId, githubUsername } = req.body;

    if (!candidateName || !candidateId) {
        return res.status(400).json({ error: 'Missing candidateName or candidateId' });
    }

    try {
        console.log(`[API] Starting interview for ${candidateName} (${candidateId})`);

        // 1. Create GitHub Repo (if username provided)
        let repoInfo = null;
        if (githubUsername) {
            try {
                const repo = await createInterviewRepo(candidateId);
                await addCollaborator(repo.name, githubUsername);
                await setupWebhook(repo.name);
                repoInfo = {
                    name: repo.name,
                    url: repo.url,
                    owner: repo.owner
                };
            } catch (repoError) {
                console.error('[API] Failed to provision GitHub repo:', repoError);
                // We continue, but warn
            }
        }

        // 2. Start Interview Orchestration
        const result = await startInterview(candidateId, {
            name: candidateName,
            githubUsername,
            repo: repoInfo
        });

        return res.status(200).json({
            message: 'Interview started successfully',
            sessionId: result.sessionId,
            phase: result.phase,
            repo: repoInfo
        });

    } catch (error) {
        console.error('[API] Error starting interview:', error);
        return res.status(500).json({
            error: 'Failed to start interview',
            details: error.message
        });
    }
}
