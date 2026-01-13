/**
 * Vapi Orchestrator
 * 
 * Central controller that coordinates phase transitions, Vapi calls,
 * and timers. This is the main entry point for running an interview.
 */

import { PHASES, PHASE_ORDER, isVapiActiveForPhase, getPhase, TRANSITION_TRIGGER } from './interview-phases.js';
import sessionManager from './session-manager.js';
import timer from './phase-timer.js';
import vapiClient from '../vapi-client.js';

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

    // Create session (await the async function)
    const session = await sessionManager.createSession(candidateId, candidateData);

    // Start the interview (moves to Phase 1)
    const result = await sessionManager.startInterview(session.sessionId);

    // Start Phase 1 timer
    startPhaseTimer(session.sessionId, 'KICK_OFF');

    // Start Vapi call for Kick-off
    if (result.shouldActivateVapi) {
        // [Safety Check] Only start Voice Call if running in browser
        if (typeof window === 'undefined') {
            console.log('[Orchestrator] Running on Server - Skipping Vapi Voice Call start. Client should handle pickup.');
        } else {
            try {
                // Get candidate name for personalization
                const candidateName = candidateData?.name || session.candidateName || 'Candidate';
                
                // KICK_OFF is always first, so no previous conversation history
                // Pass candidate name for first message personalization
                await vapiClient.startPhaseCall(
                    session.sessionId,
                    'KICK_OFF',
                    result.assistantType,
                    [], // No previous context for first phase
                    null, // overrides parameter (not used)
                    { candidateName } // Pass candidate name for personalization
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
 * NOTE: This callback is registered but may not fire in server-side context.
 * Phase transitions are primarily handled by /api/vapi/call-end endpoint.
 */
async function handleVapiCallEnd(callData) {
    const { sessionId, phaseId, duration, messages } = callData;
    if (!sessionId) return;

    // Record call data in session
    await sessionManager.recordVapiCall(sessionId, {
        callId: callData.callId,
        action: 'end',
        duration
    });

    // Store conversation messages from this phase
    if (messages && messages.length > 0) {
        await sessionManager.storeConversationMessages(sessionId, phaseId, messages);
        console.log(`[Orchestrator] Stored ${messages.length} messages from phase ${phaseId}`);
    }

    // Check if this phase transitions on Vapi end
    const phase = getPhase(phaseId);
    if (phase && phase.transitionTrigger === TRANSITION_TRIGGER.VAPI_END) {
        try {
            await transitionPhase(sessionId, TRANSITION_TRIGGER.VAPI_END);
        } catch (error) {
            console.error(`[Orchestrator] Error transitioning phase after call end:`, error);
        }
    }
}

/**
 * Handle commit event from assessment repository API call
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
 * Handle test result event from assessment repository API call
 */
export async function handleTestEvent(sessionId, testData) {
    // Record test result
    const result = await sessionManager.recordTestResult(sessionId, testData);

    // Transition if phase expects it (TRIGGER: PASS)
    if (result.shouldTransition) {
        console.log(`[Orchestrator] Tests passed! Transitioning from ${result.currentPhase.id}`);
        // Use the current phase's transition trigger ('pass') to trigger the transition
        return await transitionPhase(sessionId, result.currentPhase.transitionTrigger);
    }

    return { transition: false, currentPhase: result.currentPhase };
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

    // Transition session to next phase - CRITICAL: Must await this!
    const result = await sessionManager.transitionToNextPhase(sessionId, trigger);

    if (result.isComplete) {
        // Interview finished
        console.log(`[Orchestrator] Interview complete for session ${sessionId}`);
        // Note: Repo cleanup is handled by co-founder's implementation

        emitInterviewComplete(sessionId, result);
        return result;
    }

    const nextPhase = result.currentPhase;

    // Handle case where there's no next phase (shouldn't happen if isComplete check works, but be safe)
    if (!nextPhase) {
        console.warn(`[Orchestrator] No next phase found for session ${sessionId}, marking complete`);
        emitInterviewComplete(sessionId, result);
        return result;
    }

    // Start timer for new phase
    startPhaseTimer(sessionId, nextPhase.id);

    // Start Vapi if this phase requires it
    // NOTE: Vapi calls must be started client-side (browser), not server-side
    // The client-side IDE page polls for phase changes and will automatically start POST_MORTEM calls
    if (result.shouldActivateVapi) {
        // Only attempt to start Vapi call if running in browser (client-side)
        if (typeof window !== 'undefined') {
            try {
                // Retrieve conversation history for context
                const conversationHistory = await sessionManager.getConversationHistory(sessionId);

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
        } else {
            // Server-side: Log that phase transitioned and client will handle Vapi call
            console.log(`[Orchestrator] Phase transitioned to ${nextPhase.id} (Vapi required). Client-side will auto-start call.`);
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
        async (sid, pid) => {
            console.log(`[Orchestrator] Timer expired for session ${sid}, phase ${pid}`);
            await transitionPhase(sid, 'timer');
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
    const session = await sessionManager.getSession(sessionId);
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
 * End interview early (marks as completed)
 */
export async function endInterviewEarly(sessionId, reason = 'manual') {
    timer.cancelTimer(sessionId);

    if (vapiClient.isCallActive()) {
        await vapiClient.stopCall('interview_ended');
    }

    const result = await sessionManager.completeInterview(sessionId);
    result.reason = reason;

    console.log(`[Orchestrator] Interview ended early for session ${sessionId}`);
    // Note: Repo cleanup is handled by co-founder's implementation

    emitInterviewComplete(sessionId, result);

    return result;
}

/**
 * Cancel interview (marks as incomplete/cancelled)
 * Stops the call and marks the interview as cancelled in Supabase
 */
export async function cancelInterviewEarly(sessionId, reason = 'user_cancelled') {
    timer.cancelTimer(sessionId);

    if (vapiClient.isCallActive()) {
        await vapiClient.stopCall('interview_cancelled');
    }

    const result = await sessionManager.cancelInterview(sessionId, reason);
    result.reason = reason;

    console.log(`[Orchestrator] Interview cancelled for session ${sessionId}`);
    // Note: Repo cleanup is handled by co-founder's implementation

    emitInterviewComplete(sessionId, result);

    return result;
}


/**
 * Get current interview status
 */
export async function getInterviewStatus(sessionId) {
    const session = await sessionManager.getSession(sessionId);
    if (!session) return null;

    const phaseInfo = await sessionManager.getCurrentPhaseInfo(sessionId);
    const timerStatus = timer.getTimerStatus(sessionId);
    
    // Get Vapi status from session (server-side) instead of client-side state
    // This works because recordVapiCall stores activeVapiCallId in the session
    const hasActiveCall = !!session.activeVapiCallId;
    const callStatus = {
        status: hasActiveCall ? 'active' : 'idle',
        active: hasActiveCall,
        callId: session.activeVapiCallId || null
    };

    // Get full session data (not just summary) for dashboard
    const sessionSummary = await sessionManager.getSessionSummary(sessionId);

    // Ensure session has all required fields with defaults
    const sessionWithDefaults = {
        ...session, // Include full session data
        candidateName: session.candidateName || sessionSummary?.candidateName || 'Candidate',
        status: session.status || 'created', // Ensure status exists with default
        phaseHistory: session.phaseHistory || [],
        phases: session.phases || {}
    };

    return {
        session: sessionWithDefaults,
        timer: timerStatus || { isActive: false, remaining: 0 },
        vapi: callStatus,
        currentPhase: phaseInfo || { id: 'KICK_OFF', name: 'Kick Off', vapiActive: true, purpose: 'Starting interview' }
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
    cancelInterviewEarly,
    getInterviewStatus,
    onOrchestratorEvent
};
