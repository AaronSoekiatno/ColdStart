/**
 * Vapi Orchestrator
 * 
 * Central controller that coordinates phase transitions, Vapi calls,
 * and timers. This is the main entry point for running an interview.
 */

import { PHASES, PHASE_ORDER, isVapiActiveForPhase, getPhase } from './interview-phases.js';
import sessionManager from './session-manager.js';
import timer from './phase-timer.js';
import vapiClient from '../vapi-client.js';
import { archiveRepo, removeCollaborator } from './github-repo-manager.js';

// Orchestrator state
let isInitialized = false;
let orchestratorCallbacks = {
    onPhaseChange: [],
    onTimerTick: [],
    onInterviewComplete: [],
    onError: []
};

/**
 * Initialize the orchestrator with event listeners
 */
export function initializeOrchestrator() {
    if (isInitialized) {
        console.log('[Orchestrator] Already initialized, skipping listener attachment');
        return;
    }

    // Listen for Vapi call end events
    vapiClient.onEvent('onCallEnd', handleVapiCallEnd);

    isInitialized = true;
    console.log('[Orchestrator] Initialized');
}

/**
 * Start a new interview
 */
export async function startInterview(candidateId, candidateData) {
    console.log(`[Orchestrator] Starting interview for candidate ${candidateId}`);

    // Create session
    const session = sessionManager.createSession(candidateId, candidateData);

    // Start the interview (moves to Phase 1)
    const result = sessionManager.startInterview(session.sessionId);

    // Start Phase 1 timer
    startPhaseTimer(session.sessionId, 'KICK_OFF');

    // Start Vapi call for Kick-off
    if (result.shouldActivateVapi) {
        // [Safety Check] Only start Voice Call if running in browser
        if (typeof window === 'undefined') {
            console.log('[Orchestrator] Running on Server - Skipping Vapi Voice Call start. Client should handle pickup.');
        } else {
            try {
                // Prepare overrides for personalized greeting
                let overrides = null;
                const candidateName = session.candidateName || 'Candidate';

                if (result.assistantType === 'kickoff') {
                    overrides = {
                        firstMessage: `Hello ${candidateName}, welcome to Minerva. I am your AI interviewer today. Are you ready to begin?`
                    };
                }

                // KICK_OFF is always first, so no previous conversation history
                await vapiClient.startPhaseCall(
                    session.sessionId,
                    'KICK_OFF',
                    result.assistantType,
                    [], // No previous context for first phase
                    overrides
                );
            } catch (error) {
                console.error('[Orchestrator] Failed to start Vapi call:', error);
                emitError(session.sessionId, error);
            }
        }
    }

    emitPhaseChange(session.sessionId, result.phase, 'started');

    return {
        sessionId: session.sessionId,
        phase: result.phase,
        session: result.session
    };
}

/**
 * Handle Vapi call end event - may trigger phase transition
 */
async function handleVapiCallEnd(callData) {
    const { sessionId, phaseId, duration, messages } = callData;
    if (!sessionId) return;

    // Record call data in session
    sessionManager.recordVapiCall(sessionId, {
        callId: callData.callId,
        action: 'end',
        duration
    });

    // Store conversation messages from this phase
    if (messages && messages.length > 0) {
        sessionManager.storeConversationMessages(sessionId, phaseId, messages);
        console.log(`[Orchestrator] Stored ${messages.length} messages from phase ${phaseId}`);
    }

    // Check if this phase transitions on Vapi end
    const phase = getPhase(phaseId);
    if (phase && phase.transitionTrigger === 'vapi_end') {
        await transitionPhase(sessionId, 'vapi_end');
    }
}

/**
 * Handle commit event from GitHub webhook
 */
export async function handleCommitEvent(sessionId, commitData) {
    console.log(`[Orchestrator] Commit received for session ${sessionId}`);

    const result = await sessionManager.recordCommit(sessionId, commitData);

    if (result.shouldTransition) {
        await transitionPhase(sessionId, 'commit');
    }

    return result;
}

/**
 * Handle Github Test/Check Suite Event
 */
