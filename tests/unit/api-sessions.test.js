/**
 * Unit tests for Session API endpoints
 * 
 * Tests /api/sessions (POST) and /api/sessions/[sessionId] (GET)
 * using node-mocks-http to simulate Next.js request/response objects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';

// Mock session-manager dependencies
vi.mock('../../lib/session-manager.js', () => ({
    createSession: vi.fn(),
    getSession: vi.fn()
}));

import { createSession, getSession } from '../../lib/session-manager.js';

// Import handlers (using dynamic import in tests to ensure mocks applied)
const importHandlers = async () => {
    const createHandler = (await import('../../pages/api/sessions/index.js')).default;
    const getHandler = (await import('../../pages/api/sessions/[sessionId].js')).default;
    return { createHandler, getHandler };
};

describe('Session API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/sessions', () => {
        it('should create a new session', async () => {
            const { createHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    candidateId: 'test-candidate',
                    candidateName: 'Test User'
                }
            });

            // Mock successful creation
            createSession.mockResolvedValue({
                sessionId: 'session-123',
                candidateId: 'test-candidate',
                status: 'pending'
            });

            await createHandler(req, res);

            expect(res._getStatusCode()).toBe(201);
            expect(JSON.parse(res._getData())).toEqual({
                sessionId: 'session-123',
                candidateId: 'test-candidate',
                status: 'pending'
            });
            expect(createSession).toHaveBeenCalledWith('test-candidate', { name: 'Test User' });
        });

        it('should return 400 if candidateId is missing', async () => {
            const { createHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    candidateName: 'Test User'
                }
            });

            await createHandler(req, res);

            expect(res._getStatusCode()).toBe(400);
            expect(JSON.parse(res._getData())).toHaveProperty('error');
            expect(createSession).not.toHaveBeenCalled();
        });

        it('should return 405 for non-POST methods', async () => {
            const { createHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'GET'
            });

            await createHandler(req, res);

            expect(res._getStatusCode()).toBe(405);
        });

        it('should handle internal errors', async () => {
            const { createHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'POST',
                body: { candidateId: 'test' }
            });

            createSession.mockRejectedValue(new Error('Database error'));

            await createHandler(req, res);

            expect(res._getStatusCode()).toBe(500);
            expect(JSON.parse(res._getData())).toHaveProperty('error', 'Internal Server Error');
        });
    });

    describe('GET /api/sessions/[sessionId]', () => {
        it('should return session data', async () => {
            const { getHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'GET',
                query: {
                    sessionId: 'session-123'
                }
            });

            // Mock successful retrieval
            getSession.mockResolvedValue({
                sessionId: 'session-123',
                status: 'active',
                currentPhase: 'KICK_OFF'
            });

            await getHandler(req, res);

            expect(res._getStatusCode()).toBe(200);
            expect(JSON.parse(res._getData())).toEqual({
                sessionId: 'session-123',
                status: 'active',
                currentPhase: 'KICK_OFF'
            });
            expect(getSession).toHaveBeenCalledWith('session-123');
        });

        it('should return 404 if session not found', async () => {
            const { getHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'GET',
                query: {
                    sessionId: 'non-existent'
                }
            });

            getSession.mockResolvedValue(null);

            await getHandler(req, res);

            expect(res._getStatusCode()).toBe(404);
        });

        it('should return 400 if sessionId is missing', async () => {
            const { getHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'GET',
                query: {} // No sessionId
            });

            await getHandler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });

        it('should return 405 for non-GET methods', async () => {
            const { getHandler } = await importHandlers();
            const { req, res } = createMocks({
                method: 'POST'
            });

            await getHandler(req, res);

            expect(res._getStatusCode()).toBe(405);
        });
    });
});
