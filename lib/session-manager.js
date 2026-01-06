/**
 * Interview Session Manager with Supabase Persistence
 * 
 * Tracks interview state for each candidate with write-through caching
 * to minimize Supabase egress costs while maintaining data persistence.
 */

import {
    PHASES,
    PHASE_ORDER,
    PHASE_STATUS,
    getPhase,
    getNextPhase,
    isVapiActiveForPhase
} from './interview-phases.js';
import { supabase, TABLES } from './supabase-client.js';
import cache from './session-cache.js';

/**
 * Session State Structure
 */
function createSessionState(candidateId, candidateData = {}) {
    return {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        candidateId, // Only link to your SaaS - all other candidate data lives in your system

        // Candidate info (for display purposes - not persisted to DB)
        candidateName: candidateData.name || null,
        candidateEmail: candidateData.email || null,
        githubUsername: candidateData.githubUsername || null,

        // GitHub repo info (Minerva-controlled temporary repos)
        repoName: null,
        repoUrl: null,

        // Phase tracking
        currentPhase: null,
        phaseHistory: [],
        phases: PHASE_ORDER.reduce((acc, phaseId) => {
            acc[phaseId] = {
                status: PHASE_STATUS.PENDING,
                startTime: null,
                endTime: null,
                vapiCallId: null,
                commits: [],
                notes: [],
                messages: [] // Conversation messages from this phase
            };
            return acc;
        }, {}),

        // Timing
        interviewStartTime: null,
        interviewEndTime: null,

        // Vapi tracking
        activeVapiCallId: null,
        totalVapiSeconds: 0,
        conversationHistory: [], // Accumulated messages from all Vapi phases

        // Status
        status: 'created', // created, active, paused, completed, cancelled

        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Create a new interview session
 */
export async function createSession(candidateId, candidateData = {}) {
    const session = createSessionState(candidateId, candidateData);

    // Write to Supabase
    const { data, error } = await supabase
        .from(TABLES.SESSIONS)
        .insert({
            session_id: session.sessionId,
            candidate_id: session.candidateId,
            repo_name: session.repoName,
            repo_url: session.repoUrl,
            current_phase: session.currentPhase,
            status: session.status,
            interview_start_time: session.interviewStartTime,
            interview_end_time: session.interviewEndTime,
            active_vapi_call_id: session.activeVapiCallId,
            total_vapi_seconds: session.totalVapiSeconds,
            conversation_history: session.conversationHistory,
            phases: session.phases,
            phase_history: session.phaseHistory,
            created_at: session.createdAt,
            updated_at: session.updatedAt
        })
        .select()
        .single();

    if (error) {
        console.error('[Session] Failed to create session in Supabase:', error);
        throw new Error(`Failed to create session: ${error.message}`);
    }

    // Cache the session
    cache.set(session.sessionId, session);

    console.log(`[Session] Created session ${session.sessionId} for candidate ${candidateId}`);
    return session;
}

/**
 * Get session by ID (cache-first)
 */
export async function getSession(sessionId) {
    // Check cache first
    const cached = cache.get(sessionId);
    if (cached) {
        console.log(`[Session] Cache HIT for ${sessionId}`);
        return cached;
    }

    // Cache miss - fetch from Supabase
    console.log(`[Session] Cache MISS for ${sessionId}, fetching from database`);
    const { data, error } = await supabase
        .from(TABLES.SESSIONS)
        .select('*')
        .eq('session_id', sessionId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found
            return null;
        }
        console.error('[Session] Error fetching session:', error);
        return null;
    }

    if (data) {
        // Transform database row to session object
        const session = transformDbRowToSession(data);
        // Store in cache
        cache.set(sessionId, session);
        return session;
    }

    return null;
}

/**
 * Get session by candidate ID
 */
export async function getSessionByCandidate(candidateId) {
    const { data, error } = await supabase
        .from(TABLES.SESSIONS)
        .select('*')
        .eq('candidate_id', candidateId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('[Session] Error fetching session by candidate:', error);
        return null;
    }

    if (data) {
        const session = transformDbRowToSession(data);
        cache.set(session.sessionId, session);
        return session;
    }

    return null;
}

/**
 * Update session data (write-through cache)
 */
export async function updateSession(sessionId, updates) {
    const session = await getSession(sessionId);
    if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

    // Merge updates
    const updatedSession = { ...session, ...updates, updatedAt: new Date().toISOString() };

    // Write to Supabase
    const { error } = await supabase
        .from(TABLES.SESSIONS)
        .update(transformSessionToDbRow(updatedSession))
        .eq('session_id', sessionId);

    if (error) {
        console.error('[Session] Failed to update session:', error);
        throw new Error(`Failed to update session: ${error.message}`);
    }

    // Update cache
    cache.set(sessionId, updatedSession);

    return updatedSession;
}

/**
 * Start the interview (begins Phase 1)
 */
export async function startInterview(sessionId) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    const updates = {
        status: 'active',
        interviewStartTime: now,
        currentPhase: 'KICK_OFF'
    };

    // Mark first phase as active
    session.phases.KICK_OFF.status = PHASE_STATUS.ACTIVE;
    session.phases.KICK_OFF.startTime = now;
    session.phaseHistory.push({
        phase: 'KICK_OFF',
        action: 'started',
        timestamp: now
    });

    updates.phases = session.phases;
    updates.phaseHistory = session.phaseHistory;

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Interview started for session ${sessionId}`);

    return {
        session: updatedSession,
        phase: getPhase('KICK_OFF'),
        shouldActivateVapi: true,
        assistantType: 'kickoff'
    };
}

/**
 * Transition to the next phase
 */
export async function transitionToNextPhase(sessionId, trigger = 'timer') {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentPhaseId = session.currentPhase;
    const currentPhase = getPhase(currentPhaseId);
    const nextPhase = getNextPhase(currentPhaseId);

    if (!nextPhase) {
        // Interview complete
        return completeInterview(sessionId);
    }

    const now = new Date().toISOString();

    // Complete current phase
    session.phases[currentPhaseId].status = PHASE_STATUS.COMPLETED;
    session.phases[currentPhaseId].endTime = now;
    session.phaseHistory.push({
        phase: currentPhaseId,
        action: 'completed',
        trigger,
        timestamp: now
    });

    // Start next phase
    session.currentPhase = nextPhase.id;
    session.phases[nextPhase.id].status = PHASE_STATUS.ACTIVE;
    session.phases[nextPhase.id].startTime = now;
    session.phaseHistory.push({
        phase: nextPhase.id,
        action: 'started',
        timestamp: now
    });

    const updates = {
        currentPhase: session.currentPhase,
        phases: session.phases,
        phaseHistory: session.phaseHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Transitioned from ${currentPhaseId} to ${nextPhase.id}`);

    return {
        session: updatedSession,
        previousPhase: currentPhase,
        currentPhase: nextPhase,
        shouldActivateVapi: nextPhase.vapiActive,
        shouldDeactivateVapi: currentPhase.vapiActive && !nextPhase.vapiActive,
        assistantType: nextPhase.assistantType,
        exitMessage: currentPhase.exitMessage || null
    };
}

