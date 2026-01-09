/**
 * Phase Timer System
 * 
 * Manages timing for each phase and triggers phase transitions
 * when duration expires. Supports pause/resume for flexibility.
 */

import { getPhase, TRANSITION_TRIGGER } from './interview-phases.js';
import { transitionToNextPhase, getCurrentPhaseInfo } from './session-manager.js';

// Active timers store
const activeTimers = new Map();

/**
 * Timer State Structure
 */
function createTimerState(sessionId, phaseId, duration, onExpire) {
    return {
        sessionId,
        phaseId,
        duration,          // Total duration in seconds
        remaining: duration,
        startTime: null,
        pausedAt: null,
        timerId: null,
        intervalId: null,
        onExpire,
        status: 'created'  // created, running, paused, expired, cancelled
    };
}

/**
 * Start a timer for a phase
 */
export function startPhaseTimer(sessionId, phaseId, onExpire, onTick = null) {
    const phase = getPhase(phaseId);
    if (!phase) {
        throw new Error(`Unknown phase: ${phaseId}`);
    }

    // Don't create timer for commit-only phases
    if (!phase.duration) {
        console.log(`[Timer] Phase ${phaseId} is commit-driven, skipping timer creation`);
        return null;
    }

    // Cancel existing timer for this session if any
    cancelTimer(sessionId);

    const timer = createTimerState(sessionId, phaseId, phase.duration, onExpire);
    timer.startTime = Date.now();
    timer.status = 'running';

    // Set up the expiration timer
    timer.timerId = setTimeout(() => {
        timerExpired(sessionId);
    }, timer.duration * 1000);

    // Set up tick interval for UI updates (every second)
    if (onTick) {
        timer.intervalId = setInterval(() => {
            const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
            const remaining = Math.max(0, timer.duration - elapsed);
            timer.remaining = remaining;
            onTick(sessionId, phaseId, remaining, timer.duration);
        }, 1000);
    }

    activeTimers.set(sessionId, timer);

    console.log(`[Timer] Started timer for session ${sessionId}, phase ${phaseId}: ${timer.duration}s`);

    return timer;
}

/**
 * Timer expired - trigger phase transition
 */
function timerExpired(sessionId) {
    const timer = activeTimers.get(sessionId);
    if (!timer || timer.status !== 'running') return;

    timer.status = 'expired';
    timer.remaining = 0;

    // Clear intervals
    if (timer.intervalId) {
        clearInterval(timer.intervalId);
    }

    console.log(`[Timer] Timer expired for session ${sessionId}, phase ${timer.phaseId}`);

    // Call the expiration callback
    if (timer.onExpire) {
        timer.onExpire(sessionId, timer.phaseId);
    }

    activeTimers.delete(sessionId);
}

/**
 * Pause a running timer
 */
export function pauseTimer(sessionId) {
    const timer = activeTimers.get(sessionId);
    if (!timer || timer.status !== 'running') return null;

    // Clear the timeout
    if (timer.timerId) {
        clearTimeout(timer.timerId);
    }
    if (timer.intervalId) {
        clearInterval(timer.intervalId);
    }

    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
    timer.remaining = Math.max(0, timer.duration - elapsed);
    timer.pausedAt = Date.now();
    timer.status = 'paused';

    console.log(`[Timer] Paused timer for session ${sessionId}: ${timer.remaining}s remaining`);

    return timer;
}

/**
 * Resume a paused timer
 */
export function resumeTimer(sessionId, onTick = null) {
    const timer = activeTimers.get(sessionId);
    if (!timer || timer.status !== 'paused') return null;

    timer.startTime = Date.now();
    timer.pausedAt = null;
    timer.status = 'running';

    // Restart timeout with remaining time
    timer.timerId = setTimeout(() => {
        timerExpired(sessionId);
    }, timer.remaining * 1000);

    // Restart tick interval
    if (onTick) {
        timer.intervalId = setInterval(() => {
            const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
            const remaining = Math.max(0, timer.remaining - elapsed);
            onTick(sessionId, timer.phaseId, remaining, timer.duration);
        }, 1000);
    }

    console.log(`[Timer] Resumed timer for session ${sessionId}: ${timer.remaining}s remaining`);

    return timer;
}

/**
 * Cancel a timer
 */
export function cancelTimer(sessionId) {
    const timer = activeTimers.get(sessionId);
    if (!timer) return;

    if (timer.timerId) {
        clearTimeout(timer.timerId);
    }
    if (timer.intervalId) {
        clearInterval(timer.intervalId);
    }

    timer.status = 'cancelled';
    activeTimers.delete(sessionId);

    console.log(`[Timer] Cancelled timer for session ${sessionId}`);
}

/**
 * Get remaining time for a session
 */
export function getRemainingTime(sessionId) {
    const timer = activeTimers.get(sessionId);
    if (!timer) return null;

    if (timer.status === 'paused') {
        return timer.remaining;
    }

    if (timer.status === 'running') {
        const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
        return Math.max(0, timer.remaining - elapsed);
    }

    return 0;
}

/**
 * Get timer status
 */
export function getTimerStatus(sessionId) {
    const timer = activeTimers.get(sessionId);
    if (!timer) return null;

    return {
        sessionId: timer.sessionId,
        phaseId: timer.phaseId,
        status: timer.status,
        duration: timer.duration,
        remaining: getRemainingTime(sessionId),
        progressPercent: Math.round(((timer.duration - getRemainingTime(sessionId)) / timer.duration) * 100)
    };
}

/**
 * Add extra time to a running timer
 */
export function addTime(sessionId, extraSeconds) {
    const timer = activeTimers.get(sessionId);
    if (!timer || timer.status === 'expired' || timer.status === 'cancelled') {
        return null;
    }

    // Cancel current timer
    if (timer.timerId) {
        clearTimeout(timer.timerId);
    }

    // Add extra time
    const currentRemaining = getRemainingTime(sessionId);
    timer.remaining = currentRemaining + extraSeconds;
    timer.duration = timer.duration + extraSeconds;
    timer.startTime = Date.now();

    // Restart timer
    timer.timerId = setTimeout(() => {
        timerExpired(sessionId);
    }, timer.remaining * 1000);

    console.log(`[Timer] Added ${extraSeconds}s to session ${sessionId}, new remaining: ${timer.remaining}s`);

    return timer;
}

/**
 * Default handler for timer expiration - transitions phase
 */
export function defaultTimerExpirationHandler(sessionId, phaseId) {
    console.log(`[Timer] Default expiration handler for ${sessionId}, phase ${phaseId}`);

    // Trigger phase transition
    const result = transitionToNextPhase(sessionId, 'timer');

    // Return result for further processing (Vapi orchestration)
    return result;
}

/**
 * Format remaining time as MM:SS
 */
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Export for testing
export { activeTimers };

export default {
    startPhaseTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    getRemainingTime,
    getTimerStatus,
    addTime,
    defaultTimerExpirationHandler,
    formatTime
};
