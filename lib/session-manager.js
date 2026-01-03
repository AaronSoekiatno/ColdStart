/**
 * Interview Session Manager
 * 
 * Tracks interview state for each candidate, handles phase transitions,
 * and emits events for Vapi orchestration and UI updates.
 */

import {
    PHASES,
    PHASE_ORDER,
    PHASE_STATUS,
    getPhase,
    getNextPhase,
    isVapiActiveForPhase
} from './interview-phases.js';

// In-memory session store (replace with database in production)
const sessions = new Map();

/**
 * Session State Structure
 */
function createSessionState(candidateId, candidateData = {}) {
    return {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        candidateId,
        candidateName: candidateData.name || 'Unknown',
        candidateGithubUsername: candidateData.githubUsername || null,
        candidatePhone: candidateData.phone || null,

        // GitHub repo info
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
export function createSession(candidateId, candidateData = {}) {
    const session = createSessionState(candidateId, candidateData);
    sessions.set(session.sessionId, session);

    console.log(`[Session] Created session ${session.sessionId} for candidate ${candidateId}`);
    return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId) {
    return sessions.get(sessionId) || null;
}

/**
 * Get session by candidate ID
 */
export function getSessionByCandidate(candidateId) {
    for (const session of sessions.values()) {
        if (session.candidateId === candidateId && session.status !== 'completed') {
            return session;
        }
    }
    return null;
}

/**
 * Update session data
 */
export function updateSession(sessionId, updates) {
    const session = sessions.get(sessionId);
    if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
    sessions.set(sessionId, session);

    return session;
}

/**
 * Start the interview (begins Phase 1)
 */
export function startInterview(sessionId) {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    updateSession(sessionId, {
        status: 'active',
        interviewStartTime: now,
        currentPhase: 'KICK_OFF'
    });

    // Mark first phase as active
    session.phases.KICK_OFF.status = PHASE_STATUS.ACTIVE;
    session.phases.KICK_OFF.startTime = now;
    session.phaseHistory.push({
        phase: 'KICK_OFF',
        action: 'started',
        timestamp: now
    });

    console.log(`[Session] Interview started for session ${sessionId}`);

    return {
        session,
        phase: getPhase('KICK_OFF'),
        shouldActivateVapi: true,
        assistantType: 'kickoff'
    };
}

/**
 * Transition to the next phase
 */
export function transitionToNextPhase(sessionId, trigger = 'timer') {
    const session = getSession(sessionId);
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

    updateSession(sessionId, { updatedAt: now });

    console.log(`[Session] Transitioned from ${currentPhaseId} to ${nextPhase.id}`);

    return {
        session,
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
export function recordCommit(sessionId, commitData) {
    const session = getSession(sessionId);
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

    updateSession(sessionId, { updatedAt: now });

    console.log(`[Session] Commit recorded for session ${sessionId} in phase ${currentPhaseId}`);

    // Check if commit should trigger phase transition
    const phase = getPhase(currentPhaseId);
    const shouldTransition = phase.transitionTrigger === 'commit';

    return {
        session,
        shouldTransition,
        currentPhase: phase
    };
}

/**
 * Record Vapi call activity
 */
export function recordVapiCall(sessionId, callData) {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const { callId, action, duration } = callData;

    if (action === 'start') {
        session.activeVapiCallId = callId;
        session.phases[session.currentPhase].vapiCallId = callId;
    } else if (action === 'end') {
        session.activeVapiCallId = null;
        if (duration) {
            session.totalVapiSeconds += duration;
        }
    }

    updateSession(sessionId, { updatedAt: new Date().toISOString() });

    return session;
}

/**
 * Complete the interview
 */
export function completeInterview(sessionId) {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const now = new Date().toISOString();

    // Complete final phase
    if (session.currentPhase) {
        session.phases[session.currentPhase].status = PHASE_STATUS.COMPLETED;
        session.phases[session.currentPhase].endTime = now;
    }

    updateSession(sessionId, {
        status: 'completed',
        interviewEndTime: now,
        currentPhase: null
    });

    session.phaseHistory.push({
        phase: 'POST_MORTEM',
        action: 'completed',
        timestamp: now
    });

    console.log(`[Session] Interview completed for session ${sessionId}`);

    return {
        session,
        isComplete: true,
        totalDuration: calculateDuration(session.interviewStartTime, now),
        totalVapiSeconds: session.totalVapiSeconds
    };
}

/**
 * Get current phase info for a session
 */
export function getCurrentPhaseInfo(sessionId) {
    const session = getSession(sessionId);
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
export function getSessionSummary(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;

    const phaseInfo = getCurrentPhaseInfo(sessionId);

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
export function storeConversationMessages(sessionId, phaseId, messages) {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Store messages in the specific phase
    session.phases[phaseId].messages = messages || [];

    // Append to global conversation history
    if (messages && messages.length > 0) {
        session.conversationHistory.push(...messages);
    }

    updateSession(sessionId, { updatedAt: new Date().toISOString() });

    console.log(`[Session] Stored ${messages?.length || 0} messages for phase ${phaseId}`);

    return session;
}

/**
 * Get accumulated conversation history for context passing
 */
export function getConversationHistory(sessionId) {
    const session = getSession(sessionId);
    if (!session) return [];

    return session.conversationHistory || [];
}



// Export session store for testing
export { sessions };

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
    getCurrentPhaseInfo,
    getSessionSummary,
    storeConversationMessages,
    getConversationHistory
};
