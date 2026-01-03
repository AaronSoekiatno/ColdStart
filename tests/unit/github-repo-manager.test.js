/**
 * Unit tests for github-repo-manager.js
 * 
 * Tests GitHub API operations with mocked fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env vars
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('github-repo-manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Set up environment variables
        process.env.GITHUB_ACCESS_TOKEN = 'test-token';
        process.env.GITHUB_ORG_NAME = 'test-org';
        process.env.GITHUB_SEED_REPO = 'seed-template';
        process.env.MINERVA_WEBHOOK_URL = 'https://example.com';
        process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
        vi.restoreAllMocks();
    });

    describe('createInterviewRepo()', () => {
        it('should create repo with correct naming convention', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({
                    name: 'interview-candidate-123-2024-01-01',
                    full_name: 'test-org/interview-candidate-123-2024-01-01',
                    html_url: 'https://github.com/test-org/interview-candidate-123-2024-01-01',
                    clone_url: 'https://github.com/test-org/interview-candidate-123-2024-01-01.git',
                    owner: { login: 'test-org' }
                })
            });

            const { createInterviewRepo } = await import('../../lib/github-repo-manager.js');
            const result = await createInterviewRepo('candidate-123', '2024-01-01');

            expect(result.name).toBe('interview-candidate-123-2024-01-01');
            expect(result.owner).toBe('test-org');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/repos/test-org/seed-template/generate');
            expect(options.method).toBe('POST');
            expect(options.headers.Authorization).toBe('token test-token');
        });

        it('should sanitize candidate ID in repo name', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({
                    name: 'interview-john-doe-2024-01-01',
                    full_name: 'test-org/interview-john-doe-2024-01-01',
                    html_url: 'https://github.com/test-org/interview-john-doe-2024-01-01',
                    clone_url: 'https://github.com/test-org/interview-john-doe-2024-01-01.git',
                    owner: { login: 'test-org' }
                })
            });

            const { createInterviewRepo } = await import('../../lib/github-repo-manager.js');
            await createInterviewRepo('John.Doe@email.com', '2024-01-01');

            const [, options] = mockFetch.mock.calls[0];
            const body = JSON.parse(options.body);
            // Name should be lowercase and sanitized
            expect(body.name).toMatch(/^interview-[a-z0-9-]+-2024-01-01$/);
        });

        it('should throw on API error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 422,
                statusText: 'Unprocessable Entity',
                json: async () => ({ message: 'Repository already exists' })
            });

            const { createInterviewRepo } = await import('../../lib/github-repo-manager.js');

            await expect(createInterviewRepo('candidate-123', '2024-01-01'))
                .rejects.toThrow('GitHub API Error 422');
        });
    });

    describe('addCollaborator()', () => {
        it('should add collaborator with push permission', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({})
            });

            const { addCollaborator } = await import('../../lib/github-repo-manager.js');
            const result = await addCollaborator('interview-repo', 'user123');

            expect(result).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/repos/test-org/interview-repo/collaborators/user123');
            expect(options.method).toBe('PUT');

            const body = JSON.parse(options.body);
            expect(body.permission).toBe('push');
        });

        it('should skip if username is not provided', async () => {
            const { addCollaborator } = await import('../../lib/github-repo-manager.js');

            await addCollaborator('interview-repo', null);
            await addCollaborator('interview-repo', undefined);
            await addCollaborator('interview-repo', '');

            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('removeCollaborator()', () => {
        it('should remove collaborator access', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 204
            });

            const { removeCollaborator } = await import('../../lib/github-repo-manager.js');
            const result = await removeCollaborator('interview-repo', 'user123');

            expect(result).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/repos/test-org/interview-repo/collaborators/user123');
            expect(options.method).toBe('DELETE');
        });

        it('should return false on error without throwing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: async () => ({ message: 'Not Found' })
            });

            const { removeCollaborator } = await import('../../lib/github-repo-manager.js');
            const result = await removeCollaborator('interview-repo', 'user123');

            expect(result).toBe(false);
        });
    });

    describe('setupWebhook()', () => {
        it('should configure webhook with correct settings', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: 123 })
            });

            const { setupWebhook } = await import('../../lib/github-repo-manager.js');
            const result = await setupWebhook('interview-repo');

            expect(result).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/repos/test-org/interview-repo/hooks');
            expect(options.method).toBe('POST');

            const body = JSON.parse(options.body);
            expect(body.name).toBe('web');
            expect(body.active).toBe(true);
            expect(body.events).toContain('push');
            expect(body.events).toContain('check_suite');
            expect(body.config.url).toBe('https://example.com/api/webhooks/github');
            expect(body.config.secret).toBe('test-secret');
        });

        it('should return null if webhook URL is not configured', async () => {
            delete process.env.MINERVA_WEBHOOK_URL;

            // Re-import to pick up new env
            vi.resetModules();
            const { setupWebhook } = await import('../../lib/github-repo-manager.js');
            const result = await setupWebhook('interview-repo');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('archiveRepo()', () => {
        it('should archive the repository', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ archived: true })
            });

            const { archiveRepo } = await import('../../lib/github-repo-manager.js');
            const result = await archiveRepo('interview-repo');

            expect(result).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/repos/test-org/interview-repo');
            expect(options.method).toBe('PATCH');

            const body = JSON.parse(options.body);
            expect(body.archived).toBe(true);
        });
    });

    describe('API Authentication', () => {
        it('should include authorization header in all requests', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({})
            });

            const {
                createInterviewRepo,
                addCollaborator,
                setupWebhook,
                archiveRepo
            } = await import('../../lib/github-repo-manager.js');

            // Override mock for create (returns specific structure)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({
                    name: 'test',
                    full_name: 'test-org/test',
                    html_url: 'https://github.com/test-org/test',
                    clone_url: 'https://github.com/test-org/test.git',
                    owner: { login: 'test-org' }
                })
            });

            await createInterviewRepo('test', '2024-01-01');

            mockFetch.mock.calls.forEach(([, options]) => {
                expect(options.headers.Authorization).toBe('token test-token');
            });
        });
    });
});
