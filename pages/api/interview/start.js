import { startInterview, initializeOrchestrator } from '../../../lib/vapi-orchestrator';
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

        // Handle case where table doesn't exist
        if (candidateError && candidateError.code === '42P01') {
            console.error('[API] test_candidates table does not exist. Please run the SQL schema.');
            throw new Error('Database table missing. Please run lib/test-candidates-schema.sql in Supabase SQL Editor.');
        }

        if (candidateError && candidateError.code !== 'PGRST116') {
            // PGRST116 is "not found" which is fine, but other errors are not
            console.error('[API] Error looking up candidate:', candidateError);
            throw new Error(`Database error: ${candidateError.message}`);
        }

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

        // 2. Start Interview Orchestration (pass candidate name for Vapi personalization)
        // Note: Repo access is handled by co-founder's implementation
        const result = await startInterview(candidateId, {
            name: candidateName,
            email: candidateEmail,
            githubUsername: githubUsername || candidate.github_username
        });

        return res.status(200).json({
            message: 'Interview started successfully',
            sessionId: result.sessionId,
            phase: result.phase
        });

    } catch (error) {
        console.error('[API] Error starting interview:', error);
        return res.status(500).json({
            error: 'Failed to start interview',
            details: error.message
        });
    }
}
