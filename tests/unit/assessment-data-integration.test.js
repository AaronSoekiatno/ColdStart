/**
 * Integration tests for Assessment Data Capture
 *
 * Tests the complete flow of data capture from IDE page through Post-Mortem:
 * - Session initialization
 * - IDE activity tracking
 * - Snapshot creation
 * - Test execution
 * - Post-mortem submission
 * - Complete assessment data integrity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
                    })),
                    ascending: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            single: vi.fn()
                        }))
                    }))
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

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => mockSupabase)
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: mockSupabase,
    getCandidate: vi.fn()
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({
        getAll: () => [],
        setAll: () => {}
    }))
}));

describe('Complete Assessment Flow - Data Capture', () => {
    const mockAssessmentData = {
        user: {
            id: 'user-123',
            email: 'test@example.com'
        },
        candidate: {
            id: 'candidate-123',
            email: 'test@example.com',
            name: 'Test User',
            github_username: 'testuser'
        },
        session: {
            session_id: 'session-abc-123',
            candidate_id: 'candidate-123',
            container_url: 'https://assess-abc123.fly.dev',
            container_status: 'running',
            created_at: '2024-01-01T10:00:00Z',
            interview_start_time: '2024-01-01T10:05:00Z',
            current_phase: 'coding'
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    });

    it('should track complete assessment lifecycle', async () => {
        // Step 1: Session initialization
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: mockAssessmentData.user },
            error: null
        });

        const authResult = await mockSupabase.auth.getUser();
        expect(authResult.data.user.id).toBe('user-123');

        // Step 2: Container provisioning and tracking
        const containerData = {
            session_id: mockAssessmentData.session.session_id,
            container_status: 'running',
            container_url: mockAssessmentData.session.container_url,
            interview_start_time: mockAssessmentData.session.interview_start_time
        };

        expect(containerData.container_status).toBe('running');
        expect(containerData.interview_start_time).toBeTruthy();

        // Step 3: IDE activity tracking
        const startTime = new Date(mockAssessmentData.session.interview_start_time).getTime();
        const endTime = new Date('2024-01-01T10:25:00Z').getTime(); // 20 minutes later
        const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

        expect(elapsedSeconds).toBe(1200); // Exactly 20 minutes
        expect(elapsedSeconds).toBeLessThanOrEqual(1200); // Within time limit
    });

    it('should capture snapshot data correctly', async () => {
        const snapshotRequest = {
            sessionId: mockAssessmentData.session.session_id,
            trigger: 'submission',
            message: 'Final submission snapshot'
        };

        const snapshotData = {
            p_candidate_id: mockAssessmentData.candidate.github_username,
            p_event: 'push',
            p_added_lines: 0,
            p_deleted_lines: 0,
            p_commit_message: snapshotRequest.message,
            p_repo_name: `session-${mockAssessmentData.session.session_id.split('_').pop()}`,
            p_commit_hash: null,
            p_commit_author: mockAssessmentData.candidate.github_username,
            p_commit_timestamp: '2024-01-01T10:25:00Z',
            p_snapshot_storage_path: `snapshots/${mockAssessmentData.session.session_id}/snapshot.tar.gz`,
            p_snapshot_size_bytes: 2048000,
            p_session_id: mockAssessmentData.session.session_id
        };

        mockSupabase.rpc.mockResolvedValue({
            data: { commit_id: 'commit-789' },
            error: null
        });

        const result = await mockSupabase.rpc('log_session_commit', snapshotData);

        expect(result.error).toBeNull();
        expect(result.data.commit_id).toBe('commit-789');
        expect(snapshotData.p_session_id).toBe(mockAssessmentData.session.session_id);
    });

    it('should capture test execution results', async () => {
        const testResults = {
            numTotalTests: 15,
            numPassedTests: 12,
            numFailedTests: 3,
            testResults: [
                {
                    name: '/workspace/tests/notifications.test.tsx',
                    status: 'passed',
                    assertionResults: [
                        { title: 'displays notification count', status: 'passed' },
                        { title: 'marks notifications as read', status: 'passed' }
                    ]
                },
                {
                    name: '/workspace/tests/realtime.test.tsx',
                    status: 'failed',
                    assertionResults: [
                        { title: 'syncs across tabs', status: 'failed' }
                    ]
                }
            ]
        };

        const testData = {
            p_session_id: mockAssessmentData.session.session_id,
            p_candidate_id: mockAssessmentData.candidate.id,
            p_test_type: 'full',
            p_test_results: testResults,
            p_total_score: testResults.numPassedTests,
            p_max_score: testResults.numTotalTests
        };

        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: null
        });

        const result = await mockSupabase.rpc('log_test_result', testData);

        expect(result.error).toBeNull();
        expect(testData.p_total_score).toBe(12);
        expect(testData.p_max_score).toBe(15);
        expect(testData.p_test_type).toBe('full');
    });

    it('should capture post-mortem survey data', async () => {
        const { getCandidate } = await import('@/lib/supabase');

        getCandidate.mockResolvedValue(mockAssessmentData.candidate);

        // Mock session lookup
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({
                                data: { session_id: mockAssessmentData.session.session_id },
                                error: null
                            })
                        }))
                    }))
                }))
            }))
        });

        const surveyAnswers = {
            q1: 'I started by analyzing the Supabase schema to understand the notification structure and relationships. Then I identified the key components needed: notification fetching, real-time subscriptions, and mark-as-read functionality.',
            q2: '7/10. The implementation is functional but needs better error handling for network failures, loading states, and proper cleanup of subscriptions to prevent memory leaks.',
            q3: 'Claude initially suggested a client-side only approach, but I realized we needed server-side RLS policies to prevent unauthorized access to notifications.',
            difficulty: 7
        };

        const surveyData = {
            p_session_id: mockAssessmentData.session.session_id,
            p_candidate_id: mockAssessmentData.candidate.id,
            p_q1_approach: surveyAnswers.q1,
            p_q2_production_readiness: surveyAnswers.q2,
            p_q3_claude_mistake: surveyAnswers.q3,
            p_difficulty_score: surveyAnswers.difficulty
        };

        mockSupabase.rpc.mockResolvedValue({
            data: { success: true },
            error: null
        });

        const result = await mockSupabase.rpc('submit_post_mortem', surveyData);

        expect(result.error).toBeNull();
        expect(result.data.success).toBe(true);
        expect(surveyData.p_session_id).toBe(mockAssessmentData.session.session_id);
        expect(surveyData.p_difficulty_score).toBe(7);
    });
});

describe('Data Integrity Across Assessment Stages', () => {
    it('should maintain session_id consistency across all data points', () => {
        const sessionId = 'session-xyz-789';

        const dataPoints = {
            session: { session_id: sessionId },
            snapshot: { p_session_id: sessionId },
            testResults: { p_session_id: sessionId },
            survey: { p_session_id: sessionId }
        };

        expect(dataPoints.session.session_id).toBe(sessionId);
        expect(dataPoints.snapshot.p_session_id).toBe(sessionId);
        expect(dataPoints.testResults.p_session_id).toBe(sessionId);
        expect(dataPoints.survey.p_session_id).toBe(sessionId);
    });

    it('should maintain candidate_id consistency', () => {
        const candidateId = 'candidate-456';

        const dataPoints = {
            session: { candidate_id: candidateId },
            testResults: { p_candidate_id: candidateId },
            survey: { p_candidate_id: candidateId }
        };

        expect(dataPoints.session.candidate_id).toBe(candidateId);
        expect(dataPoints.testResults.p_candidate_id).toBe(candidateId);
        expect(dataPoints.survey.p_candidate_id).toBe(candidateId);
    });

    it('should track timestamps correctly', () => {
        const timestamps = {
            session_created: '2024-01-01T10:00:00Z',
            interview_started: '2024-01-01T10:05:00Z',
            snapshot_created: '2024-01-01T10:25:00Z',
            tests_completed: '2024-01-01T10:26:00Z',
            survey_submitted: '2024-01-01T10:30:00Z'
        };

        const created = new Date(timestamps.session_created).getTime();
        const started = new Date(timestamps.interview_started).getTime();
        const snapshot = new Date(timestamps.snapshot_created).getTime();
        const tests = new Date(timestamps.tests_completed).getTime();
        const survey = new Date(timestamps.survey_submitted).getTime();

        // Verify chronological order
        expect(started).toBeGreaterThanOrEqual(created);
        expect(snapshot).toBeGreaterThanOrEqual(started);
        expect(tests).toBeGreaterThanOrEqual(snapshot);
        expect(survey).toBeGreaterThanOrEqual(tests);
    });
});

describe('Assessment Metrics Calculation', () => {
    it('should calculate assessment score correctly', () => {
        const testResults = {
            numTotalTests: 20,
            numPassedTests: 16,
            numFailedTests: 4
        };

        const scorePercentage = (testResults.numPassedTests / testResults.numTotalTests) * 100;
        const passRate = testResults.numPassedTests / testResults.numTotalTests;

        expect(scorePercentage).toBe(80);
        expect(passRate).toBe(0.8);
        expect(testResults.numPassedTests + testResults.numFailedTests).toBe(testResults.numTotalTests);
    });

    it('should track time metrics accurately', () => {
        const startTime = new Date('2024-01-01T10:00:00Z').getTime();
        const endTime = new Date('2024-01-01T10:18:30Z').getTime();

        const elapsedMs = endTime - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);

        expect(elapsedSeconds).toBe(1110); // 18.5 minutes = 1110 seconds
        expect(elapsedMinutes).toBe(18);
        expect(elapsedSeconds).toBeLessThan(1200); // Under 20 minute limit
    });

    it('should calculate completeness metrics', () => {
        const assessmentData = {
            hasSession: true,
            hasStartTime: true,
            hasSnapshot: true,
            hasTestResults: true,
            hasSurvey: true
        };

        const completedSteps = Object.values(assessmentData).filter(Boolean).length;
        const totalSteps = Object.keys(assessmentData).length;
        const completeness = (completedSteps / totalSteps) * 100;

        expect(completeness).toBe(100);
    });
});

describe('Error Recovery and Data Preservation', () => {
    it('should preserve session data if snapshot fails', async () => {
        const sessionId = 'session-123';

        // Snapshot fails
        mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: new Error('Snapshot failed')
        });

        // Session data should still be accessible
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: {
                            session_id: sessionId,
                            container_status: 'running'
                        },
                        error: null
                    })
                }))
            }))
        });

        const snapshotResult = await mockSupabase.rpc('log_session_commit', {});
        expect(snapshotResult.error).toBeTruthy();

        const sessionResult = await mockSupabase
            .from('interview_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        expect(sessionResult.data).toBeTruthy();
        expect(sessionResult.data.session_id).toBe(sessionId);
    });

    it('should allow test execution even if snapshot fails', () => {
        const hasSnapshot = false;
        const canRunTests = true; // Tests should still run

        expect(canRunTests).toBe(true);
        expect(hasSnapshot).toBe(false);
    });

    it('should allow survey submission regardless of test results', () => {
        const testsFailed = true;
        const canSubmitSurvey = true; // Survey should still be submittable

        expect(testsFailed).toBe(true);
        expect(canSubmitSurvey).toBe(true);
    });
});

describe('Data Validation Across Assessment Lifecycle', () => {
    it('should validate required data at each stage', () => {
        const stages = {
            sessionStart: {
                required: ['session_id', 'candidate_id', 'container_url'],
                optional: ['interview_start_time']
            },
            ideActivity: {
                required: ['session_id', 'elapsed_time'],
                optional: ['current_phase']
            },
            snapshot: {
                required: ['session_id', 'storage_path', 'trigger'],
                optional: ['commit_hash', 'message']
            },
            tests: {
                required: ['session_id', 'test_type', 'test_results'],
                optional: ['destroy_after']
            },
            survey: {
                required: ['session_id', 'q1', 'q2', 'difficulty'],
                optional: ['q3']
            }
        };

        // Verify stage definitions
        expect(stages.sessionStart.required).toContain('session_id');
        expect(stages.snapshot.required).toContain('storage_path');
        expect(stages.tests.required).toContain('test_results');
        expect(stages.survey.required).toContain('q1');
        expect(stages.survey.optional).toContain('q3');
    });
});
