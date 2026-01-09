/**
 * Unit tests for vapi-orchestrator.js
 * 
 * Tests the central controller logic: phase transitions, Vapi commands, 
 * and event handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies inline to avoid hoisting issues
vi.mock('../../lib/session-manager.js', () => {
    const mocks = {
        getSession: vi.fn(),
        createSession: vi.fn(),
        updateSession: vi.fn(),
        startInterview: vi.fn(), // Added missing mock
        transitionToNextPhase: vi.fn(),
        recordCommit: vi.fn(),
        recordVapiCall: vi.fn(),
        recordTestResult: vi.fn(),
        getCurrentPhaseInfo: vi.fn(),
        completeInterview: vi.fn(),
        getConversationHistory: vi.fn(),
        storeConversationMessages: vi.fn(),
        getSessionSummary: vi.fn()
    };
    return {
        ...mocks,
        default: mocks
    };
});

vi.mock('../../lib/phase-timer.js', () => ({
    default: {
        startPhaseTimer: vi.fn(),
        pauseTimer: vi.fn(),
        resumeTimer: vi.fn(),
        cancelTimer: vi.fn(),
        addTime: vi.fn(),
        getTimerStatus: vi.fn()
    }
}));

// Fix path to vapi-client (it is in root, not lib)
vi.mock('../../vapi-client.js', () => ({
    default: {
        startPhaseCall: vi.fn(),
        stopCall: vi.fn(),
        isCallActive: vi.fn(),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
        getCallStatus: vi.fn().mockReturnValue({})
    }
}));

vi.mock('../../lib/interview-phases.js', () => ({
    getPhase: vi.fn((id) => ({
        id,
        name: `Phase ${id}`,
        vapiActive: id !== 'BUILD' && id !== 'FIX',
        duration: id === 'BUILD' ? null : 120,
        transitionTrigger: id === 'BUILD' ? 'pass' : (id === 'KICK_OFF' && id !== 'TEST_END' ? 'vapi_end' : 'timer')
    })),
    PHASES: {
        KICK_OFF: 'KICK_OFF',
        BUILD: 'BUILD',
        BUG_INJECTION: 'BUG_INJECTION'
    },
    PHASE_ORDER: ['KICK_OFF', 'BUILD', 'BUG_INJECTION'],
    isVapiActiveForPhase: vi.fn((id) => id !== 'BUILD' && id !== 'FIX')
}));

import sessionManager from '../../lib/session-manager.js';
import timer from '../../lib/phase-timer.js';
import vapiClient from '../../vapi-client.js'; // Fix import path
import { getPhase } from '../../lib/interview-phases.js';
import orchestrator from '../../lib/vapi-orchestrator.js';

describe('Vapi Orchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('startInterview()', () => {
        it('should initialize session and start KICK_OFF', async () => {
            const candidateId = 'user-1';
            const sessionId = 'session-1';

            // Mock session creation
            sessionManager.createSession.mockReturnValue({
                sessionId,
                candidateId
            });

            // Mock startInterview result
            sessionManager.startInterview.mockReturnValue({
                shouldActivateVapi: true,
                phase: 'KICK_OFF',
                session: { sessionId },
                assistantType: 'kickoff'
            });

            await orchestrator.startInterview(candidateId);

            expect(sessionManager.createSession).toHaveBeenCalledWith(candidateId, undefined);
            expect(sessionManager.startInterview).toHaveBeenCalledWith(sessionId);

            // Should start timer for KICK_OFF
            expect(timer.startPhaseTimer).toHaveBeenCalledWith(
                sessionId,
                'KICK_OFF',
                expect.any(Function), // expiration callback
                expect.any(Function)  // tick callback
            );

            // Should start Vapi call
            expect(vapiClient.startPhaseCall).toHaveBeenCalledWith(
                sessionId,
                'KICK_OFF',
                'kickoff',
                []
            );
        });
    });

    describe('transitionPhase()', () => {
        it('should handle transition to Vapi-inactive phase (e.g. BUILD)', async () => {
            const sessionId = 'session-1';

            // Mock transition result
            sessionManager.transitionToNextPhase.mockReturnValue({
                currentPhase: { id: 'BUILD', vapiActive: false, duration: null },
                shouldActivateVapi: false,
                isComplete: false
            });

            // Mock call active
            vapiClient.isCallActive.mockReturnValue(true);

            await orchestrator.transitionPhase(sessionId, 'vapi_end');

            // Should stop any active Vapi call
            expect(vapiClient.stopCall).toHaveBeenCalled();

            // Should NOT start timer for BUILD (null duration)
            expect(timer.startPhaseTimer).not.toHaveBeenCalled();
        });

        it('should handle transition to Vapi-active phase (e.g. BUG_INJECTION)', async () => {
            const sessionId = 'session-1';

            // Mock transition
            sessionManager.transitionToNextPhase.mockReturnValue({
                currentPhase: { id: 'BUG_INJECTION', vapiActive: true, duration: 120, assistantType: 'bug' },
                shouldActivateVapi: true,
                isComplete: false
            });

            sessionManager.getConversationHistory.mockReturnValue([]);

            await orchestrator.transitionPhase(sessionId, 'pass');

            // Should start timer
            expect(timer.startPhaseTimer).toHaveBeenCalledWith(
                sessionId,
                'BUG_INJECTION',
                expect.any(Function),
                expect.any(Function)
            );

            // Should start Vapi call
            expect(vapiClient.startPhaseCall).toHaveBeenCalled();
        });
    });

    describe('handleCommitEvent()', () => {
        it('should record commit and check for transition', async () => {
            const sessionId = 'session-1';
            const commitData = { id: 'abc', message: 'fix' };

            // Mock record commit
            sessionManager.recordCommit.mockResolvedValue({
                shouldTransition: false, // Commit didn't trigger transition
                currentPhase: 'BUILD'
            });

            await orchestrator.handleCommitEvent(sessionId, commitData);

            expect(sessionManager.recordCommit).toHaveBeenCalledWith(sessionId, commitData);
            expect(sessionManager.transitionToNextPhase).not.toHaveBeenCalled();
        });

        it('should transition if commit triggers it', async () => {
            const sessionId = 'session-1';
            const commitData = { id: 'abc', message: 'fix' };

            // Mock record commit returning true
            sessionManager.recordCommit.mockResolvedValue({
                shouldTransition: true,
                currentPhase: 'BUILD'
            });

            // Mock transition
            sessionManager.transitionToNextPhase.mockReturnValue({
                currentPhase: { id: 'BUG_INJECTION', vapiActive: true },
                shouldActivateVapi: true,
                isComplete: false
            });

            sessionManager.getConversationHistory.mockReturnValue([]);

            await orchestrator.handleCommitEvent(sessionId, commitData);

            expect(sessionManager.transitionToNextPhase).toHaveBeenCalled();
        });
    });

    describe('handleVapiCallEnd (via event)', () => {
        it('should transition if call ending triggers next phase', async () => {
            // Setup internal listener capture
            let callEndListener;
            vapiClient.onEvent.mockImplementation((event, cb) => {
                if (event === 'onCallEnd') callEndListener = cb;
            });

            // Initialize to register listener
            orchestrator.initializeOrchestrator();

            expect(callEndListener).toBeDefined();

            const callData = {
                sessionId: 'session-1',
                phaseId: 'KICK_OFF',
                duration: 60,
                messages: []
            };

            // Mock getPhase to return a phase that transitions on vapi_end
            // We need to bypass the mock implementation we set at the top if needed, 
            // but the top mock allows us to control return based on ID.
            // My top mock returns 'vapi_end' trigger for KICK_OFF.
            getPhase.mockReturnValue({
                id: 'KICK_OFF',
                transitionTrigger: 'vapi_end'
            });

            // Mock transition
            sessionManager.transitionToNextPhase.mockReturnValue({
                currentPhase: { id: 'BUILD', vapiActive: false },
                shouldActivateVapi: false,
                isComplete: false
            });

            // Trigger the internal handler
            await callEndListener(callData);

            expect(sessionManager.recordVapiCall).toHaveBeenCalled();
            expect(sessionManager.transitionToNextPhase).toHaveBeenCalledWith('session-1', 'vapi_end');
        });
    });
});
