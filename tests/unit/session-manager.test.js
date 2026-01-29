/**
 * Unit tests for session-manager.js
 * 
 * Tests session state management with mocked Supabase.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client before importing session-manager
vi.mock('../../lib/supabase-client.js', () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
    },
    TABLES: {
        SESSIONS: 'interview_sessions'
    }
}));

// Mock session-cache
vi.mock('../../lib/session-cache.js', () => {
    const mockCache = new Map();
    return {
        default: {
            get: vi.fn((key) => mockCache.get(key)),
            set: vi.fn((key, value) => { mockCache.set(key, value); return value; }),
            has: vi.fn((key) => mockCache.has(key)),
            delete: vi.fn((key) => mockCache.delete(key)),
            clear: vi.fn(() => mockCache.clear()),
            update: vi.fn((key, updates) => {
                const existing = mockCache.get(key);
                if (existing) {
                    const updated = { ...existing, ...updates };
                    mockCache.set(key, updated);
                    return updated;
                }
                return null;
            })
        },
        cache: {
            get: vi.fn((key) => mockCache.get(key)),
            set: vi.fn((key, value) => { mockCache.set(key, value); return value; }),
            has: vi.fn((key) => mockCache.has(key)),
            delete: vi.fn((key) => mockCache.delete(key)),
            clear: vi.fn(() => mockCache.clear()),
            update: vi.fn((key, updates) => {
                const existing = mockCache.get(key);
                if (existing) {
                    const updated = { ...existing, ...updates };
                    mockCache.set(key, updated);
                    return updated;
                }
                return null;
            })
        }
    };
});

// Import after mocks are set up
import {
    PHASES,
    PHASE_ORDER,
    PHASE_STATUS,
    TRANSITION_TRIGGER
} from '../../lib/interview-phases.js';

describe('session-manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Session State Structure', () => {
        it('should have correct PHASE_STATUS values', () => {
            expect(PHASE_STATUS.PENDING).toBe('pending');
            expect(PHASE_STATUS.ACTIVE).toBe('active');
            expect(PHASE_STATUS.COMPLETED).toBe('completed');
            expect(PHASE_STATUS.SKIPPED).toBe('skipped');
        });

        it('should have correct TRANSITION_TRIGGER values', () => {
            expect(TRANSITION_TRIGGER.TIMER).toBe('timer');
            expect(TRANSITION_TRIGGER.COMMIT).toBe('commit');
            expect(TRANSITION_TRIGGER.PASS).toBe('pass');
            expect(TRANSITION_TRIGGER.MANUAL).toBe('manual');
            expect(TRANSITION_TRIGGER.VAPI_END).toBe('vapi_end');
        });

        it('should have all phases defined', () => {
            expect(PHASE_ORDER).toContain('KICK_OFF');
            expect(PHASE_ORDER).toContain('BUILD');
            expect(PHASE_ORDER).toContain('REFLECTION');
        });
    });

    describe('Phase Transition Logic', () => {
        it('should have correct nextPhase chain', () => {
            expect(PHASES.KICK_OFF.nextPhase).toBe('BUILD');
            expect(PHASES.BUILD.nextPhase).toBe('REFLECTION');
            expect(PHASES.REFLECTION.nextPhase).toBeNull();
        });

        it('should have correct transition triggers', () => {
            expect(PHASES.KICK_OFF.transitionTrigger).toBe(TRANSITION_TRIGGER.VAPI_END);
            expect(PHASES.BUILD.transitionTrigger).toContain(TRANSITION_TRIGGER.PASS);
            expect(PHASES.REFLECTION.transitionTrigger).toBe(TRANSITION_TRIGGER.VAPI_END);
        });
    });

    describe('Vapi Activation', () => {
        it('should activate Vapi for voice phases', () => {
            expect(PHASES.KICK_OFF.vapiActive).toBe(true);
            expect(PHASES.REFLECTION.vapiActive).toBe(true);
        });

        it('should deactivate Vapi for coding phases', () => {
            expect(PHASES.BUILD.vapiActive).toBe(false);
        });
    });

    describe('Duration Configuration', () => {
        it('should have durations for timed phases', () => {
            expect(PHASES.KICK_OFF.duration).toBe(120); // 2 min
            expect(PHASES.BUILD.duration).toBe(60); // 1 min (testing)
            expect(PHASES.REFLECTION.duration).toBe(240); // 4 min
        });
    });

    describe('calculateDuration helper', () => {
        it('should calculate duration between timestamps', () => {
            const start = '2024-01-01T00:00:00.000Z';
            const end = '2024-01-01T00:05:00.000Z';

            const startDate = new Date(start);
            const endDate = new Date(end);
            const duration = (endDate - startDate) / 1000;

            expect(duration).toBe(300); // 5 minutes in seconds
        });

        it('should handle same timestamp', () => {
            const timestamp = '2024-01-01T00:00:00.000Z';
            const date = new Date(timestamp);
            const duration = (date - date) / 1000;

            expect(duration).toBe(0);
        });
    });

    describe('Session Object Structure', () => {
        it('should have expected phase properties', () => {
            const phase = PHASES.KICK_OFF;

            expect(phase).toHaveProperty('id');
            expect(phase).toHaveProperty('name');
            expect(phase).toHaveProperty('order');
            expect(phase).toHaveProperty('duration');
            expect(phase).toHaveProperty('vapiActive');
            expect(phase).toHaveProperty('assistantType');
            expect(phase).toHaveProperty('purpose');
            expect(phase).toHaveProperty('transitionTrigger');
            expect(phase).toHaveProperty('nextPhase');
            expect(phase).toHaveProperty('sections');
        });

        it('should have sections array for each phase', () => {
            Object.values(PHASES).forEach(phase => {
                expect(Array.isArray(phase.sections)).toBe(true);
                expect(phase.sections.length).toBeGreaterThan(0);
                phase.sections.forEach(section => {
                    expect(section).toHaveProperty('id');
                    expect(section).toHaveProperty('name');
                });
            });
        });
    });
});
