/**
 * Unit tests for saveCandidate function
 *
 * Tests candidate saving for data integrity and duplicate prevention.
 *
 * Tested from: lib/supabase.ts - saveCandidate() function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockCandidate, mockStructuredResumeData } from '../../helpers/factories.js';

// Use vi.hoisted to define variables that will be available in hoisted vi.mock factories
const {
  mockSingleForGet,
  mockSingleForUpsert,
  mockEq,
  mockSelect,
  mockUpsert,
  mockFrom
} = vi.hoisted(() => {
  const mockSingleForGet = vi.fn();
  const mockSingleForUpsert = vi.fn();

  const mockEq = vi.fn().mockReturnThis();
  mockEq.single = mockSingleForGet;

  const mockSelect = vi.fn().mockReturnThis();
  mockSelect.eq = mockEq;
  mockSelect.single = mockSingleForUpsert; // After upsert, select().single() is called

  const mockUpsert = vi.fn().mockReturnValue({
    select: mockSelect
  });

  const mockFrom = vi.fn().mockImplementation((table) => {
    return {
      upsert: mockUpsert,
      select: mockSelect,
      eq: mockEq,
    };
  });

  return { mockSingleForGet, mockSingleForUpsert, mockEq, mockSelect, mockUpsert, mockFrom };
});

const mockSupabaseClient = {
  from: mockFrom,
};

// Mock external dependencies BEFORE importing the module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock normalization functions with better implementations
vi.mock('../../../lib/normalize-candidate-data.ts', () => ({
  normalizeName: vi.fn((name) => {
    if (!name) return null;
    return name.trim().split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }),
  normalizeEducationLevel: vi.fn((level) => {
    if (!level) return null;
    const l = level.toLowerCase();
    if (l.includes('bachelor') || l.includes('b.s.') || l.includes('bs ')) return "Bachelor's";
    if (l.includes('master') || l.includes('m.s.') || l.includes('ms ')) return "Master's";
    return level;
  }),
  normalizeUniversityName: vi.fn((name) => {
    if (!name) return null;
    if (name.toLowerCase() === 'mit') return 'Massachusetts Institute of Technology';
    return name;
  }),
  normalizeJobType: vi.fn((type) => {
    if (!type) return null;
    if (type === 'fulltime') return 'full-time';
    return type;
  }),
  normalizeMajor: vi.fn((major) => {
    if (!major) return null;
    return major.replace(/^(B\.S\.|Bachelor of Science|M\.S\.|Master of Science) in /i, '').trim();
  })
}));

// Import the real functions from the module
import { saveCandidate, getCandidate } from '../../../lib/supabase.ts';



describe('saveCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation((table) => {
      return {
        upsert: mockUpsert,
        select: mockSelect,
        eq: mockEq,
      };
    });

    mockUpsert.mockReturnValue({
      select: mockSelect
    });

    mockSelect.mockImplementation(() => ({
      single: mockSingleForUpsert,
      eq: mockEq
    }));

    mockEq.mockImplementation(() => ({
      single: mockSingleForGet,
      eq: mockEq
    }));

    // Setup default successful responses
    mockSingleForUpsert.mockResolvedValue({
      data: mockCandidate(),
      error: null
    });

    mockSingleForGet.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' }
    });
  });

  afterEach(() => {

    vi.restoreAllMocks();
  });

  describe('Basic saving', () => {
    it('should save a new candidate', async () => {
      const candidate = {
        email: 'newuser@example.com',
        name: 'New User',
        skills: 'JavaScript, Python'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, id: 'new-id-123' },
        error: null
      });

      const result = await saveCandidate(candidate);

      expect(mockFrom).toHaveBeenCalledWith('candidates');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: candidate.email,
          name: 'New User',
          skills: candidate.skills
        }),
        { onConflict: 'email' }
      );
      expect(result.email).toBe(candidate.email);
    });

    it('should update existing candidate on email conflict (upsert)', async () => {
      const existingCandidate = mockCandidate({
        email: 'existing@example.com',
        name: 'Old Name',
        skills: 'Old Skills'
      });

      const updatedData = {
        email: 'existing@example.com',
        name: 'New Name',
        skills: 'New Skills'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...existingCandidate, ...updatedData },
        error: null
      });

      const result = await saveCandidate(updatedData);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: updatedData.email,
          name: 'New Name',
          skills: updatedData.skills
        }),
        { onConflict: 'email' }
      );
    });
  });

  describe('Name normalization', () => {
    it('should normalize candidate name before saving', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'john doe',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, name: 'John Doe' },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe'
        }),
        expect.anything()
      );
    });

    it('should fallback to original name if normalization returns null', async () => {
      const { normalizeName } = await import('../../../lib/normalize-candidate-data.ts');
      normalizeName.mockReturnValueOnce(null);

      const candidate = {
        email: 'test@example.com',
        name: '!!!',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '!!!'
        }),
        expect.anything()
      );
    });
  });

  describe('Education level normalization', () => {
    it('should normalize education level', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        education_level: 'B.S. Computer Science'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, education_level: "Bachelor's" },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          education_level: "Bachelor's"
        }),
        expect.anything()
      );
    });
  });

  describe('University name normalization', () => {
    it('should normalize university name', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        university: 'mit'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, university: 'Massachusetts Institute of Technology' },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          university: 'Massachusetts Institute of Technology'
        }),
        expect.anything()
      );
    });
  });

  describe('Job type normalization', () => {
    it('should normalize job type', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        job_type: 'fulltime'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, job_type: 'full-time' },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          job_type: 'full-time'
        }),
        expect.anything()
      );
    });

    it('should fallback to original job_type if normalization returns null', async () => {
      const { normalizeJobType } = await import('../../../lib/normalize-candidate-data.ts');
      normalizeJobType.mockReturnValueOnce(null);

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        job_type: 'contract'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          job_type: 'contract'
        }),
        expect.anything()
      );
    });
  });

  describe('Major extraction and normalization', () => {
    it('should extract majors from structured_resume_data', async () => {
      const structuredData = mockStructuredResumeData({
        education: [
          {
            school: 'Stanford',
            degree: "Bachelor's",
            major: 'Computer Science'
          }
        ]
      });

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        structured_resume_data: structuredData
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, major: ['Computer Science'] },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          major: expect.arrayContaining(['Computer Science'])
        }),
        expect.anything()
      );
    });

    it('should normalize major names', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        major: ['B.S. in Computer Science', 'Bachelor of Science in Mathematics']
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, major: ['Computer Science', 'Mathematics'] },
        error: null
      });

      await saveCandidate(candidate);

      // Verify normalizeMajor was called for each major
      const { normalizeMajor } = await import('../../../lib/normalize-candidate-data.ts');
      expect(normalizeMajor).toHaveBeenCalled();
    });

    it('should preserve existing major if not provided in update', async () => {
      const existingMajor = ['Computer Science'];

      mockSingleForGet.mockResolvedValueOnce({
        data: {
          email: 'test@example.com',
          major: existingMajor
        },
        error: null
      });

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'New Skills'
        // No major provided
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, major: existingMajor },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          major: existingMajor
        }),
        expect.anything()
      );
    });

    it('should not set major if extraction returns empty array', async () => {
      const structuredData = mockStructuredResumeData({
        education: [
          {
            school: 'Stanford',
            degree: "Bachelor's",
            major: null // No major
          }
        ]
      });

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        structured_resume_data: structuredData
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      // major should not be included in upsert data if extraction returns empty
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.major).toBeUndefined();
    });
  });

  describe('Admin client usage', () => {
    it('should use admin client if available', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      // Verify supabaseAdmin was used (mockFrom was called)
      expect(mockFrom).toHaveBeenCalledWith('candidates');
    });
  });

  describe('Data preservation', () => {
    it('should preserve existing fields when updating', async () => {
      const candidate = {
        email: 'existing@example.com',
        name: 'Updated Name',
        skills: 'Updated Skills',
        location: 'San Francisco',
        university: 'Stanford'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'existing@example.com',
          name: 'Updated Name',
          skills: 'Updated Skills',
          location: 'San Francisco',
          university: 'Stanford'
        }),
        expect.anything()
      );
    });

    it('should include structured_resume_data when provided', async () => {
      const structuredData = mockStructuredResumeData();

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        structured_resume_data: structuredData
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          structured_resume_data: structuredData
        }),
        expect.anything()
      );
    });
  });

  describe('Error handling', () => {
    it('should throw error if upsert fails', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' }
      });

      await expect(saveCandidate(candidate)).rejects.toThrow();
    });

    it('should handle getCandidate error when checking for existing major', async () => {
      mockSingleForGet.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'OTHER_ERROR' }
      });

      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      // Should not throw, should continue without existing major
      await expect(saveCandidate(candidate)).resolves.toBeDefined();
    });
  });

  describe('Timestamp handling', () => {
    it('should set created_at if not provided', async () => {
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React'
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: { ...candidate, created_at: new Date().toISOString() },
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: expect.any(String)
        }),
        expect.anything()
      );
    });

    it('should preserve created_at if provided', async () => {
      const originalDate = '2023-01-01T00:00:00.000Z';
      const candidate = {
        email: 'test@example.com',
        name: 'Test User',
        skills: 'React',
        created_at: originalDate
      };

      mockSingleForUpsert.mockResolvedValueOnce({
        data: candidate,
        error: null
      });

      await saveCandidate(candidate);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: originalDate
        }),
        expect.anything()
      );
    });
  });
});
