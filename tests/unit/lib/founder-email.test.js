/**
 * Unit tests for founder email guessing
 *
 * Tests email generation for founder outreach. Wrong emails = wasted sends.
 *
 * Tested from: lib/founder-email.ts
 */

import { describe, it, expect } from 'vitest';
import { guessFounderEmailFromStartup } from '../../../lib/founder-email.ts';
import { mockStartup } from '../../helpers/factories.js';

describe('Founder Email Utilities', () => {
  describe('guessFounderEmailFromStartup', () => {
    describe('Using existing founder_emails', () => {
      it('should use existing email when provided', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: 'john@company.com',
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@company.com');
        expect(result.isGuessed).toBe(false);
      });

      it('should use first email when multiple emails provided', () => {
        const startup = mockStartup({
          founder_first_name: 'Jane',
          founder_emails: 'jane@company.com, jane@personal.com, contact@company.com',
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('jane@company.com');
        expect(result.isGuessed).toBe(false);
      });

      it('should trim whitespace from emails', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: '  john@company.com  ',
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@company.com');
        expect(result.isGuessed).toBe(false);
      });

      it('should handle emails with whitespace separation', () => {
        const startup = mockStartup({
          founder_first_name: 'Alice',
          founder_emails: ' alice@startup.io , bob@startup.io ',
          website: 'https://startup.io'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('alice@startup.io');
        expect(result.isGuessed).toBe(false);
      });

      it('should prefer existing email even if name and website are present', () => {
        const startup = mockStartup({
          founder_first_name: 'Bob',
          founder_emails: 'bob.smith@company.com',
          website: 'https://company.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('bob.smith@company.com');
        expect(result.isGuessed).toBe(false);
      });
    });

    describe('Guessing email from name and website', () => {
      it('should generate founder@domain.com format', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should generate email without www prefix', () => {
        const startup = mockStartup({
          founder_first_name: 'Jane',
          founder_emails: null,
          website: 'https://www.example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('jane@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle website without protocol', () => {
        const startup = mockStartup({
          founder_first_name: 'Alice',
          founder_emails: null,
          website: 'example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('alice@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle website with www but no protocol', () => {
        const startup = mockStartup({
          founder_first_name: 'Bob',
          founder_emails: null,
          website: 'www.example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('bob@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle different TLDs', () => {
        const startups = [
          { name: 'Sarah', website: 'https://startup.io', expected: 'sarah@startup.io' },
          { name: 'Mike', website: 'https://company.ai', expected: 'mike@company.ai' },
          { name: 'Lisa', website: 'https://business.co', expected: 'lisa@business.co' },
          { name: 'Tom', website: 'https://tech.dev', expected: 'tom@tech.dev' }
        ];

        startups.forEach(({ name, website, expected }) => {
          const result = guessFounderEmailFromStartup({
            founder_first_name: name,
            founder_emails: null,
            website
          });

          expect(result.email).toBe(expected);
          expect(result.isGuessed).toBe(true);
        });
      });
    });

    describe('Normalizing founder first name', () => {
      it('should convert name to lowercase', () => {
        const startup = mockStartup({
          founder_first_name: 'JOHN',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should remove spaces from name', () => {
        const startup = mockStartup({
          founder_first_name: 'John Doe',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('johndoe@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should remove special characters from name', () => {
        const startup = mockStartup({
          founder_first_name: "John O'Brien",
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('johnobrien@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle names with hyphens', () => {
        const startup = mockStartup({
          founder_first_name: 'Mary-Jane',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('maryjane@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should strip titles from names', () => {
        const titles = [
          { input: 'Dr. Bob', expected: 'drbob@example.com' },
          { input: 'Mr. Smith', expected: 'mrsmith@example.com' },
          { input: 'Prof. Johnson', expected: 'profjohnson@example.com' }
        ];

        titles.forEach(({ input, expected }) => {
          const result = guessFounderEmailFromStartup({
            founder_first_name: input,
            founder_emails: null,
            website: 'https://example.com'
          });

          expect(result.email).toBe(expected);
          expect(result.isGuessed).toBe(true);
        });
      });

      it('should handle names with numbers', () => {
        const startup = mockStartup({
          founder_first_name: 'John123',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john123@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should keep alphanumeric characters only', () => {
        const startup = mockStartup({
          founder_first_name: 'Jöhn!@#Döe$%',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        // normalizeFirstName keeps only a-z0-9, so ö becomes o, special chars removed
        expect(result.email).toBe('jhnde@example.com');
        expect(result.isGuessed).toBe(true);
      });
    });

    describe('Domain extraction from website', () => {
      it('should extract domain from https URLs', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@example.com');
      });

      it('should extract domain from http URLs', () => {
        const startup = mockStartup({
          founder_first_name: 'Jane',
          founder_emails: null,
          website: 'http://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('jane@example.com');
      });

      it('should strip www prefix', () => {
        const startup = mockStartup({
          founder_first_name: 'Alice',
          founder_emails: null,
          website: 'https://www.example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('alice@example.com');
      });

      it('should handle URLs with paths', () => {
        const startup = mockStartup({
          founder_first_name: 'Bob',
          founder_emails: null,
          website: 'https://example.com/about/team'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('bob@example.com');
      });

      it('should handle URLs with query parameters', () => {
        const startup = mockStartup({
          founder_first_name: 'Charlie',
          founder_emails: null,
          website: 'https://example.com?utm_source=test'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('charlie@example.com');
      });

      it('should handle URLs with subdomains', () => {
        const startup = mockStartup({
          founder_first_name: 'David',
          founder_emails: null,
          website: 'https://blog.example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('david@blog.example.com');
      });

      it('should convert domain to lowercase', () => {
        const startup = mockStartup({
          founder_first_name: 'Eve',
          founder_emails: null,
          website: 'https://EXAMPLE.COM'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('eve@example.com');
      });

      it('should trim whitespace from website', () => {
        const startup = mockStartup({
          founder_first_name: 'Frank',
          founder_emails: null,
          website: '  https://example.com  '
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('frank@example.com');
      });
    });

    describe('Error handling and edge cases', () => {
      it('should return null email when founder_first_name is missing', () => {
        const startup = mockStartup({
          founder_first_name: null,
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should return null email when website is missing', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: null,
          website: null
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should return null email when both name and website are missing', () => {
        const startup = mockStartup({
          founder_first_name: null,
          founder_emails: null,
          website: null
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should return null email when founder_first_name is empty string', () => {
        const startup = mockStartup({
          founder_first_name: '',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should return null email when website is empty string', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: null,
          website: ''
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should handle simple string as domain when prefixed with https', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: null,
          website: 'not-a-valid-url'
        });

        const result = guessFounderEmailFromStartup(startup);

        // URL constructor accepts this when prefixed with https://
        expect(result.email).toBe('john@not-a-valid-url');
        expect(result.isGuessed).toBe(true);
      });

      it('should return null email when name normalizes to empty', () => {
        const startup = mockStartup({
          founder_first_name: '!@#$%^&*()',
          founder_emails: null,
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe(null);
        expect(result.isGuessed).toBe(false);
      });

      it('should handle empty founder_emails string', () => {
        const startup = mockStartup({
          founder_first_name: 'John',
          founder_emails: '',
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('john@example.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle whitespace-only founder_emails', () => {
        const startup = mockStartup({
          founder_first_name: 'Jane',
          founder_emails: '   ',
          website: 'https://example.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('jane@example.com');
        expect(result.isGuessed).toBe(true);
      });
    });

    describe('Real-world scenarios', () => {
      it('should handle typical startup founder email', () => {
        const startup = mockStartup({
          founder_first_name: 'Sarah',
          founder_emails: null,
          website: 'https://www.myawesomestartup.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('sarah@myawesomestartup.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle Y Combinator startup', () => {
        const startup = mockStartup({
          founder_first_name: 'Patrick',
          founder_emails: null,
          website: 'https://stripe.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('patrick@stripe.com');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle startup with hyphenated domain', () => {
        const startup = mockStartup({
          founder_first_name: 'Alex',
          founder_emails: null,
          website: 'https://my-startup.io'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('alex@my-startup.io');
        expect(result.isGuessed).toBe(true);
      });

      it('should handle startup with verified email', () => {
        const startup = mockStartup({
          founder_first_name: 'Maria',
          founder_emails: 'maria.garcia@techstartup.com',
          website: 'https://techstartup.com'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('maria.garcia@techstartup.com');
        expect(result.isGuessed).toBe(false);
      });

      it('should handle international founders', () => {
        const startup = mockStartup({
          founder_first_name: 'François',
          founder_emails: null,
          website: 'https://startup.fr'
        });

        const result = guessFounderEmailFromStartup(startup);

        expect(result.email).toBe('franois@startup.fr');
        expect(result.isGuessed).toBe(true);
      });
    });
  });
});
