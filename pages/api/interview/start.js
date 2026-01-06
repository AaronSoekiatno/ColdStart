import { startInterview, initializeOrchestrator } from '../../../lib/vapi-orchestrator';
import { createInterviewRepo, addCollaborator, setupWebhook } from '../../../lib/github-repo-manager';
import { supabase } from '../../../lib/supabase-client.js';

// Ensure orchestrator is listening
initializeOrchestrator();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { candidateEmail, candidateName, githubUsername } = req.body;

    if (!candidateEmail || !candidateName) {
        return res.status(400).json({ error: 'Missing candidateEmail or candidateName' });
    }

    try {
        // 1. Look up or create candidate by email
        let { data: candidate, error: candidateError } = await supabase
            .from('test_candidates')
            .select('*')
            .eq('email', candidateEmail.toLowerCase())
            .single();

        if (!candidate) {
            // Create new candidate
            const candidateId = `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const { data: newCandidate, error: createError } = await supabase
                .from('test_candidates')
                .insert({
                    id: candidateId,
                    email: candidateEmail.toLowerCase(),
                    name: candidateName,
                    github_username: githubUsername || null
                })
                .select()
                .single();
            
            if (createError) {
                console.error('[API] Failed to create candidate:', createError);
                throw new Error(`Failed to create candidate: ${createError.message}`);
            }
            candidate = newCandidate;
        } else {
            // Update candidate info if needed
            if (candidateName !== candidate.name || githubUsername !== candidate.github_username) {
                const { data: updated } = await supabase
                    .from('test_candidates')
                    .update({
                        name: candidateName,
                        github_username: githubUsername || candidate.github_username,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', candidate.id)
                    .select()
                    .single();
                
                if (updated) candidate = updated;
            }
        }

        const candidateId = candidate.id;
        console.log(`[API] Starting interview for ${candidateName} (${candidateId}) - ${candidateEmail}`);

        // 2. Create GitHub Repo (if username provided)
        let repoInfo = null;
        if (githubUsername || candidate.github_username) {
            try {
                const repo = await createInterviewRepo(candidateId);
                await addCollaborator(repo.name, githubUsername || candidate.github_username);
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

        // 3. Start Interview Orchestration (pass candidate name for Vapi personalization)
        const result = await startInterview(candidateId, {
            name: candidateName,
            email: candidateEmail,
            githubUsername: githubUsername || candidate.github_username,
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