export async function handleTestEvent(sessionId, testData) {
    // Record test result
    const result = await sessionManager.recordTestResult(sessionId, testData);

    // Transition if phase expects it (TRIGGER: PASS)
    if (result.shouldTransition) {
        console.log(`[Orchestrator] Tests passed! Transitioning from ${result.currentPhase.id}`);
        return handlePhaseTransition(sessionId, result.currentPhase);
    }

    return { transition: false };
}

/**
 * Transition to the next phase
 */
export async function transitionPhase(sessionId, trigger) {
    console.log(`[Orchestrator] Transitioning phase for session ${sessionId}, trigger: ${trigger}`);

    // Cancel current timer
    timer.cancelTimer(sessionId);

    // Stop Vapi if active
    if (vapiClient.isCallActive()) {
        await vapiClient.stopCall('phase_transition');
    }

    // Transition session to next phase
    const result = sessionManager.transitionToNextPhase(sessionId, trigger);

    if (result.isComplete) {
        // Interview finished
        console.log(`[Orchestrator] Interview complete for session ${sessionId}. cleaning up...`);
        await cleanupRepo(sessionId);

        emitInterviewComplete(sessionId, result);
        return result;
    }

    const nextPhase = result.currentPhase;

    // Start timer for new phase
    startPhaseTimer(sessionId, nextPhase.id);

    // Start Vapi if this phase requires it
    if (result.shouldActivateVapi) {
        try {
            // Retrieve conversation history for context
            const conversationHistory = sessionManager.getConversationHistory(sessionId);

            await vapiClient.startPhaseCall(
                sessionId,
                nextPhase.id,
                nextPhase.assistantType,
                conversationHistory // Pass previous messages for context
            );
        } catch (error) {
            console.error('[Orchestrator] Failed to start Vapi call:', error);
            emitError(sessionId, error);
        }
    }

    emitPhaseChange(sessionId, nextPhase, 'started');

    return result;
}

/**
 * Helper to handle phase transition logic internally
 */
async function handlePhaseTransition(sessionId, nextPhase) {
    return transitionPhase(sessionId, nextPhase.transitionTrigger || 'manual');
}

/**
 * Start timer for a phase (only if phase has a duration)
 */
function startPhaseTimer(sessionId, phaseId) {
    const phase = getPhase(phaseId);

    // Skip timer for commit-only phases (Build, Fix have null duration)
    if (!phase.duration) {
        console.log(`[Orchestrator] Phase ${phaseId} is commit-driven, no timer started`);
        return;
    }

    timer.startPhaseTimer(
        sessionId,
        phaseId,
        // On expire
        (sid, pid) => {
            console.log(`[Orchestrator] Timer expired for session ${sid}, phase ${pid}`);
            transitionPhase(sid, 'timer');
        },
        // On tick
        (sid, pid, remaining, duration) => {
            orchestratorCallbacks.onTimerTick.forEach(cb =>
                cb(sid, pid, remaining, duration)
            );
        }
    );
}

/**
 * Force transition to a specific phase (admin/manual)
 */
export async function forcePhaseTransition(sessionId, targetPhaseId) {
    console.log(`[Orchestrator] Force transitioning to ${targetPhaseId}`);

    // Cancel current timer
    timer.cancelTimer(sessionId);

    // Stop Vapi if active
    if (vapiClient.isCallActive()) {
        await vapiClient.stopCall('force_transition');
    }

    // Manually set the phase in session
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Complete current phase
    const currentPhaseId = session.currentPhase;
    if (currentPhaseId) {
        session.phases[currentPhaseId].status = 'completed';
        session.phases[currentPhaseId].endTime = new Date().toISOString();
    }

    // Start target phase
    session.currentPhase = targetPhaseId;
    session.phases[targetPhaseId].status = 'active';
    session.phases[targetPhaseId].startTime = new Date().toISOString();

    const targetPhase = getPhase(targetPhaseId);

    // Start timer
    startPhaseTimer(sessionId, targetPhaseId);

    // Start Vapi if needed
    if (targetPhase.vapiActive) {
        try {
            await vapiClient.startPhaseCall(
                sessionId,
                targetPhaseId,
                targetPhase.assistantType
            );
        } catch (error) {
            console.error('[Orchestrator] Failed to start Vapi call:', error);
        }
    }

    emitPhaseChange(sessionId, targetPhase, 'force_started');

    return { session, phase: targetPhase };
}

