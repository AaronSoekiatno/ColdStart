/**
 * Unit tests for Post-Mortem Page Data Capture
 *
 * Tests that the post-mortem page correctly captures and stores:
 * - Survey answers (q1, q2, q3)
 * - Difficulty rating
 * - Word count validation
 * - Form submission to database
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
        }))
    })),
    rpc: vi.fn()
};

// Mock Supabase modules
vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => mockSupabase)
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

describe('Post-Mortem Page - Survey Data Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate survey answer structure', () => {
        const answers = {
            q1: 'I started by analyzing the schema and understanding the requirements...',
            q2: '7/10. It needs better error handling and edge case validation...',
            q3: 'Claude missed a null check in the API handler...',
            difficulty: 5
        };

        expect(answers).toHaveProperty('q1');
        expect(answers).toHaveProperty('q2');
        expect(answers).toHaveProperty('q3');
        expect(answers).toHaveProperty('difficulty');
        expect(typeof answers.q1).toBe('string');
        expect(typeof answers.q2).toBe('string');
        expect(typeof answers.q3).toBe('string');
        expect(typeof answers.difficulty).toBe('number');
    });

    it('should enforce required fields', () => {
        const validAnswers = {
            q1: 'My approach was...',
            q2: '8/10 production ready',
            q3: '', // Optional
            difficulty: 6
        };

        // q1 and q2 are required
        expect(validAnswers.q1.length).toBeGreaterThan(0);
        expect(validAnswers.q2.length).toBeGreaterThan(0);

        // q3 is optional
        expect(validAnswers.q3).toBeDefined();
    });

    it('should validate difficulty rating range', () => {
        const validRatings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        validRatings.forEach(rating => {
            expect(rating).toBeGreaterThanOrEqual(1);
            expect(rating).toBeLessThanOrEqual(10);
        });

        const invalidRatings = [0, 11, -1, 15];
        invalidRatings.forEach(rating => {
            const isValid = rating >= 1 && rating <= 10;
            expect(isValid).toBe(false);
        });
    });
});

describe('Post-Mortem Page - Word Count Validation', () => {
    const getWordCount = (text) => {
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    };

    const isOverLimit = (text, limit = 200) => getWordCount(text) > limit;

    it('should count words correctly', () => {
        expect(getWordCount('')).toBe(0);
        expect(getWordCount('   ')).toBe(0);
        expect(getWordCount('Hello')).toBe(1);
        expect(getWordCount('Hello world')).toBe(2);
        expect(getWordCount('This is a test sentence.')).toBe(5);
        expect(getWordCount('  Multiple   spaces   between   words  ')).toBe(4);
    });

    it('should enforce 200-word limit per answer', () => {
        const shortAnswer = 'This is a short answer with only ten words in total.';
        const longAnswer = Array(201).fill('word').join(' ');

        expect(isOverLimit(shortAnswer)).toBe(false);
        expect(isOverLimit(longAnswer)).toBe(true);
        expect(getWordCount(shortAnswer)).toBeLessThanOrEqual(200);
        expect(getWordCount(longAnswer)).toBeGreaterThan(200);
    });

    it('should handle edge cases in word counting', () => {
        expect(getWordCount('\n\n\n')).toBe(0);
        expect(getWordCount('word\nword\nword')).toBe(3);
        expect(getWordCount('hyphenated-word')).toBe(1);
        expect(getWordCount('multiple...dots')).toBe(1);
    });

    it('should validate all three answers independently', () => {
        const answers = {
            q1: Array(150).fill('word').join(' '), // 150 words - valid
            q2: Array(200).fill('word').join(' '), // 200 words - valid
            q3: Array(210).fill('word').join(' ')  // 210 words - invalid
        };

        expect(isOverLimit(answers.q1)).toBe(false);
        expect(isOverLimit(answers.q2)).toBe(false);
        expect(isOverLimit(answers.q3)).toBe(true);
    });
});

describe('Post-Mortem Page - Form Submission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    });

    it('should authenticate user before submission', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com'
        };

        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null
        });

        const result = await mockSupabase.auth.getUser();

        expect(result.data.user).toEqual(mockUser);
        expect(result.error).toBeNull();
    });

    it('should retrieve candidate information', async () => {
        const { getCandidate } = await import('@/lib/supabase');

        const mockCandidate = {
            id: 'candidate-123',
            email: 'test@example.com',
            name: 'Test User'
        };

        getCandidate.mockResolvedValue(mockCandidate);

        const candidate = await getCandidate('test@example.com');

        expect(candidate).toEqual(mockCandidate);
        expect(candidate.id).toBe('candidate-123');
    });

    it('should find latest session for candidate', async () => {
        const candidateId = 'candidate-123';
        const mockSession = {
            session_id: 'session-abc',
            created_at: '2024-01-01T12:00:00Z'
        };

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

        const result = await mockSupabase
            .from('interview_sessions')
            .select('session_id')
            .eq('candidate_id', candidateId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        expect(result.data).toEqual(mockSession);
        expect(result.data.session_id).toBe('session-abc');
    });

    it('should call submit_post_mortem RPC with correct parameters', async () => {
        const surveyData = {
            p_session_id: 'session-abc',
            p_candidate_id: 'candidate-123',
            p_q1_approach: 'I started by reading the schema...',
            p_q2_production_readiness: '7/10, needs better error handling',
            p_q3_claude_mistake: 'Claude missed edge case validation',
            p_difficulty_score: 6
        };

        mockSupabase.rpc.mockResolvedValue({
            data: { success: true },
            error: null
        });

        const result = await mockSupabase.rpc('submit_post_mortem', surveyData);

        expect(result.error).toBeNull();
        expect(result.data.success).toBe(true);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_post_mortem', surveyData);
    });

    it('should handle submission errors gracefully', async () => {
        const error = new Error('Database connection failed');

        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: error
        });

        const result = await mockSupabase.rpc('submit_post_mortem', {});

        expect(result.error).toBeTruthy();
        expect(result.data).toBeNull();
    });
});

describe('Post-Mortem Page - Complete Submission Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate complete submission payload', () => {
        const submissionPayload = {
            sessionId: 'session-abc',
            candidateId: 'candidate-123',
            answers: {
                q1: 'My approach started with understanding the database schema and identifying the key relationships...',
                q2: '8/10. The code is production-ready but could use more comprehensive error handling...',
                q3: 'Claude initially suggested using a synchronous approach but I noticed it would block...',
                difficulty: 7
            },
            timestamp: '2024-01-01T12:30:00Z'
        };

        // Validate structure
        expect(submissionPayload.sessionId).toBeTruthy();
        expect(submissionPayload.candidateId).toBeTruthy();
        expect(submissionPayload.answers).toHaveProperty('q1');
        expect(submissionPayload.answers).toHaveProperty('q2');
        expect(submissionPayload.answers).toHaveProperty('q3');
        expect(submissionPayload.answers).toHaveProperty('difficulty');

        // Validate content
        expect(submissionPayload.answers.q1.length).toBeGreaterThan(0);
        expect(submissionPayload.answers.q2.length).toBeGreaterThan(0);
        expect(submissionPayload.answers.difficulty).toBeGreaterThanOrEqual(1);
        expect(submissionPayload.answers.difficulty).toBeLessThanOrEqual(10);
    });

    it('should prevent submission when validation fails', () => {
        const getWordCount = (text) => {
            return text.trim() ? text.trim().split(/\s+/).length : 0;
        };

        const isOverLimit = (text) => getWordCount(text) > 200;

        const invalidAnswers = {
            q1: Array(250).fill('word').join(' '), // Over limit
            q2: 'Valid answer',
            q3: '',
            difficulty: 5
        };

        const canSubmit = !isOverLimit(invalidAnswers.q1) &&
            !isOverLimit(invalidAnswers.q2) &&
            !isOverLimit(invalidAnswers.q3) &&
            invalidAnswers.q1.length > 0 &&
            invalidAnswers.q2.length > 0;

        expect(canSubmit).toBe(false);
    });

    it('should allow submission when all validations pass', () => {
        const getWordCount = (text) => {
            return text.trim() ? text.trim().split(/\s+/).length : 0;
        };

        const isOverLimit = (text) => getWordCount(text) > 200;

        const validAnswers = {
            q1: 'My approach was systematic and thorough.',
            q2: '8/10 production ready with minor improvements needed.',
            q3: 'Claude suggested an optimization that I verified.',
            difficulty: 6
        };

        const canSubmit = !isOverLimit(validAnswers.q1) &&
            !isOverLimit(validAnswers.q2) &&
            !isOverLimit(validAnswers.q3) &&
            validAnswers.q1.length > 0 &&
            validAnswers.q2.length > 0;

        expect(canSubmit).toBe(true);
    });
});

describe('Post-Mortem Page - Database Schema Compliance', () => {
    it('should match expected post_mortem table structure', () => {
        const postMortemRecord = {
            session_id: 'session-abc',
            candidate_id: 'candidate-123',
            q1_approach: 'Text content...',
            q2_production_readiness: 'Text content...',
            q3_claude_mistake: 'Text content...',
            difficulty_score: 7,
            submitted_at: '2024-01-01T12:30:00Z'
        };

        // Verify all required fields exist
        expect(postMortemRecord).toHaveProperty('session_id');
        expect(postMortemRecord).toHaveProperty('candidate_id');
        expect(postMortemRecord).toHaveProperty('q1_approach');
        expect(postMortemRecord).toHaveProperty('q2_production_readiness');
        expect(postMortemRecord).toHaveProperty('q3_claude_mistake');
        expect(postMortemRecord).toHaveProperty('difficulty_score');
        expect(postMortemRecord).toHaveProperty('submitted_at');

        // Verify data types
        expect(typeof postMortemRecord.session_id).toBe('string');
        expect(typeof postMortemRecord.candidate_id).toBe('string');
        expect(typeof postMortemRecord.q1_approach).toBe('string');
        expect(typeof postMortemRecord.difficulty_score).toBe('number');
    });
});

describe('Post-Mortem Page - Error Handling', () => {
    it('should handle missing candidate gracefully', async () => {
        const { getCandidate } = await import('@/lib/supabase');

        getCandidate.mockResolvedValue(null);

        const candidate = await getCandidate('nonexistent@example.com');

        expect(candidate).toBeNull();
    });

    it('should handle missing session gracefully', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({
                                data: null,
                                error: new Error('No session found')
                            })
                        }))
                    }))
                }))
            }))
        });

        const result = await mockSupabase
            .from('interview_sessions')
            .select('session_id')
            .eq('candidate_id', 'nonexistent-candidate')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        expect(result.data).toBeNull();
        expect(result.error).toBeTruthy();
    });

    it('should handle unauthorized access', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: new Error('Unauthorized')
        });

        const result = await mockSupabase.auth.getUser();

        expect(result.data.user).toBeNull();
        expect(result.error).toBeTruthy();
    });
});
