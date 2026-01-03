/**
 * Interview Phases Configuration
 * 
 * Defines the 5-phase interview structure with durations, Vapi activation,
 * and transition rules based on user commits.
 * 
 * Total Interview: ~22 minutes
 * Total Vapi Time: ~7-9 minutes (65% cost reduction)
 */

export const PHASE_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    SKIPPED: 'skipped'
};

export const TRANSITION_TRIGGER = {
    TIMER: 'timer',           // Automatic after duration expires
    COMMIT: 'commit',         // Triggered by GitHub commit
    MANUAL: 'manual',         // Admin/system triggered
    VAPI_END: 'vapi_end'      // When Vapi call ends naturally
};

/**
 * Phase Definitions
 * 
 * Phase 1 (Kick-off): Vapi ON - Greeting, onboarding, confirm repo ready
 * Phase 2 (Build): Vapi OFF - 10 min focus time, ends on commit or timer
 * Phase 3 (Bug Injection): Vapi ON - Announce live incident, explain bug
 * Phase 4 (Fix): Vapi OFF - Fix the bug, ends on commit or timer
 * Phase 5 (Post-Mortem): Vapi ON - Logic explanation, Q&A, closing
 */
export const PHASES = {
    KICK_OFF: {
        id: 'KICK_OFF',
        name: 'The Kick-off',
        order: 1,
        duration: 2 * 60,  // 2 minutes in seconds
        vapiActive: true,
        assistantType: 'kickoff',
        purpose: 'Agent greets, sets the mission, and confirms the repo is live.',
        transitionTrigger: TRANSITION_TRIGGER.VAPI_END,
        nextPhase: 'BUILD',
        sections: [
            { id: 'greeting', name: 'Welcome & Introduction' },
            { id: 'mission', name: 'Explain the Mission' },
            { id: 'repo_confirm', name: 'Confirm Repo Access' }
        ]
    },

    BUILD: {
        id: 'BUILD',
        name: 'The Build',
        order: 2,
        duration: null, // No timer - commit-driven
        vapiActive: false,
        assistantType: null,
        purpose: 'Focus time for candidate to build the solution.',
        transitionTrigger: TRANSITION_TRIGGER.COMMIT, // Commit-only, no timer fallback
        nextPhase: 'BUG_INJECTION',
        exitMessage: "Take your time to build. Push your code when you're ready, and I'll call you back for the next phase.",
        sections: [
            { id: 'coding', name: 'Implementation Work' }
        ]
    },

    BUG_INJECTION: {
        id: 'BUG_INJECTION',
        name: 'The Bug Injection',
        order: 3,
        duration: 2 * 60,  // 2 minutes in seconds (part of 7-min block with Fix)
        vapiActive: true,
        assistantType: 'bug_injection',
        purpose: 'Vapi calls back to announce a "Live Incident" - a bug has been found.',
        transitionTrigger: TRANSITION_TRIGGER.VAPI_END,
        nextPhase: 'FIX',
        sections: [
            { id: 'incident_alert', name: 'Live Incident Announcement' },
            { id: 'bug_explain', name: 'Explain the Bug' }
        ]
    },

    FIX: {
        id: 'FIX',
        name: 'The Fix',
        order: 4,
        duration: null,  // No timer - commit-driven
        vapiActive: false,
        assistantType: null,
        purpose: 'Candidate works on fixing the bug silently.',
        transitionTrigger: TRANSITION_TRIGGER.COMMIT, // Commit-only, no timer fallback
        nextPhase: 'POST_MORTEM',
        exitMessage: "Take your time to fix this. Push your fix when ready, and I'll call you back for the debrief.",
        sections: [
            { id: 'debugging', name: 'Debug & Fix' }
        ]
    },

    POST_MORTEM: {
        id: 'POST_MORTEM',
        name: 'The Post-Mortem',
        order: 5,
        duration: 4 * 60,  // 3-4 minutes
        vapiActive: true,
        assistantType: 'post_mortem',
        purpose: 'Final logic explanation, Q&A, and closing.',
        transitionTrigger: TRANSITION_TRIGGER.VAPI_END,
        nextPhase: null, // Final phase
        sections: [
            { id: 'logic_review', name: 'Logic Explanation' },
            { id: 'qa', name: 'Candidate Q&A' },
            { id: 'closing', name: 'Closing Remarks' }
        ]
    }
};

// Ordered list of phases for iteration
export const PHASE_ORDER = ['KICK_OFF', 'BUILD', 'BUG_INJECTION', 'FIX', 'POST_MORTEM'];

/**
 * Get phase by ID
 */
export function getPhase(phaseId) {
    return PHASES[phaseId] || null;
}

/**
 * Get next phase
 */
export function getNextPhase(currentPhaseId) {
    const current = PHASES[currentPhaseId];
    return current?.nextPhase ? PHASES[current.nextPhase] : null;
}

/**
 * Check if Vapi should be active for a phase
 */
export function isVapiActiveForPhase(phaseId) {
    return PHASES[phaseId]?.vapiActive === true;
}

/**
 * Get total interview duration (in seconds)
 * Note: Only counts phases with fixed durations (Vapi-active phases)
 * Build and Fix are commit-driven and have no time limit
 */
export function getTotalInterviewDuration() {
    return PHASE_ORDER.reduce((total, phaseId) => {
        const duration = PHASES[phaseId].duration;
        return total + (duration || 0); // Skip null durations
    }, 0);
}

/**
 * Get total Vapi time (in seconds)
 */
export function getTotalVapiTime() {
    return PHASE_ORDER.reduce((total, phaseId) => {
        const phase = PHASES[phaseId];
        return phase.vapiActive ? total + phase.duration : total;
    }, 0);
}

/**
 * Calculate cost savings percentage
 */
export function getCostSavingsPercent() {
    const totalTime = getTotalInterviewDuration();
    const vapiTime = getTotalVapiTime();
    const savings = ((totalTime - vapiTime) / totalTime) * 100;
    return Math.round(savings);
}

/**
 * Get phase configuration summary
 */
export function getPhaseSummary() {
    return PHASE_ORDER.map(phaseId => {
        const phase = PHASES[phaseId];
        return {
            id: phase.id,
            name: phase.name,
            durationMinutes: phase.duration / 60,
            vapiActive: phase.vapiActive,
            trigger: phase.transitionTrigger
        };
    });
}

// Log summary on import (for debugging)
if (typeof window !== 'undefined') {
    console.log('Interview Phases Loaded');
    console.log(`Total Duration: ${getTotalInterviewDuration() / 60} minutes`);
    console.log(`Vapi Active Time: ${getTotalVapiTime() / 60} minutes`);
    console.log(`Cost Savings: ${getCostSavingsPercent()}%`);
}

export default PHASES;
