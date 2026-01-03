/**
 * Unit tests for phase-timer.js
 * 
 * Tests timer operations using Vitest fake timers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing phase-timer
vi.mock('../../lib/supabase-client.js', () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
    },
    TABLES: { SESSIONS: 'interview_sessions' }
}));

vi.mock('../../lib/session-cache.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('../../lib/session-manager.js', () => ({
    transitionToNextPhase: vi.fn(),
    getCurrentPhaseInfo: vi.fn()
}));

import {
    startPhaseTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    getRemainingTime,
    getTimerStatus,
    addTime,
    formatTime,
    activeTimers
} from '../../lib/phase-timer.js';

describe('phase-timer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Clear any existing timers
        activeTimers.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        activeTimers.clear();
    });

    describe('formatTime()', () => {
        it('should format seconds as MM:SS', () => {
            expect(formatTime(0)).toBe('00:00');
            expect(formatTime(30)).toBe('00:30');
            expect(formatTime(60)).toBe('01:00');
            expect(formatTime(90)).toBe('01:30');
            expect(formatTime(120)).toBe('02:00');
            expect(formatTime(3600)).toBe('60:00');
        });

        it('should handle single digit seconds with padding', () => {
            expect(formatTime(5)).toBe('00:05');
            expect(formatTime(65)).toBe('01:05');
        });
    });

    describe('startPhaseTimer()', () => {
        it('should create timer for phase with duration', () => {
            const onExpire = vi.fn();
            const timer = startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            expect(timer).not.toBeNull();
            expect(timer.sessionId).toBe('test-session');
            expect(timer.phaseId).toBe('KICK_OFF');
            expect(timer.status).toBe('running');
            expect(timer.duration).toBe(120); // KICK_OFF is 2 minutes
        });

        it('should return null for commit-driven phases', () => {
            const onExpire = vi.fn();
            const timer = startPhaseTimer('test-session', 'BUILD', onExpire);

            expect(timer).toBeNull();
        });

        it('should throw for invalid phase', () => {
            const onExpire = vi.fn();
            expect(() => startPhaseTimer('test-session', 'INVALID', onExpire))
                .toThrow('Unknown phase: INVALID');
        });

        it('should cancel existing timer for same session', () => {
            const onExpire = vi.fn();
            const timer1 = startPhaseTimer('test-session', 'KICK_OFF', onExpire);
            const timer2 = startPhaseTimer('test-session', 'BUG_INJECTION', onExpire);

            expect(timer2.phaseId).toBe('BUG_INJECTION');
            expect(activeTimers.size).toBe(1);
        });

        it('should call onExpire when timer expires', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            // Advance time by 2 minutes (KICK_OFF duration)
            vi.advanceTimersByTime(120 * 1000);

            expect(onExpire).toHaveBeenCalledWith('test-session', 'KICK_OFF');
        });

        it('should call onTick callback every second', () => {
            const onExpire = vi.fn();
            const onTick = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire, onTick);

            vi.advanceTimersByTime(3000); // 3 seconds

            expect(onTick).toHaveBeenCalledTimes(3);
        });
    });

    describe('pauseTimer()', () => {
        it('should pause a running timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            // Advance 30 seconds
            vi.advanceTimersByTime(30000);

            const paused = pauseTimer('test-session');

            expect(paused.status).toBe('paused');
            expect(paused.remaining).toBe(90); // 120 - 30 = 90
        });

        it('should return null for non-existent timer', () => {
            expect(pauseTimer('non-existent')).toBeNull();
        });

        it('should prevent timer expiration while paused', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(30000);
            pauseTimer('test-session');

            // Advance past original expiration
            vi.advanceTimersByTime(120000);

            expect(onExpire).not.toHaveBeenCalled();
        });
    });

    describe('resumeTimer()', () => {
        it('should resume a paused timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(30000);
            pauseTimer('test-session');

            const resumed = resumeTimer('test-session');

            expect(resumed.status).toBe('running');
            expect(resumed.remaining).toBe(90);
        });

        it('should return null for non-paused timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            expect(resumeTimer('test-session')).toBeNull();
        });

        it('should expire at correct time after resume', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(30000); // 30s elapsed
            pauseTimer('test-session');

            resumeTimer('test-session');
            vi.advanceTimersByTime(90000); // 90s remaining

            expect(onExpire).toHaveBeenCalled();
        });
    });

    describe('cancelTimer()', () => {
        it('should cancel an active timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            cancelTimer('test-session');

            expect(activeTimers.has('test-session')).toBe(false);
        });

        it('should prevent expiration callback', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            cancelTimer('test-session');
            vi.advanceTimersByTime(120000);

            expect(onExpire).not.toHaveBeenCalled();
        });

        it('should handle non-existent session gracefully', () => {
            expect(() => cancelTimer('non-existent')).not.toThrow();
        });
    });

    describe('getRemainingTime()', () => {
        it('should return remaining time for running timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(30000);

            expect(getRemainingTime('test-session')).toBe(90);
        });

        it('should return remaining time for paused timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(30000);
            pauseTimer('test-session');

            // Advance more time while paused
            vi.advanceTimersByTime(60000);

            expect(getRemainingTime('test-session')).toBe(90);
        });

        it('should return null for non-existent timer', () => {
            expect(getRemainingTime('non-existent')).toBeNull();
        });
    });

    describe('getTimerStatus()', () => {
        it('should return complete status object', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(60000); // 50% complete

            const status = getTimerStatus('test-session');

            expect(status).toEqual({
                sessionId: 'test-session',
                phaseId: 'KICK_OFF',
                status: 'running',
                duration: 120,
                remaining: 60,
                progressPercent: 50
            });
        });

        it('should return null for non-existent session', () => {
            expect(getTimerStatus('non-existent')).toBeNull();
        });
    });

    describe('addTime()', () => {
        it('should add extra time to running timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(60000); // 60s remaining

            addTime('test-session', 30);

            expect(getRemainingTime('test-session')).toBe(90); // 60 + 30
        });

        it('should return null for expired timer', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(120000); // Expire

            expect(addTime('test-session', 30)).toBeNull();
        });

        it('should delay expiration correctly', () => {
            const onExpire = vi.fn();
            startPhaseTimer('test-session', 'KICK_OFF', onExpire);

            vi.advanceTimersByTime(100000); // 20s remaining
            addTime('test-session', 60); // Add 60s

            vi.advanceTimersByTime(70000); // 70s later
            expect(onExpire).not.toHaveBeenCalled();

            vi.advanceTimersByTime(20000); // 10s more (total 90s > 80s remaining)
            expect(onExpire).toHaveBeenCalled();
        });
    });
});
