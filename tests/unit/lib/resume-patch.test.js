/**
 * Unit tests for resume patch utilities
 *
 * Tests the resume editing functions for data integrity.
 * Resume data corruption would result in a bad user experience.
 *
 * Tested from: lib/resume-patch.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyPatch, applyPatches } from '../../../lib/resume-patch.ts';
import { mockStructuredResumeData } from '../../helpers/factories.js';

describe('Resume Patch Utilities', () => {
  let testResumeData;

  beforeEach(() => {
    testResumeData = mockStructuredResumeData();
  });

  describe('applyPatch - edit operations', () => {
    it('should apply edit operation with dot notation path', () => {
      const patch = {
        id: 'patch-1',
        type: 'edit',
        path: 'personal.name',
        oldValue: 'Test User',
        newValue: 'John Doe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.personal.name).toBe('John Doe');
      expect(result.modifiedPath).toBe('personal.name');
    });

    it('should apply edit operation with bracket notation path', () => {
      const patch = {
        id: 'patch-2',
        type: 'edit',
        path: 'experience[0].title',
        oldValue: 'Software Engineer',
        newValue: 'Senior Software Engineer'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.experience[0].title).toBe('Senior Software Engineer');
      expect(result.modifiedPath).toBe('experience[0].title');
    });

    it('should apply edit operation with mixed notation', () => {
      const patch = {
        id: 'patch-3',
        type: 'edit',
        path: 'education[0].major',
        oldValue: 'Computer Science',
        newValue: 'Computer Engineering'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.education[0].major).toBe('Computer Engineering');
    });

    it('should validate oldValue before applying edit', () => {
      const patch = {
        id: 'patch-4',
        type: 'edit',
        path: 'personal.name',
        oldValue: 'Wrong Name',
        newValue: 'John Doe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Value mismatch');
      expect(result.updatedData.personal.name).toBe('Test User'); // Unchanged
    });

    it('should trim whitespace when comparing string values', () => {
      const patch = {
        id: 'patch-5',
        type: 'edit',
        path: 'personal.name',
        oldValue: '  Test User  ', // With whitespace
        newValue: 'John Doe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.personal.name).toBe('John Doe');
    });

    it('should fail on oldValue mismatch for non-strings', () => {
      const patch = {
        id: 'patch-6',
        type: 'edit',
        path: 'skills',
        oldValue: ['Wrong', 'Skills'],
        newValue: ['JavaScript', 'TypeScript']
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Value mismatch');
    });

    it('should edit nested object properties', () => {
      const patch = {
        id: 'patch-7',
        type: 'edit',
        path: 'personal.email',
        oldValue: 'test@example.com',
        newValue: 'john.doe@example.com'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.personal.email).toBe('john.doe@example.com');
    });

    it('should edit array items', () => {
      const patch = {
        id: 'patch-8',
        type: 'edit',
        path: 'skills[0]',
        oldValue: 'JavaScript',
        newValue: 'TypeScript'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.skills[0]).toBe('TypeScript');
    });
  });

  describe('applyPatch - add operations', () => {
    it('should add item to array at specific index', () => {
      const patch = {
        id: 'patch-9',
        type: 'add',
        path: 'skills[1]',
        newValue: 'Python'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.skills[1]).toBe('Python');
      expect(result.updatedData.skills).toContain('Python');
    });

    it('should add new property to object', () => {
      const patch = {
        id: 'patch-10',
        type: 'add',
        path: 'personal.linkedin',
        newValue: 'https://linkedin.com/in/johndoe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.personal.linkedin).toBe('https://linkedin.com/in/johndoe');
    });

    it('should add new experience item', () => {
      const newExperience = {
        company: 'New Company',
        title: 'Lead Engineer',
        start_date: '2023-01',
        end_date: null,
        description: 'Leading engineering team'
      };

      const patch = {
        id: 'patch-11',
        type: 'add',
        path: 'experience[1]',
        newValue: newExperience
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.experience[1]).toEqual(newExperience);
    });

    it('should add new education item', () => {
      const newEducation = {
        school: 'MIT',
        degree: "Master's",
        major: 'Artificial Intelligence',
        graduation_date: '2023-05'
      };

      const patch = {
        id: 'patch-12',
        type: 'add',
        path: 'education[1]',
        newValue: newEducation
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.education[1]).toEqual(newEducation);
    });
  });

  describe('applyPatch - remove operations', () => {
    it('should remove item from array', () => {
      const originalLength = testResumeData.skills.length;
      const patch = {
        id: 'patch-13',
        type: 'remove',
        path: 'skills[0]'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.skills.length).toBe(originalLength - 1);
      expect(result.updatedData.skills).not.toContain('JavaScript');
    });

    it('should remove property from object', () => {
      const patch = {
        id: 'patch-14',
        type: 'remove',
        path: 'personal.phone'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.personal.phone).toBeUndefined();
    });

    it('should remove experience item', () => {
      const originalLength = testResumeData.experience.length;
      const patch = {
        id: 'patch-15',
        type: 'remove',
        path: 'experience[0]'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.experience.length).toBe(originalLength - 1);
    });

    it('should gracefully handle removing non-existent path', () => {
      const patch = {
        id: 'patch-16',
        type: 'remove',
        path: 'nonexistent.path'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      // Original data should be unchanged
      expect(result.updatedData).toEqual(testResumeData);
    });
  });

  describe('applyPatch - error handling', () => {
    it('should handle non-numeric array indices as object properties', () => {
      const patch = {
        id: 'patch-17',
        type: 'edit',
        path: 'experience[abc].title',
        newValue: 'Senior Engineer'
      };

      const result = applyPatch(testResumeData, patch);

      // The implementation treats non-numeric indices as property names
      // This won't fail but also won't work as expected on arrays
      expect(result.success).toBe(true);
    });

    it('should handle unknown patch type', () => {
      const patch = {
        id: 'patch-18',
        type: 'unknown',
        path: 'personal.name',
        newValue: 'John'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown patch type');
    });

    it('should not mutate original data on failure', () => {
      const originalName = testResumeData.personal.name;
      const patch = {
        id: 'patch-19',
        type: 'edit',
        path: 'personal.name',
        oldValue: 'Wrong Value',
        newValue: 'New Name'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(false);
      expect(testResumeData.personal.name).toBe(originalName); // Unchanged
    });

    it('should not mutate original data on success', () => {
      const originalName = testResumeData.personal.name;
      const patch = {
        id: 'patch-20',
        type: 'edit',
        path: 'personal.name',
        oldValue: 'Test User',
        newValue: 'John Doe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(testResumeData.personal.name).toBe(originalName); // Original unchanged
      expect(result.updatedData.personal.name).toBe('John Doe'); // New data changed
    });
  });

  describe('applyPatches - multiple operations', () => {
    it('should apply multiple patches successfully', () => {
      const patches = [
        {
          id: 'patch-21',
          type: 'edit',
          path: 'personal.name',
          oldValue: 'Test User',
          newValue: 'John Doe'
        },
        {
          id: 'patch-22',
          type: 'edit',
          path: 'personal.email',
          oldValue: 'test@example.com',
          newValue: 'john.doe@example.com'
        },
        {
          id: 'patch-23',
          type: 'add',
          path: 'skills[4]',
          newValue: 'Docker'
        }
      ];

      const result = applyPatches(testResumeData, patches);

      expect(result.updatedData.personal.name).toBe('John Doe');
      expect(result.updatedData.personal.email).toBe('john.doe@example.com');
      expect(result.updatedData.skills).toContain('Docker');
      expect(result.modifiedPaths.size).toBe(3);
      expect(result.failedPatches.length).toBe(0);
    });

    it('should track failed patches', () => {
      const patches = [
        {
          id: 'patch-24',
          type: 'edit',
          path: 'personal.name',
          oldValue: 'Test User',
          newValue: 'John Doe'
        },
        {
          id: 'patch-25',
          type: 'edit',
          path: 'personal.email',
          oldValue: 'wrong@example.com', // Wrong old value
          newValue: 'john.doe@example.com'
        },
        {
          id: 'patch-26',
          type: 'add',
          path: 'skills[4]',
          newValue: 'Docker'
        }
      ];

      const result = applyPatches(testResumeData, patches);

      expect(result.updatedData.personal.name).toBe('John Doe'); // Success
      expect(result.updatedData.personal.email).toBe('test@example.com'); // Failed, unchanged
      expect(result.updatedData.skills).toContain('Docker'); // Success
      expect(result.modifiedPaths.size).toBe(2); // 2 successful patches
      expect(result.failedPatches.length).toBe(1);
      expect(result.failedPatches[0].id).toBe('patch-25');
    });

    it('should continue applying patches after a failure', () => {
      const patches = [
        {
          id: 'patch-27',
          type: 'unknown', // Invalid type - will fail
          path: 'personal.name',
          newValue: 'John'
        },
        {
          id: 'patch-28',
          type: 'edit',
          path: 'personal.email',
          oldValue: 'test@example.com',
          newValue: 'john@example.com'
        }
      ];

      const result = applyPatches(testResumeData, patches);

      expect(result.updatedData.personal.name).toBe('Test User'); // Failed, unchanged
      expect(result.updatedData.personal.email).toBe('john@example.com'); // Success
      expect(result.failedPatches.length).toBe(1);
      expect(result.modifiedPaths.size).toBe(1);
    });

    it('should handle empty patches array', () => {
      const result = applyPatches(testResumeData, []);

      expect(result.updatedData).toEqual(testResumeData);
      expect(result.modifiedPaths.size).toBe(0);
      expect(result.failedPatches.length).toBe(0);
    });

    it('should apply sequential patches that depend on each other', () => {
      const patches = [
        {
          id: 'patch-29',
          type: 'edit',
          path: 'experience[0].title',
          oldValue: 'Software Engineer',
          newValue: 'Senior Software Engineer'
        },
        {
          id: 'patch-30',
          type: 'edit',
          path: 'experience[0].title',
          oldValue: 'Senior Software Engineer', // Updated value from previous patch
          newValue: 'Lead Software Engineer'
        }
      ];

      const result = applyPatches(testResumeData, patches);

      expect(result.updatedData.experience[0].title).toBe('Lead Software Engineer');
      expect(result.modifiedPaths.size).toBe(1); // Same path modified twice
      expect(result.failedPatches.length).toBe(0);
    });
  });

  describe('Path parsing edge cases', () => {
    it('should handle deeply nested paths', () => {
      const complexData = {
        ...testResumeData,
        nested: {
          level1: {
            level2: {
              level3: 'deep value'
            }
          }
        }
      };

      const patch = {
        id: 'patch-31',
        type: 'edit',
        path: 'nested.level1.level2.level3',
        oldValue: 'deep value',
        newValue: 'new deep value'
      };

      const result = applyPatch(complexData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.nested.level1.level2.level3).toBe('new deep value');
    });

    it('should handle multiple array indices', () => {
      const complexData = {
        ...testResumeData,
        matrix: [
          [1, 2, 3],
          [4, 5, 6]
        ]
      };

      const patch = {
        id: 'patch-32',
        type: 'edit',
        path: 'matrix[1][2]',
        oldValue: 6,
        newValue: 10
      };

      const result = applyPatch(complexData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.matrix[1][2]).toBe(10);
    });

    it('should handle paths with array of objects', () => {
      const patch = {
        id: 'patch-33',
        type: 'edit',
        path: 'projects[0].name',
        oldValue: 'Open Source Project',
        newValue: 'Major Open Source Contribution'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      expect(result.updatedData.projects[0].name).toBe('Major Open Source Contribution');
    });
  });

  describe('Data integrity', () => {
    it('should preserve all unmodified data', () => {
      const patch = {
        id: 'patch-34',
        type: 'edit',
        path: 'personal.name',
        oldValue: 'Test User',
        newValue: 'John Doe'
      };

      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      // Verify other fields are unchanged
      expect(result.updatedData.personal.email).toBe(testResumeData.personal.email);
      expect(result.updatedData.personal.phone).toBe(testResumeData.personal.phone);
      expect(result.updatedData.education).toEqual(testResumeData.education);
      expect(result.updatedData.experience).toEqual(testResumeData.experience);
      expect(result.updatedData.skills).toEqual(testResumeData.skills);
    });

    it('should create deep copies to prevent mutation', () => {
      const patch = {
        id: 'patch-35',
        type: 'edit',
        path: 'experience[0].company',
        oldValue: 'Tech Co',
        newValue: 'New Tech Co'
      };

      const originalCompany = testResumeData.experience[0].company;
      const result = applyPatch(testResumeData, patch);

      expect(result.success).toBe(true);
      // Original data should not be mutated
      expect(testResumeData.experience[0].company).toBe(originalCompany);
      // Updated data should have new value
      expect(result.updatedData.experience[0].company).toBe('New Tech Co');
    });
  });
});
