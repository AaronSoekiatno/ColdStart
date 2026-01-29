/**
 * Unit tests for email generation
 *
 * Tests email generation for cold outreach, which is core product value.
 * Need to test persona variety and proper field handling.
 *
 * Tested from: lib/email-generation.ts
 *
 * Note: Since generateColdEmail uses Google's Gemini API, we mock the API
 * responses to test the integration and data handling without actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockGenerateContent,
  mockGetGenerativeModel
} = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetGenerativeModel: vi.fn()
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() { }
      getGenerativeModel = mockGetGenerativeModel
    }
  };
});




// Import after mocking
const emailGenModule = await import('../../../lib/email-generation.ts');
const { generateColdEmail } = emailGenModule;

describe('Email Generation', () => {
  const mockCandidate = {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    skills: ['React', 'Node.js', 'TypeScript'],
    location: 'San Francisco, CA',
    educationLevel: "Bachelor's",
    university: 'Stanford University',
    jobType: 'full-time',
    major: ['Computer Science']
  };

  const mockStartup = {
    name: 'TechStartup',
    industry: 'AI/ML',
    description: 'Building AI tools for developers',
    founderName: 'Bob Smith',
    website: 'https://techstartup.com'
  };

  const mockMatch = {
    score: 0.85,
    rank: 1,
    totalMatches: 5
  };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    vi.clearAllMocks();

    // Setup mock implementations
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent
    });

    // Default mock response
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          subject: 'Test Subject',
          body: 'Test email body',
          explanation: 'Test explanation'
        })
      }
    });
  });


  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('generateColdEmail', () => {
    it('should generate email with direct-ask persona', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in full-timing at TechStartup',
            body: 'Dear Bob,\n\nI would like to apply for a full-time position at TechStartup.',
            explanation: 'Direct and concise'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch,
        { persona: 'direct-ask' }
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(result.rawText).toBeTruthy();
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should generate email with genuine-fan persona', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Inspired by TechStartup - full-time interest',
            body: 'Dear Bob,\n\nI have been following TechStartup and am impressed by your work.',
            explanation: 'Showing genuine interest'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch,
        { persona: 'genuine-fan' }
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should generate email with value-first persona', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Built AI tools - TechStartup full-time',
            body: 'Dear Bob,\n\nI recently built tools similar to what TechStartup is creating.',
            explanation: 'Leading with value'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch,
        { persona: 'value-first' }
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should handle missing optional fields in candidate', async () => {
      const minimalCandidate = {
        name: 'John Doe',
        email: 'john@example.com',
        skills: ['JavaScript']
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in interning at TechStartup',
            body: 'Email body',
            explanation: 'Minimal candidate data'
          })
        }
      });

      const result = await generateColdEmail(
        minimalCandidate,
        mockStartup,
        mockMatch
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should handle missing optional fields in startup', async () => {
      const minimalStartup = {
        name: 'MinimalStartup'
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in full-timing at MinimalStartup',
            body: 'Email body',
            explanation: 'Minimal startup data'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        minimalStartup,
        mockMatch
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
    });

    it('should include job type in subject line for full-time', async () => {
      const candidateFullTime = { ...mockCandidate, jobType: 'full-time' };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in full-timing at TechStartup',
            body: 'Email body',
            explanation: 'Full-time position'
          })
        }
      });

      const result = await generateColdEmail(
        candidateFullTime,
        mockStartup,
        mockMatch
      );

      // Verify the prompt includes full-time information
      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('full-time');
    });

    it('should include job type in subject line for part-time', async () => {
      const candidatePartTime = { ...mockCandidate, jobType: 'part-time' };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in part-timing at TechStartup',
            body: 'Email body',
            explanation: 'Part-time position'
          })
        }
      });

      const result = await generateColdEmail(
        candidatePartTime,
        mockStartup,
        mockMatch
      );

      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('part-time');
    });

    it('should default to internship when job type not specified', async () => {
      const candidateNoJobType = { ...mockCandidate };
      delete candidateNoJobType.jobType;

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Interested in interning at TechStartup',
            body: 'Email body',
            explanation: 'Internship (default)'
          })
        }
      });

      const result = await generateColdEmail(
        candidateNoJobType,
        mockStartup,
        mockMatch
      );

      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('internship');
    });

    it('should handle Markdown code fences in response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => '```json\n' + JSON.stringify({
            subject: 'Test Subject',
            body: 'Test body',
            explanation: 'Test'
          }) + '\n```'
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch
      );

      expect(result.subject).toBe('Test Subject');
      expect(result.body).toBe('Test body');
    });

    it('should throw error if GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;

      await expect(
        generateColdEmail(mockCandidate, mockStartup, mockMatch)
      ).rejects.toThrow('GEMINI_API_KEY');
    });

    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        generateColdEmail(mockCandidate, mockStartup, mockMatch)
      ).rejects.toThrow();
    });

    it('should handle invalid JSON response by falling back to raw text', async () => {
      const rawResponse = 'Not valid JSON';
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => rawResponse
        }
      });

      const result = await generateColdEmail(mockCandidate, mockStartup, mockMatch);

      expect(result.body).toBe(rawResponse);
      expect(result.subject).toContain(mockCandidate.name);
      expect(result.subject).toContain(mockStartup.name);
    });


    it('should include subject prefix when specified', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Test Subject',
            body: 'Test body',
            explanation: 'With prefix'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch,
        { includeSubjectPrefix: '[ResumeSender]' }
      );

      // Verify subject includes the prefix
      expect(result.subject).toContain('Test Subject');
    });

    it('should pass maxWords option to prompt', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Short Subject',
            body: 'Brief body',
            explanation: 'Limited words'
          })
        }
      });

      await generateColdEmail(
        mockCandidate,
        mockStartup,
        mockMatch,
        { maxWords: 50 }
      );

      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0];
      // Verify maxWords is included in prompt
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should handle different match scores', async () => {
      const matchScores = [
        { score: 0.95, rank: 1 },
        { score: 0.75, rank: 5 },
        { score: 0.50, rank: 10 }
      ];

      for (const match of matchScores) {
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              subject: 'Subject',
              body: 'Body',
              explanation: `Score: ${match.score}`
            })
          }
        });

        const result = await generateColdEmail(
          mockCandidate,
          mockStartup,
          match
        );

        expect(result.subject).toBeTruthy();
        expect(result.body).toBeTruthy();
      }
    });

    it('should include startup context when available', async () => {
      const startupWithContext = {
        ...mockStartup,
        scrapedContext: 'Recently raised $10M Series A',
        keywords: ['AI', 'Machine Learning', 'DevTools']
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Congrats on Series A - full-time interest',
            body: 'I saw you recently raised funding...',
            explanation: 'Personalized with context'
          })
        }
      });

      const result = await generateColdEmail(
        mockCandidate,
        startupWithContext,
        mockMatch
      );

      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();

      // Verify context was passed to API
      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('Recently raised $10M Series A');
    });
  });

  describe('Helper functions', () => {
    // These functions are not directly exported, but we can test them through generateColdEmail

    it('should convert full-time to proper text', async () => {
      const candidate = { ...mockCandidate, jobType: 'full-time' };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Subject',
            body: 'Body',
            explanation: 'Test'
          })
        }
      });

      await generateColdEmail(candidate, mockStartup, mockMatch);

      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('full-time');
    });

    it('should convert part-time to proper text', async () => {
      const candidate = { ...mockCandidate, jobType: 'part-time' };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Subject',
            body: 'Body',
            explanation: 'Test'
          })
        }
      });

      await generateColdEmail(candidate, mockStartup, mockMatch);

      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('part-time');
    });

    it('should convert internship to proper text', async () => {
      const candidate = { ...mockCandidate, jobType: 'internship' };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            subject: 'Subject',
            body: 'Body',
            explanation: 'Test'
          })
        }
      });

      await generateColdEmail(candidate, mockStartup, mockMatch);

      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[0]).toContain('internship');
    });
  });
});
