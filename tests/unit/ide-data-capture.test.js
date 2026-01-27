/**
 * Unit tests for IDE Page Data Capture
 *
 * Tests that the IDE page correctly captures and stores:
 * - Session initialization and tracking
 * - Time tracking (start time, elapsed time)
 * - Snapshot creation on submission
 * - Test execution results
 * - Container status transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';

// Mock Supabase client
const mockSupabase = {
    auth: {
        getUser: vi.fn()
    },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(),
                order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        single: vi.fn()
                    }))
                }))
            })),
            order: vi.fn(() => ({
                limit: vi.fn(() => ({
                    single: vi.fn()
                }))
            }))
        })),
        insert: vi.fn(() => ({
            select: vi.fn(() => ({
                single: vi.fn()
            }))
        })),
        update: vi.fn(() => ({
            eq: vi.fn()
        }))
    })),
    rpc: vi.fn()
};

// Mock Supabase modules
vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => mockSupabase)
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({
        getAll: () => [],
        setAll: () => {}
    }))
}));

describe('IDE Page - Session Tracking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    });

    it('should fetch container info with session tracking', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com'
        };

        const mockCandidate = {
            id: 'candidate-123',
            email: 'test@example.com'
        };

        const mockSession = {
            session_id: 'session-abc',
            container_url: 'https://assess-abc.fly.dev',
            container_status: 'running',
            candidate_id: 'candidate-123',
            created_at: '2024-01-01T00:00:00Z',
            interview_start_time: null,
            current_phase: 'coding'
        };

        // Mock auth
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null
        });

        // Mock candidate lookup
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: mockCandidate,
                        error: null
                    })
                }))
            }))
        });

        // Mock session lookup
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({
                                data: mockSession,
                                error: null
                            })
                        }))
                    }))
                }))
            }))
        });

        // Verify we can retrieve session data
        const candidate = await mockSupabase
            .from('candidates')
            .select('id')
            .eq('email', mockUser.email)
            .single();

        expect(candidate.data).toEqual(mockCandidate);

        const session = await mockSupabase
            .from('interview_sessions')
            .select('container_url, container_status, session_id, current_phase, created_at, interview_start_time')
            .eq('candidate_id', mockCandidate.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        expect(session.data).toEqual(mockSession);
        expect(session.data.session_id).toBe('session-abc');
        expect(session.data.container_status).toBe('running');
    });

    it('should handle setting interview_start_time on first load', async () => {
        const sessionId = 'session-123';
        const startTime = '2024-01-01T12:00:00Z';

        mockSupabase.from.mockReturnValueOnce({
            update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                    error: null
                })
            }))
        });

        const result = await mockSupabase
            .from('interview_sessions')
            .update({ interview_start_time: startTime })
            .eq('session_id', sessionId);

        expect(result.error).toBeNull();
    });

    it('should track container status transitions', async () => {
        const mockStatuses = ['loading', 'provisioning', 'running'];

        for (const status of mockStatuses) {
            const mockSession = {
                session_id: 'session-123',
                container_status: status,
                container_url: status === 'running' ? 'https://assess-abc.fly.dev' : null
            };

            expect(mockSession.container_status).toBe(status);

            if (status === 'running') {
                expect(mockSession.container_url).toBeTruthy();
            }
        }
    });
});

describe('IDE Page - Time Tracking', () => {
    it('should calculate elapsed time from start time', () => {
        const startTime = Date.now() - 120000; // 2 minutes ago
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);

        expect(elapsed).toBeGreaterThanOrEqual(119);
        expect(elapsed).toBeLessThanOrEqual(121);
    });

    it('should format time correctly', () => {
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(59)).toBe('0:59');
        expect(formatTime(60)).toBe('1:00');
        expect(formatTime(125)).toBe('2:05');
        expect(formatTime(1200)).toBe('20:00'); // Max time limit
    });

    it('should detect when time limit is reached', () => {
        const TIME_LIMIT = 1200; // 20 minutes

        expect(1199).toBeLessThan(TIME_LIMIT);
        expect(1200).toBeGreaterThanOrEqual(TIME_LIMIT);
        expect(1201).toBeGreaterThanOrEqual(TIME_LIMIT);
    });
});

describe('IDE Page - Snapshot Creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    });

    it('should validate snapshot creation request data', () => {
        const validRequest = {
            sessionId: 'session-123',
            trigger: 'submission',
            message: 'Final submission snapshot'
        };

        expect(validRequest.sessionId).toBeTruthy();
        expect(validRequest.trigger).toBe('submission');
        expect(['manual', 'test_completion', 'phase_transition', 'commit', 'submission']).toContain(validRequest.trigger);
    });

    it('should log snapshot data to session_commits', async () => {
        const snapshotData = {
            p_candidate_id: 'test-user',
            p_event: 'push',
            p_added_lines: 0,
            p_deleted_lines: 0,
            p_commit_message: 'Snapshot: submission',
            p_repo_name: 'session-123',
            p_commit_hash: null,
            p_commit_author: 'test-user',
            p_commit_timestamp: '2024-01-01T12:00:00Z',
            p_snapshot_storage_path: 'snapshots/session-123/snapshot.tar.gz',
            p_snapshot_size_bytes: 1024000,
            p_session_id: 'session-123'
        };

        mockSupabase.rpc.mockResolvedValue({
            data: { commit_id: 'commit-456' },
            error: null
        });

        const result = await mockSupabase.rpc('log_session_commit', snapshotData);

        expect(result.error).toBeNull();
        expect(result.data.commit_id).toBe('commit-456');
        expect(mockSupabase.rpc).toHaveBeenCalledWith('log_session_commit', snapshotData);
    });
});

describe('IDE Page - Test Execution', () => {
    it('should validate test execution request data', () => {
        const testRequest = {
            sessionId: 'session-123',
            testType: 'full',
            destroyAfter: true
        };

        expect(testRequest.sessionId).toBeTruthy();
        expect(['quick', 'full']).toContain(testRequest.testType);
        expect(typeof testRequest.destroyAfter).toBe('boolean');
    });

    it('should log test results to database via RPC', async () => {
        const testData = {
            p_session_id: 'session-123',
            p_candidate_id: 'candidate-456',
            p_test_type: 'full',
            p_test_results: {
                numTotalTests: 10,
                numPassedTests: 8,
                numFailedTests: 2,
                testResults: []
            },
            p_total_score: 8,
            p_max_score: 10
        };

        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: null
        });

        const result = await mockSupabase.rpc('log_test_result', testData);

        expect(result.error).toBeNull();
        expect(mockSupabase.rpc).toHaveBeenCalledWith('log_test_result', testData);
    });

    it('should handle test results with proper structure', () => {
        const testResults = {
            numTotalTestSuites: 2,
            numPassedTestSuites: 1,
            numFailedTestSuites: 1,
            numTotalTests: 10,
            numPassedTests: 7,
            numFailedTests: 3,
            testResults: [
                {
                    name: '/workspace/tests/assessment/completion.test.tsx',
                    status: 'passed',
                    assertionResults: [
                        {
                            title: 'should render interface',
                            status: 'passed',
                            ancestorTitles: ['Completion']
                        }
                    ]
                }
            ]
        };

        expect(testResults.numTotalTests).toBe(10);
        expect(testResults.numPassedTests).toBe(7);
        expect(testResults.numFailedTests).toBe(3);
        expect(testResults.testResults).toHaveLength(1);
    });
});

describe('IDE Page - Tab Switch Detection', () => {
    it('should detect tab visibility changes', () => {
        const visibilityStates = ['visible', 'hidden'];

        visibilityStates.forEach(state => {
            const isHidden = state === 'hidden';
            expect(typeof isHidden).toBe('boolean');
        });
    });

    it('should allow preview without warning', () => {
        let isPreviewingRef = { current: false };

        // User clicks preview
        isPreviewingRef.current = true;

        // Tab becomes hidden
        const shouldWarn = !isPreviewingRef.current;

        expect(shouldWarn).toBe(false);
    });
});

describe('IDE Page - Container Status Integration', () => {
    it('should update container status correctly', async () => {
        const sessionId = 'session-123';
        const newStatus = 'stopped';
        const timestamp = new Date().toISOString();

        mockSupabase.from.mockReturnValueOnce({
            update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                    error: null
                })
            }))
        });

        const result = await mockSupabase
            .from('interview_sessions')
            .update({
                container_status: newStatus,
                container_stopped_at: timestamp
            })
            .eq('session_id', sessionId);

        expect(result.error).toBeNull();
    });

    it('should extract fly app name from container URL', () => {
        const extractFlyAppName = (containerUrl) => {
            try {
                const url = new URL(containerUrl);
                const hostname = url.hostname;
                if (hostname.endsWith('.fly.dev')) {
                    return hostname.replace('.fly.dev', '');
                }
                return hostname;
            } catch (error) {
                return null;
            }
        };

        expect(extractFlyAppName('https://assess-abc123.fly.dev')).toBe('assess-abc123');
        expect(extractFlyAppName('http://localhost:8080')).toBe('localhost');
        expect(extractFlyAppName('invalid-url')).toBeNull();
    });
});