/**
 * Pause the interview
 */
export function pauseInterview(sessionId) {
    timer.pauseTimer(sessionId);
    sessionManager.updateSession(sessionId, { status: 'paused' });
    console.log(`[Orchestrator] Interview paused for session ${sessionId}`);
}

/**
 * Resume the interview
 */
export function resumeInterview(sessionId) {
    timer.resumeTimer(sessionId, (sid, pid, remaining, duration) => {
        orchestratorCallbacks.onTimerTick.forEach(cb =>
            cb(sid, pid, remaining, duration)
        );
    });
    sessionManager.updateSession(sessionId, { status: 'active' });
    console.log(`[Orchestrator] Interview resumed for session ${sessionId}`);
}

/**
 * Add extra time to current phase
 */
export function addExtraTime(sessionId, extraSeconds) {
    timer.addTime(sessionId, extraSeconds);
    console.log(`[Orchestrator] Added ${extraSeconds}s to session ${sessionId}`);
}

/**
 * End interview early
 */
export async function endInterviewEarly(sessionId, reason = 'manual') {
    timer.cancelTimer(sessionId);

    if (vapiClient.isCallActive()) {
        await vapiClient.stopCall('interview_ended');
    }

    const result = sessionManager.completeInterview(sessionId);
    result.reason = reason;

    console.log(`[Orchestrator] Interview ended early for session ${sessionId}. cleaning up...`);
    await cleanupRepo(sessionId);

    emitInterviewComplete(sessionId, result);

    return result;
}

/**
 * Helper to cleanup repo access
 */
async function cleanupRepo(sessionId) {
    try {
        const session = sessionManager.getSession(sessionId);
        // Assuming repoName is stored in session or we derive it
        // Ideally session object should have repo info. 
        // For now, if we assume repoName = sessionId (or stored in session.repoName)
        // Let's check session.repo data
        const repoName = session.repo?.name || sessionId; // Fallback
        const username = session.githubUsername;

        if (username) await removeCollaborator(repoName, username);
        await archiveRepo(repoName);

    } catch (error) {
        console.error(`[Orchestrator] Failed to cleanup repo for ${sessionId}:`, error);
    }
}

/**
 * Get current interview status
 */
export function getInterviewStatus(sessionId) {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;

    const phaseInfo = sessionManager.getCurrentPhaseInfo(sessionId);
    const timerStatus = timer.getTimerStatus(sessionId);
    const callStatus = vapiClient.getCallStatus();

    return {
        session: sessionManager.getSessionSummary(sessionId),
        timer: timerStatus,
        vapi: callStatus,
        currentPhase: phaseInfo
    };
}

// Event emitters
function emitPhaseChange(sessionId, phase, action) {
    orchestratorCallbacks.onPhaseChange.forEach(cb =>
        cb(sessionId, phase, action)
    );
}

function emitInterviewComplete(sessionId, result) {
    orchestratorCallbacks.onInterviewComplete.forEach(cb =>
        cb(sessionId, result)
    );
}

function emitError(sessionId, error) {
    orchestratorCallbacks.onError.forEach(cb =>
        cb(sessionId, error)
    );
}

/**
 * Register event callbacks
 */
export function onOrchestratorEvent(eventType, callback) {
    if (orchestratorCallbacks[eventType]) {
        orchestratorCallbacks[eventType].push(callback);
    }
}

export default {
    initializeOrchestrator,
    startInterview,
    handleCommitEvent,
    handleTestEvent,
    transitionPhase,
    forcePhaseTransition,
    pauseInterview,
    resumeInterview,
    addExtraTime,
    endInterviewEarly,
    getInterviewStatus,
    onOrchestratorEvent
};