/**
 * Record a commit event for the current phase
 */
export async function recordCommit(sessionId, commitData) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentPhaseId = session.currentPhase;
    const now = new Date().toISOString();

    session.phases[currentPhaseId].commits.push({
        ...commitData,
        timestamp: now
    });

    session.phaseHistory.push({
        phase: currentPhaseId,
        action: 'commit',
        commitId: commitData.id,
        timestamp: now
    });

    const updates = {
        phases: session.phases,
        phaseHistory: session.phaseHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Commit recorded for session ${sessionId} in phase ${currentPhaseId}`);

    // Check if commit should trigger phase transition
    const phase = getPhase(currentPhaseId);
    const shouldTransition = phase.transitionTrigger === 'commit';

    return {
        session: updatedSession,
        shouldTransition,
        currentPhase: phase
    };
}

/**
 * Record test result for the current phase
 */
export async function recordTestResult(sessionId, testData) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentPhaseId = session.currentPhase;
    const now = new Date().toISOString();

    // Store test result in phase history
    session.phaseHistory.push({
        phase: currentPhaseId,
        action: 'test_result',
        status: testData.status,
        conclusion: testData.conclusion,
        head_sha: testData.head_sha,
        timestamp: now
    });

    const updates = {
        phaseHistory: session.phaseHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Test result recorded for session ${sessionId} in phase ${currentPhaseId}: ${testData.conclusion}`);

    // Check if test pass should trigger phase transition
    const phase = getPhase(currentPhaseId);
    const shouldTransition = phase.transitionTrigger === 'pass' && testData.conclusion === 'success';

    return {
        session: updatedSession,
        shouldTransition,
        currentPhase: phase
    };
}

/**
 * Record Vapi call activity
 */
export async function recordVapiCall(sessionId, callData) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const { callId, action, duration } = callData;
    const updates = {};

    if (action === 'start') {
        updates.activeVapiCallId = callId;
        session.phases[session.currentPhase].vapiCallId = callId;
        updates.phases = session.phases;
    } else if (action === 'end') {
        updates.activeVapiCallId = null;
        if (duration) {
            updates.totalVapiSeconds = session.totalVapiSeconds + duration;
        }
    }

    const updatedSession = await updateSession(sessionId, updates);
    return updatedSession;
}

/**
 * Complete the interview
 */
