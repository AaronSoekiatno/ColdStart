/**
 * Interview Phases Configuration
 * 
 * Defines the 3-phase interview structure with durations, Vapi activation,
 * and transition rules based on user commits.
 * 
 * Phase 1: KICK_OFF - Agent greets and explains the challenge
 * Phase 2: BUILD - Candidate builds the solution (ends when tests pass)
 * Phase 3: POST_MORTEM - Candidate reflects on what they did
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
    PASS: 'pass',             // Triggered by GitHub Action Success (Check Suite)
    MANUAL: 'manual',         // Admin/system triggered
    VAPI_END: 'vapi_end'      // When Vapi call ends naturally
};

/**
 * Phase Definitions
 * 
 * Phase 1 (Kick-off): Vapi ON - Greeting, onboarding, confirm repo ready
 * Phase 2 (Build): Vapi OFF - Focus time, ends when tests pass
 * Phase 3 (Post-Mortem): Vapi ON - Candidate reflects on their work
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
        duration: 20 * 60, // 20 minutes in seconds
        vapiActive: false,
        assistantType: null,
        purpose: 'Focus time for candidate to build the solution.',
        transitionTrigger: [TRANSITION_TRIGGER.PASS, TRANSITION_TRIGGER.TIMER], // Ends on test pass OR timer expiry
        nextPhase: 'POST_MORTEM',
        exitMessage: "Great work! Once your tests pass, Minerva will call you back for a reflection.",
        sections: [
            { id: 'coding', name: 'Implementation Work' }
        ]
    },

    POST_MORTEM: {
        id: 'POST_MORTEM',
        name: 'The Post-Mortem',
        order: 3,
        duration: 4 * 60,  // 4 minutes
        vapiActive: true,
        assistantType: 'post_mortem',
        purpose: 'Candidate reflects on their work and decision-making process.',
        transitionTrigger: TRANSITION_TRIGGER.VAPI_END,
        nextPhase: null, // Final phase
        sections: [
            { id: 'logic_review', name: 'Logic Explanation' },
            { id: 'reflection', name: 'Candidate Reflection' },
            { id: 'closing', name: 'Closing Remarks' }
        ]
    }
};

// Ordered list of phases for iteration
export const PHASE_ORDER = ['KICK_OFF', 'BUILD', 'POST_MORTEM'];

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
