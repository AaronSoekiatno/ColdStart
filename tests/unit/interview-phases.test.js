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
        it('should have all 3 phases defined', () => {
            expect(Object.keys(PHASES)).toHaveLength(3);
            expect(PHASES.KICK_OFF).toBeDefined();
            expect(PHASES.BUILD).toBeDefined();
            expect(PHASES.REFLECTION).toBeDefined();
        });

        it('should have correct order values', () => {
            expect(PHASES.KICK_OFF.order).toBe(1);
            expect(PHASES.BUILD.order).toBe(2);
            expect(PHASES.REFLECTION.order).toBe(3);
        });

        it('should have correct nextPhase chain', () => {
            expect(PHASES.KICK_OFF.nextPhase).toBe('BUILD');
            expect(PHASES.BUILD.nextPhase).toBe('REFLECTION');
            expect(PHASES.REFLECTION.nextPhase).toBeNull();
        });
    });

    describe('PHASE_ORDER', () => {
        it('should contain all phases in correct order', () => {
            expect(PHASE_ORDER).toEqual([
                'KICK_OFF',
                'BUILD',
                'REFLECTION'
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
            expect(build.duration).toBe(60);
            expect(build.transitionTrigger).toContain(TRANSITION_TRIGGER.PASS);
        });
    });

    describe('getNextPhase()', () => {
        it('should return next phase in sequence', () => {
            const nextAfterKickoff = getNextPhase('KICK_OFF');
            expect(nextAfterKickoff.id).toBe('BUILD');

            const nextAfterBuild = getNextPhase('BUILD');
            expect(nextAfterBuild.id).toBe('REFLECTION');
        });

        it('should return null for final phase', () => {
            expect(getNextPhase('REFLECTION')).toBeNull();
        });

        it('should return null for invalid phase', () => {
            expect(getNextPhase('INVALID')).toBeNull();
        });
    });

    describe('isVapiActiveForPhase()', () => {
        it('should return true for Vapi-active phases', () => {
            expect(isVapiActiveForPhase('KICK_OFF')).toBe(true);
            expect(isVapiActiveForPhase('REFLECTION')).toBe(true);
        });

        it('should return false for silent phases', () => {
            expect(isVapiActiveForPhase('BUILD')).toBe(false);
        });

        it('should return falsy for invalid phase', () => {
            expect(isVapiActiveForPhase('INVALID')).toBeFalsy();
        });
    });

    describe('getTotalInterviewDuration()', () => {
        it('should calculate total duration from all phases', () => {
            // KICK_OFF: 2min, BUILD: 1min, REFLECTION: 4min
            // Total: 7 minutes = 420 seconds
            const total = getTotalInterviewDuration();
            expect(total).toBe(420); // 7 minutes in seconds
        });
    });

    describe('getTotalVapiTime()', () => {
        it('should calculate total Vapi time correctly', () => {
            // Only Vapi-active phases: KICK_OFF (2min), REFLECTION (4min)
            // Total: 6 minutes = 360 seconds
            const vapiTime = getTotalVapiTime();
            expect(vapiTime).toBe(360);
        });
    });

    describe('getCostSavingsPercent()', () => {
        it('should calculate cost savings percentage', () => {
            const savings = getCostSavingsPercent();
            // Total = 420s, Vapi = 360s
            // Savings = (420 - 360) / 420 = 60 / 420 = 14.28% -> 14%
            expect(savings).toBe(14);
        });
    });

    describe('getPhaseSummary()', () => {
        it('should return array of phase summaries', () => {
            const summary = getPhaseSummary();
            expect(summary).toHaveLength(3);
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

        it('should handle BUILD phase duration', () => {
            const summary = getPhaseSummary();
            const build = summary.find(p => p.id === 'BUILD');
            expect(build.durationMinutes).toBe(1);
        });
    });
});
