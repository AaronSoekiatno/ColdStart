/**
 * Unit tests for candidate data normalization
 *
 * Tests data normalization functions to ensure consistent candidate matching
 * and prevent duplicate entries due to formatting differences.
 *
 * Tested from: lib/normalize-candidate-data.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeName,
  normalizeEducationLevel,
  normalizeUniversityName,
  normalizeJobType,
  normalizeMajor
} from '../../../lib/normalize-candidate-data.ts';

describe('Candidate Data Normalization', () => {
  describe('normalizeName', () => {
    it('should convert lowercase to title case', () => {
      expect(normalizeName('john doe')).toBe('John Doe');
      expect(normalizeName('jane smith')).toBe('Jane Smith');
      expect(normalizeName('alice johnson')).toBe('Alice Johnson');
    });

    it('should convert uppercase to title case', () => {
      expect(normalizeName('JOHN DOE')).toBe('John Doe');
      expect(normalizeName('JANE SMITH')).toBe('Jane Smith');
    });

    it('should convert mixed case to title case', () => {
      expect(normalizeName('jOhN DoE')).toBe('John Doe');
      expect(normalizeName('JaNe SmItH')).toBe('Jane Smith');
    });

    it('should trim whitespace', () => {
      expect(normalizeName('  John Doe  ')).toBe('John Doe');
      expect(normalizeName('\tJane Smith\n')).toBe('Jane Smith');
    });

    it('should handle single names', () => {
      expect(normalizeName('john')).toBe('John');
      expect(normalizeName('ALICE')).toBe('Alice');
    });

    it('should handle names with middle initials', () => {
      expect(normalizeName('john q. public')).toBe('John Q. Public');
      expect(normalizeName('mary j smith')).toBe('Mary J Smith');
    });

    it('should keep small words lowercase in middle position', () => {
      expect(normalizeName('john of the north')).toBe('John of The North');
      expect(normalizeName('alice and bob')).toBe('Alice and Bob');
      expect(normalizeName('king of the mountain')).toBe('King of The Mountain');
    });

    it('should capitalize first word even if it is a small word', () => {
      expect(normalizeName('of mice and men')).toBe('Of Mice and Men');
      expect(normalizeName('and then there were none')).toBe('And Then There Were None');
    });

    it('should return null for null or undefined input', () => {
      expect(normalizeName(null)).toBe(null);
      expect(normalizeName(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(normalizeName('')).toBe(null);
      expect(normalizeName('   ')).toBe(null);
    });

    it('should handle hyphenated names', () => {
      expect(normalizeName('mary-jane watson')).toBe('Mary-jane Watson');
      expect(normalizeName('jean-luc picard')).toBe('Jean-luc Picard');
    });

    it('should handle names with apostrophes', () => {
      expect(normalizeName("o'brien")).toBe("O'brien");
      expect(normalizeName("d'angelo")).toBe("D'angelo");
    });
  });

  describe('normalizeEducationLevel', () => {
    describe('Bachelor\'s degree variations', () => {
      it('should normalize bachelor variations', () => {
        expect(normalizeEducationLevel('Bachelor of Science')).toBe("Bachelor's");
        expect(normalizeEducationLevel('Bachelor of Arts')).toBe("Bachelor's");
        expect(normalizeEducationLevel('bachelor')).toBe("Bachelor's");
      });

      it('should normalize B.S. variations', () => {
        expect(normalizeEducationLevel('B.S. Computer Science')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.S Computer Science')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BS Computer Science')).toBe("Bachelor's");
      });

      it('should normalize B.A. variations', () => {
        expect(normalizeEducationLevel('B.A. Economics')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.A Economics')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BA Economics')).toBe("Bachelor's");
      });

      it('should normalize B.Tech and B.E. variations', () => {
        expect(normalizeEducationLevel('B.Tech')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B-Tech')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BTech')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.E.')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.E')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BE')).toBe("Bachelor's");
      });

      it('should normalize other bachelor variations', () => {
        expect(normalizeEducationLevel('B.Eng')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BEng')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.Com')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BCom')).toBe("Bachelor's");
        expect(normalizeEducationLevel('B.Sc')).toBe("Bachelor's");
        expect(normalizeEducationLevel('BSc')).toBe("Bachelor's");
      });
    });

    describe('Master\'s degree variations', () => {
      it('should normalize master variations', () => {
        expect(normalizeEducationLevel('Master of Science')).toBe("Master's");
        expect(normalizeEducationLevel('Master of Arts')).toBe("Master's");
        expect(normalizeEducationLevel('master')).toBe("Master's");
      });

      it('should normalize M.S. variations', () => {
        expect(normalizeEducationLevel('M.S. Computer Science')).toBe("Master's");
        expect(normalizeEducationLevel('M.S Computer Science')).toBe("Master's");
        expect(normalizeEducationLevel('MS Computer Science')).toBe("Master's");
      });

      it('should normalize M.A. variations', () => {
        expect(normalizeEducationLevel('M.A. Economics')).toBe("Master's");
        expect(normalizeEducationLevel('M.A Economics')).toBe("Master's");
        expect(normalizeEducationLevel('MA Economics')).toBe("Master's");
      });

      it('should normalize MBA', () => {
        expect(normalizeEducationLevel('MBA')).toBe("Master's");
        expect(normalizeEducationLevel('Master of Business Administration')).toBe("Master's");
      });

      it('should normalize other master variations', () => {
        expect(normalizeEducationLevel('M.Ed')).toBe("Master's");
        expect(normalizeEducationLevel('MFA')).toBe("Master's");
      });
    });

    describe('Ph.D. and Doctorate variations', () => {
      it('should normalize Ph.D. variations to Master\'s', () => {
        expect(normalizeEducationLevel('Ph.D.')).toBe("Master's");
        expect(normalizeEducationLevel('PhD')).toBe("Master's");
        expect(normalizeEducationLevel('Ph.D Computer Science')).toBe("Master's");
      });

      it('should normalize doctorate variations', () => {
        expect(normalizeEducationLevel('Doctorate')).toBe("Master's");
        expect(normalizeEducationLevel('Doctoral')).toBe("Master's");
        expect(normalizeEducationLevel('Doctoral Degree')).toBe("Master's");
      });
    });

    describe('High school variations', () => {
      it('should normalize high school variations', () => {
        expect(normalizeEducationLevel('High School')).toBe('Highschool');
        expect(normalizeEducationLevel('HighSchool')).toBe('Highschool');
        expect(normalizeEducationLevel('high school diploma')).toBe('Highschool');
      });

      it('should normalize secondary school', () => {
        expect(normalizeEducationLevel('Secondary School')).toBe('Highschool');
        expect(normalizeEducationLevel('secondary education')).toBe('Highschool');
      });

      it('should normalize diploma without degree keywords', () => {
        expect(normalizeEducationLevel('Diploma')).toBe('Highschool');
        expect(normalizeEducationLevel('High School Diploma')).toBe('Highschool');
      });

      it('should not normalize diploma with bachelor/master keywords', () => {
        expect(normalizeEducationLevel('Bachelor\'s Diploma')).toBe("Bachelor's");
        expect(normalizeEducationLevel('Master\'s Diploma')).toBe("Master's");
      });
    });

    describe('Edge cases and null handling', () => {
      it('should return null for null or undefined', () => {
        expect(normalizeEducationLevel(null)).toBe(null);
        expect(normalizeEducationLevel(undefined)).toBe(null);
      });

      it('should return null for empty string', () => {
        expect(normalizeEducationLevel('')).toBe(null);
        expect(normalizeEducationLevel('   ')).toBe(null);
      });

      it('should default unknown degrees to Bachelor\'s', () => {
        expect(normalizeEducationLevel('Some Random Degree')).toBe("Bachelor's");
        expect(normalizeEducationLevel('Associate')).toBe("Bachelor's");
      });

      it('should be case-insensitive', () => {
        expect(normalizeEducationLevel('BACHELOR OF SCIENCE')).toBe("Bachelor's");
        expect(normalizeEducationLevel('master of science')).toBe("Master's");
        expect(normalizeEducationLevel('HIGH SCHOOL')).toBe('Highschool');
      });

      it('should trim whitespace', () => {
        expect(normalizeEducationLevel('  B.S.  ')).toBe("Bachelor's");
        expect(normalizeEducationLevel('\tM.S.\n')).toBe("Master's");
      });
    });
  });

  describe('normalizeUniversityName', () => {
    describe('Common US university abbreviations', () => {
      it('should expand MIT', () => {
        expect(normalizeUniversityName('MIT')).toBe('Massachusetts Institute of Technology');
        expect(normalizeUniversityName('mit')).toBe('Massachusetts Institute of Technology');
      });

      it('should expand Stanford', () => {
        expect(normalizeUniversityName('Stanford')).toBe('Stanford University');
        expect(normalizeUniversityName('stanford')).toBe('Stanford University');
      });

      it('should expand CMU', () => {
        expect(normalizeUniversityName('CMU')).toBe('Carnegie Mellon University');
        expect(normalizeUniversityName('Carnegie Mellon')).toBe('Carnegie Mellon University');
      });

      it('should expand Caltech', () => {
        expect(normalizeUniversityName('Caltech')).toBe('California Institute of Technology');
        expect(normalizeUniversityName('Cal Tech')).toBe('California Institute of Technology');
      });
    });

    describe('UC system abbreviations', () => {
      it('should expand UCSD', () => {
        expect(normalizeUniversityName('UCSD')).toBe('University of California, San Diego');
      });

      it('should expand UCLA', () => {
        expect(normalizeUniversityName('UCLA')).toBe('University of California, Los Angeles');
      });

      it('should expand UC Berkeley', () => {
        expect(normalizeUniversityName('UC Berkeley')).toBe('University of California, Berkeley');
        expect(normalizeUniversityName('UCB')).toBe('University of California, Berkeley');
      });

      it('should expand other UC schools', () => {
        expect(normalizeUniversityName('UCI')).toBe('University of California, Irvine');
        expect(normalizeUniversityName('UCSB')).toBe('University of California, Santa Barbara');
        expect(normalizeUniversityName('UCD')).toBe('University of California, Davis');
      });
    });

    describe('Ivy League abbreviations', () => {
      it('should expand Ivy League schools', () => {
        expect(normalizeUniversityName('Harvard')).toBe('Harvard University');
        expect(normalizeUniversityName('Yale')).toBe('Yale University');
        expect(normalizeUniversityName('Princeton')).toBe('Princeton University');
        expect(normalizeUniversityName('Columbia')).toBe('Columbia University');
        expect(normalizeUniversityName('Cornell')).toBe('Cornell University');
        expect(normalizeUniversityName('Brown')).toBe('Brown University');
        expect(normalizeUniversityName('Dartmouth')).toBe('Dartmouth College');
      });

      it('should expand Penn variations', () => {
        expect(normalizeUniversityName('UPenn')).toBe('University of Pennsylvania');
        expect(normalizeUniversityName('U Penn')).toBe('University of Pennsylvania');
        expect(normalizeUniversityName('Penn')).toBe('University of Pennsylvania');
      });
    });

    describe('Other top US universities', () => {
      it('should expand major universities', () => {
        expect(normalizeUniversityName('NYU')).toBe('New York University');
        expect(normalizeUniversityName('Duke')).toBe('Duke University');
        expect(normalizeUniversityName('Northwestern')).toBe('Northwestern University');
        expect(normalizeUniversityName('Georgetown')).toBe('Georgetown University');
      });

      it('should expand state school abbreviations', () => {
        expect(normalizeUniversityName('UIUC')).toBe('University of Illinois Urbana-Champaign');
        expect(normalizeUniversityName('UMich')).toBe('University of Michigan');
        expect(normalizeUniversityName('UW')).toBe('University of Washington');
        expect(normalizeUniversityName('Gatech')).toBe('Georgia Institute of Technology');
        expect(normalizeUniversityName('Georgia Tech')).toBe('Georgia Institute of Technology');
      });
    });

    describe('International universities', () => {
      it('should expand Canadian universities', () => {
        expect(normalizeUniversityName('UWaterloo')).toBe('University of Waterloo');
        expect(normalizeUniversityName('Waterloo')).toBe('University of Waterloo');
        expect(normalizeUniversityName('UBC')).toBe('University of British Columbia');
        expect(normalizeUniversityName('McGill')).toBe('McGill University');
        expect(normalizeUniversityName('U of T')).toBe('University of Toronto');
      });

      it('should expand UK universities', () => {
        expect(normalizeUniversityName('Oxford')).toBe('University of Oxford');
        expect(normalizeUniversityName('Cambridge')).toBe('University of Cambridge');
        expect(normalizeUniversityName('LSE')).toBe('London School of Economics');
        expect(normalizeUniversityName('Imperial')).toBe('Imperial College London');
        expect(normalizeUniversityName('UCL')).toBe('University College London');
      });

      it('should expand European universities', () => {
        expect(normalizeUniversityName('ETH')).toBe('ETH Zurich');
        expect(normalizeUniversityName('ETH Zurich')).toBe('ETH Zurich');
        expect(normalizeUniversityName('EPFL')).toBe('EPFL');
      });

      it('should expand Indian universities', () => {
        expect(normalizeUniversityName('IITB')).toBe('Indian Institute of Technology, Bombay');
        expect(normalizeUniversityName('IIT Bombay')).toBe('Indian Institute of Technology, Bombay');
        expect(normalizeUniversityName('IITD')).toBe('Indian Institute of Technology, Delhi');
        expect(normalizeUniversityName('IIT Delhi')).toBe('Indian Institute of Technology, Delhi');
        expect(normalizeUniversityName('BITS')).toBe('BITS Pilani');
        expect(normalizeUniversityName('BITS Pilani')).toBe('BITS Pilani');
      });

      it('should expand Asian universities', () => {
        expect(normalizeUniversityName('NUS')).toBe('National University of Singapore');
        expect(normalizeUniversityName('NTU')).toBe('Nanyang Technological University');
        expect(normalizeUniversityName('Tsinghua')).toBe('Tsinghua University');
      });
    });

    describe('Edge cases and fallback', () => {
      it('should title case unknown universities', () => {
        expect(normalizeUniversityName('random university')).toBe('Random University');
        expect(normalizeUniversityName('ANOTHER COLLEGE')).toBe('Another College');
      });

      it('should preserve already full names', () => {
        expect(normalizeUniversityName('University of California')).toBe('University of California');
        expect(normalizeUniversityName('Harvard University')).toBe('Harvard University');
        expect(normalizeUniversityName('Dartmouth College')).toBe('Dartmouth College');
      });

      it('should return null for null or undefined', () => {
        expect(normalizeUniversityName(null)).toBe(null);
        expect(normalizeUniversityName(undefined)).toBe(null);
      });

      it('should return null for empty string', () => {
        expect(normalizeUniversityName('')).toBe(null);
        expect(normalizeUniversityName('   ')).toBe(null);
      });

      it('should be case-insensitive for abbreviations', () => {
        expect(normalizeUniversityName('mit')).toBe('Massachusetts Institute of Technology');
        expect(normalizeUniversityName('MIT')).toBe('Massachusetts Institute of Technology');
        expect(normalizeUniversityName('Mit')).toBe('Massachusetts Institute of Technology');
      });

      it('should trim whitespace', () => {
        expect(normalizeUniversityName('  MIT  ')).toBe('Massachusetts Institute of Technology');
      });

      it('should title case non-matched names', () => {
        expect(normalizeUniversityName('local community college')).toBe('Local Community College');
        expect(normalizeUniversityName('city university')).toBe('City University');
      });
    });
  });

  describe('normalizeJobType', () => {
    it('should normalize full-time variations', () => {
      expect(normalizeJobType('full-time')).toBe('full-time');
      expect(normalizeJobType('fulltime')).toBe('full-time');
      expect(normalizeJobType('full time')).toBe('full-time');
      expect(normalizeJobType('Full-Time')).toBe('full-time');
      expect(normalizeJobType('FULLTIME')).toBe('full-time');
    });

    it('should normalize part-time variations', () => {
      expect(normalizeJobType('part-time')).toBe('part-time');
      expect(normalizeJobType('parttime')).toBe('part-time');
      expect(normalizeJobType('part time')).toBe('part-time');
      expect(normalizeJobType('Part-Time')).toBe('part-time');
      expect(normalizeJobType('PARTTIME')).toBe('part-time');
    });

    it('should normalize internship variations', () => {
      expect(normalizeJobType('internship')).toBe('internship');
      expect(normalizeJobType('intern')).toBe('internship');
      expect(normalizeJobType('Internship')).toBe('internship');
      expect(normalizeJobType('INTERN')).toBe('internship');
    });

    it('should return null for unknown job types', () => {
      let consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(normalizeJobType('contract')).toBe(null);
      expect(normalizeJobType('freelance')).toBe(null);
      expect(normalizeJobType('temporary')).toBe(null);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown job type')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return null for null or undefined', () => {
      expect(normalizeJobType(null)).toBe(null);
      expect(normalizeJobType(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(normalizeJobType('')).toBe(null);
      expect(normalizeJobType('   ')).toBe(null);
    });

    it('should trim whitespace', () => {
      expect(normalizeJobType('  full-time  ')).toBe('full-time');
      expect(normalizeJobType('\tinternship\n')).toBe('internship');
    });
  });

  describe('normalizeMajor', () => {
    it('should remove B.S. in prefix', () => {
      expect(normalizeMajor('B.S. in Computer Science')).toBe('Computer Science');
      expect(normalizeMajor('B.S in Computer Science')).toBe('Computer Science');
      expect(normalizeMajor('BS in Computer Science')).toBe('Computer Science');
    });

    it('should remove B.A. in prefix', () => {
      expect(normalizeMajor('B.A. in Economics')).toBe('Economics');
      expect(normalizeMajor('B.A in Economics')).toBe('Economics');
      expect(normalizeMajor('BA in Economics')).toBe('Economics');
    });

    it('should remove B.Tech prefix', () => {
      expect(normalizeMajor('B.Tech in Mechanical Engineering')).toBe('Mechanical Engineering');
      expect(normalizeMajor('BTech in Electrical Engineering')).toBe('Electrical Engineering');
    });

    it('should remove B.E. prefix', () => {
      expect(normalizeMajor('B.E. in Civil Engineering')).toBe('Civil Engineering');
      expect(normalizeMajor('B.E in Computer Engineering')).toBe('Computer Engineering');
    });

    it('should remove Master of Science prefix', () => {
      expect(normalizeMajor('Master of Science in Computer Science')).toBe('Computer Science');
      expect(normalizeMajor('Master of Science Computer Science')).toBe('Computer Science');
    });

    it('should remove M.S. prefix', () => {
      expect(normalizeMajor('M.S. in Artificial Intelligence')).toBe('Artificial Intelligence');
      expect(normalizeMajor('MS in Machine Learning')).toBe('Machine Learning');
    });

    it('should remove M.A. prefix', () => {
      expect(normalizeMajor('M.A. in Psychology')).toBe('Psychology');
      expect(normalizeMajor('MA in Sociology')).toBe('Sociology');
    });

    it('should remove Bachelor of Science/Arts prefix', () => {
      expect(normalizeMajor('Bachelor of Science in Physics')).toBe('Physics');
      expect(normalizeMajor('Bachelor of Arts in History')).toBe('History');
      expect(normalizeMajor('Bachelor of Engineering in Robotics')).toBe('Robotics');
    });

    it('should remove other common prefixes', () => {
      expect(normalizeMajor('Degree in Mathematics')).toBe('Mathematics');
      expect(normalizeMajor('Major in Biology')).toBe('Biology');
      expect(normalizeMajor('Concentration in Finance')).toBe('Finance');
      expect(normalizeMajor('Specialization in Data Science')).toBe('Data Science');
    });

    it('should title case the result', () => {
      expect(normalizeMajor('COMPUTER SCIENCE')).toBe('Computer Science');
      expect(normalizeMajor('electrical engineering')).toBe('Electrical Engineering');
      expect(normalizeMajor('business administration')).toBe('Business Administration');
    });

    it('should handle majors without prefixes', () => {
      expect(normalizeMajor('Computer Science')).toBe('Computer Science');
      expect(normalizeMajor('Mathematics')).toBe('Mathematics');
      expect(normalizeMajor('physics')).toBe('Physics');
    });

    it('should return null for null or undefined', () => {
      expect(normalizeMajor(null)).toBe(null);
      expect(normalizeMajor(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(normalizeMajor('')).toBe(null);
      expect(normalizeMajor('   ')).toBe(null);
    });

    it('should trim whitespace', () => {
      expect(normalizeMajor('  Computer Science  ')).toBe('Computer Science');
    });

    it('should handle complex major names', () => {
      expect(normalizeMajor('B.S. in Computer Science and Mathematics')).toBe('Computer Science and Mathematics');
      expect(normalizeMajor('Master of Science in Electrical Engineering and Computer Science')).toBe('Electrical Engineering and Computer Science');
    });

    it('should be case-insensitive for prefixes', () => {
      expect(normalizeMajor('B.S. IN COMPUTER SCIENCE')).toBe('Computer Science');
      expect(normalizeMajor('bachelor of science in physics')).toBe('Physics');
    });
  });

  describe('Integration scenarios', () => {
    it('should consistently normalize candidate data', () => {
      const candidate1 = {
        name: 'john doe',
        education_level: 'B.S. Computer Science',
        university: 'MIT',
        job_type: 'fulltime'
      };

      const candidate2 = {
        name: 'JOHN DOE',
        education_level: 'Bachelor of Science',
        university: 'Massachusetts Institute of Technology',
        job_type: 'full-time'
      };

      // After normalization, these should match
      expect(normalizeName(candidate1.name)).toBe(normalizeName(candidate2.name));
      expect(normalizeEducationLevel(candidate1.education_level)).toBe(normalizeEducationLevel(candidate2.education_level));
      expect(normalizeUniversityName(candidate1.university)).toBe(normalizeUniversityName(candidate2.university));
      expect(normalizeJobType(candidate1.job_type)).toBe(normalizeJobType(candidate2.job_type));
    });

    it('should prevent duplicate candidates through normalization', () => {
      const variations = [
        { name: 'jane smith', university: 'stanford', degree: 'B.S.' },
        { name: 'Jane Smith', university: 'Stanford', degree: "Bachelor's" },
        { name: 'JANE SMITH', university: 'Stanford University', degree: 'Bachelor of Science' }
      ];

      const normalized = variations.map(v => ({
        name: normalizeName(v.name),
        university: normalizeUniversityName(v.university),
        degree: normalizeEducationLevel(v.degree)
      }));

      // All should normalize to the same values
      expect(normalized[0]).toEqual(normalized[1]);
      expect(normalized[1]).toEqual(normalized[2]);
    });
  });
});
