/**
 * Unit tests for interview-phases.js
 * 
 * Tests core domain logic for interview phase configuration.
 */

import { describe, it, expect } from 'vitest';
import {
    PHASES,
    PHASE_ORDER,
    PHASE_STATUS,
    TRANSITION_TRIGGER,
    getPhase,
    getNextPhase,
    isVapiActiveForPhase,
    getTotalInterviewDuration,
    getTotalVapiTime,
    getCostSavingsPercent,
    getPhaseSummary
} from '../../lib/interview-phases.js';

describe('interview-phases', () => {
    describe('PHASES constant', () => {
        it('should have all 5 phases defined', () => {
            expect(Object.keys(PHASES)).toHaveLength(5);
            expect(PHASES.KICK_OFF).toBeDefined();
            expect(PHASES.BUILD).toBeDefined();
            expect(PHASES.BUG_INJECTION).toBeDefined();
            expect(PHASES.FIX).toBeDefined();
            expect(PHASES.POST_MORTEM).toBeDefined();
        });

        it('should have correct order values', () => {
            expect(PHASES.KICK_OFF.order).toBe(1);
            expect(PHASES.BUILD.order).toBe(2);
            expect(PHASES.BUG_INJECTION.order).toBe(3);
            expect(PHASES.FIX.order).toBe(4);
            expect(PHASES.POST_MORTEM.order).toBe(5);
        });

        it('should have correct nextPhase chain', () => {
            expect(PHASES.KICK_OFF.nextPhase).toBe('BUILD');
            expect(PHASES.BUILD.nextPhase).toBe('BUG_INJECTION');
            expect(PHASES.BUG_INJECTION.nextPhase).toBe('FIX');
            expect(PHASES.FIX.nextPhase).toBe('POST_MORTEM');
            expect(PHASES.POST_MORTEM.nextPhase).toBeNull();
        });
    });

    describe('PHASE_ORDER', () => {
        it('should contain all phases in correct order', () => {
            expect(PHASE_ORDER).toEqual([
                'KICK_OFF',
                'BUILD',
                'BUG_INJECTION',
                'FIX',
                'POST_MORTEM'
            ]);
        });
    });

    describe('PHASE_STATUS enum', () => {
        it('should have all status values', () => {
            expect(PHASE_STATUS.PENDING).toBe('pending');
            expect(PHASE_STATUS.ACTIVE).toBe('active');
            expect(PHASE_STATUS.COMPLETED).toBe('completed');
            expect(PHASE_STATUS.SKIPPED).toBe('skipped');
        });
    });

    describe('TRANSITION_TRIGGER enum', () => {
        it('should have all trigger types', () => {
            expect(TRANSITION_TRIGGER.TIMER).toBe('timer');
            expect(TRANSITION_TRIGGER.COMMIT).toBe('commit');
            expect(TRANSITION_TRIGGER.PASS).toBe('pass');
            expect(TRANSITION_TRIGGER.MANUAL).toBe('manual');
            expect(TRANSITION_TRIGGER.VAPI_END).toBe('vapi_end');
        });
    });

    describe('getPhase()', () => {
        it('should return phase for valid ID', () => {
            const phase = getPhase('KICK_OFF');
            expect(phase).toBeDefined();
            expect(phase.id).toBe('KICK_OFF');
            expect(phase.name).toBe('The Kick-off');
        });

        it('should return null for invalid ID', () => {
            expect(getPhase('INVALID')).toBeNull();
            expect(getPhase(null)).toBeNull();
            expect(getPhase(undefined)).toBeNull();
        });

        it('should return correct phase properties', () => {
            const build = getPhase('BUILD');
            expect(build.vapiActive).toBe(false);
            expect(build.duration).toBeNull();
            expect(build.transitionTrigger).toBe(TRANSITION_TRIGGER.PASS);
        });
    });

    describe('getNextPhase()', () => {
        it('should return next phase in sequence', () => {
            const nextAfterKickoff = getNextPhase('KICK_OFF');
            expect(nextAfterKickoff.id).toBe('BUILD');

            const nextAfterBuild = getNextPhase('BUILD');
            expect(nextAfterBuild.id).toBe('BUG_INJECTION');
        });

        it('should return null for final phase', () => {
            expect(getNextPhase('POST_MORTEM')).toBeNull();
        });

        it('should return null for invalid phase', () => {
            expect(getNextPhase('INVALID')).toBeNull();
        });
    });

    describe('isVapiActiveForPhase()', () => {
        it('should return true for Vapi-active phases', () => {
            expect(isVapiActiveForPhase('KICK_OFF')).toBe(true);
            expect(isVapiActiveForPhase('BUG_INJECTION')).toBe(true);
            expect(isVapiActiveForPhase('POST_MORTEM')).toBe(true);
        });

        it('should return false for silent phases', () => {
            expect(isVapiActiveForPhase('BUILD')).toBe(false);
            expect(isVapiActiveForPhase('FIX')).toBe(false);
        });

        it('should return falsy for invalid phase', () => {
            expect(isVapiActiveForPhase('INVALID')).toBeFalsy();
        });
    });

    describe('getTotalInterviewDuration()', () => {
        it('should calculate total duration from phases with durations', () => {
            // KICK_OFF: 2min, BUILD: null, BUG_INJECTION: 2min, FIX: null, POST_MORTEM: 4min
            // Total: 8 minutes = 480 seconds
            const total = getTotalInterviewDuration();
            expect(total).toBe(480); // 8 minutes in seconds
        });

        it('should skip phases with null duration', () => {
            // BUILD and FIX have null duration
            const total = getTotalInterviewDuration();
            const kickoff = PHASES.KICK_OFF.duration;
            const bugInjection = PHASES.BUG_INJECTION.duration;
            const postMortem = PHASES.POST_MORTEM.duration;
            expect(total).toBe(kickoff + bugInjection + postMortem);
        });
    });

    describe('getTotalVapiTime()', () => {
        it('should calculate total Vapi time correctly', () => {
            // Only Vapi-active phases: KICK_OFF (2min), BUG_INJECTION (2min), POST_MORTEM (4min)
            const vapiTime = getTotalVapiTime();
            expect(vapiTime).toBe(480); // 8 minutes
        });
    });

    describe('getCostSavingsPercent()', () => {
        it('should calculate cost savings percentage', () => {
            const savings = getCostSavingsPercent();
            // Since BUILD and FIX have no duration, total = vapi time = 0% savings
            expect(savings).toBe(0);
        });
    });

    describe('getPhaseSummary()', () => {
        it('should return array of phase summaries', () => {
            const summary = getPhaseSummary();
            expect(summary).toHaveLength(5);
        });

        it('should include correct properties', () => {
            const summary = getPhaseSummary();
            const kickoff = summary[0];

            expect(kickoff).toHaveProperty('id', 'KICK_OFF');
            expect(kickoff).toHaveProperty('name', 'The Kick-off');
            expect(kickoff).toHaveProperty('durationMinutes', 2);
            expect(kickoff).toHaveProperty('vapiActive', true);
            expect(kickoff).toHaveProperty('trigger', TRANSITION_TRIGGER.VAPI_END);
        });

        it('should handle null duration phases', () => {
            const summary = getPhaseSummary();
            const build = summary.find(p => p.id === 'BUILD');
            expect(build.durationMinutes).toBe(0);
        });
    });
});