export async function completeInterview(sessionId) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    // Complete final phase
    if (session.currentPhase) {
        session.phases[session.currentPhase].status = PHASE_STATUS.COMPLETED;
        session.phases[session.currentPhase].endTime = now;
    }

    session.phaseHistory.push({
        phase: 'POST_MORTEM',
        action: 'completed',
        timestamp: now
    });

    const updates = {
        status: 'completed',
        interviewEndTime: now,
        currentPhase: null,
        phases: session.phases,
        phaseHistory: session.phaseHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Interview completed for session ${sessionId}`);

    return {
        session: updatedSession,
        isComplete: true,
        totalDuration: calculateDuration(session.interviewStartTime, now),
        totalVapiSeconds: session.totalVapiSeconds
    };
}

/**
 * Cancel the interview (mark as incomplete)
 */
export async function cancelInterview(sessionId, reason = 'user_cancelled') {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    // Mark current phase as cancelled if active
    if (session.currentPhase) {
        session.phases[session.currentPhase].status = PHASE_STATUS.PENDING; // Keep as pending since not completed
        session.phases[session.currentPhase].endTime = now;
    }

    session.phaseHistory.push({
        phase: session.currentPhase || 'UNKNOWN',
        action: 'cancelled',
        reason,
        timestamp: now
    });

    const updates = {
        status: 'cancelled',
        interviewEndTime: now,
        currentPhase: null,
        phases: session.phases,
        phaseHistory: session.phaseHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Interview cancelled for session ${sessionId}, reason: ${reason}`);

    return {
        session: updatedSession,
        isCancelled: true,
        totalDuration: calculateDuration(session.interviewStartTime, now),
        totalVapiSeconds: session.totalVapiSeconds,
        reason
    };
}

/**
 * Get current phase info for a session
 */
export async function getCurrentPhaseInfo(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return null;

    const phaseId = session.currentPhase;
    if (!phaseId) return null;

    const phase = getPhase(phaseId);
    const phaseState = session.phases[phaseId];

    return {
        phase,
        state: phaseState,
        elapsedSeconds: phaseState.startTime
            ? calculateDuration(phaseState.startTime, new Date().toISOString())
            : 0,
        remainingSeconds: phaseState.startTime
            ? Math.max(0, phase.duration - calculateDuration(phaseState.startTime, new Date().toISOString()))
            : phase.duration,
        isVapiActive: phase.vapiActive,
        progress: (PHASE_ORDER.indexOf(phaseId) + 1) / PHASE_ORDER.length
    };
}

/**
 * Calculate duration between two ISO timestamps (in seconds)
 */
function calculateDuration(startTime, endTime) {
    return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
}

/**
 * Get session summary for UI/reporting
 */
export async function getSessionSummary(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return null;

    const phaseInfo = await getCurrentPhaseInfo(sessionId);

    return {
        sessionId: session.sessionId,
        candidateName: session.candidateName,
        status: session.status,
        currentPhase: phaseInfo,
        repoUrl: session.repoUrl,
        totalVapiMinutes: Math.round(session.totalVapiSeconds / 60 * 10) / 10,
        phaseProgress: PHASE_ORDER.map(phaseId => ({
            id: phaseId,
            name: PHASES[phaseId].name,
            status: session.phases[phaseId].status,
            vapiActive: PHASES[phaseId].vapiActive
        }))
    };
}

/**
 * Store conversation messages from a completed Vapi phase
 */
export async function storeConversationMessages(sessionId, phaseId, messages) {
    const session = await getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Store messages in the specific phase
    session.phases[phaseId].messages = messages || [];

    // Append to global conversation history (only new messages)
    if (messages && messages.length > 0) {
        session.conversationHistory.push(...messages);
    }

    const updates = {
        phases: session.phases,
        conversationHistory: session.conversationHistory
    };

    const updatedSession = await updateSession(sessionId, updates);

    console.log(`[Session] Stored ${messages?.length || 0} messages for phase ${phaseId}`);

    return updatedSession;
}

/**
 * Get accumulated conversation history for context passing
 */
export async function getConversationHistory(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return [];

    return session.conversationHistory || [];
}

/**
 * Transform database row to session object
 */
function transformDbRowToSession(row) {
    return {
        sessionId: row.session_id,
        candidateId: row.candidate_id,
        repoName: row.repo_name,
        repoUrl: row.repo_url,
        currentPhase: row.current_phase,
        phaseHistory: row.phase_history || [],
        phases: row.phases || {},
        interviewStartTime: row.interview_start_time,
        interviewEndTime: row.interview_end_time,
        activeVapiCallId: row.active_vapi_call_id,
        totalVapiSeconds: row.total_vapi_seconds || 0,
        conversationHistory: row.conversation_history || [],
        status: row.status || 'created', // Ensure status has default value
        candidateName: null, // Will be looked up from candidate table if needed
        candidateEmail: null,
        githubUsername: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Transform session object to database row
 */
function transformSessionToDbRow(session) {
    return {
        session_id: session.sessionId,
        candidate_id: session.candidateId,
        repo_name: session.repoName,
        repo_url: session.repoUrl,
        current_phase: session.currentPhase,
        status: session.status,
        interview_start_time: session.interviewStartTime,
        interview_end_time: session.interviewEndTime,
        active_vapi_call_id: session.activeVapiCallId,
        total_vapi_seconds: session.totalVapiSeconds,
        conversation_history: session.conversationHistory,
        phases: session.phases,
        phase_history: session.phaseHistory,
        updated_at: session.updatedAt
    };
}

export default {
    createSession,
    getSession,
    getSessionByCandidate,
    updateSession,
    startInterview,
    transitionToNextPhase,
    recordCommit,
    recordVapiCall,
    completeInterview,
    cancelInterview,
    getCurrentPhaseInfo,
    getSessionSummary,
    storeConversationMessages,
    getConversationHistory,
    recordTestResult
};
