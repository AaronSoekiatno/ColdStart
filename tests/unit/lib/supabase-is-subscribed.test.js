/**
 * Unit tests for isSubscribed function
 *
 * This is a CRITICAL test as isSubscribed() gates all premium features.
 * Tests all 10 combinations of subscription_tier and subscription_status
 * to ensure correct access control.
 *
 * Tested from: lib/supabase.ts lines 129-148
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock Supabase before importing the module
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({}))
}));

describe('isSubscribed', () => {
  let isSubscribed;
  let consoleWarnSpy;

  beforeAll(async () => {
    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    // Dynamically import after setting up mocks
    const module = await import('../../../lib/supabase.ts');
    isSubscribed = module.isSubscribed;
  });

  beforeEach(() => {
    // Spy on console.warn and clear it before each test
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Premium tier with valid statuses', () => {
    it('should return true for premium + active', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'active'
      };

      expect(isSubscribed(candidate)).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return true for premium + trialing', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'trialing'
      };

      expect(isSubscribed(candidate)).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Premium tier with invalid statuses', () => {
    it('should return false for premium + canceled', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'canceled'
      };

      expect(isSubscribed(candidate)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[isSubscribed] Premium tier detected but status is not active/trialing:',
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'canceled',
          result: false
        })
      );
    });

    it('should return false for premium + past_due', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'past_due'
      };

      expect(isSubscribed(candidate)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[isSubscribed] Premium tier detected but status is not active/trialing:',
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'past_due'
        })
      );
    });

    it('should return false for premium + inactive', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'inactive'
      };

      expect(isSubscribed(candidate)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[isSubscribed] Premium tier detected but status is not active/trialing:',
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'inactive'
        })
      );
    });
  });

  describe('Free tier with any status', () => {
    it('should return false for free + active', () => {
      const candidate = {
        subscription_tier: 'free',
        subscription_status: 'active'
      };

      expect(isSubscribed(candidate)).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return false for free + trialing', () => {
      const candidate = {
        subscription_tier: 'free',
        subscription_status: 'trialing'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for free + canceled', () => {
      const candidate = {
        subscription_tier: 'free',
        subscription_status: 'canceled'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for free + inactive', () => {
      const candidate = {
        subscription_tier: 'free',
        subscription_status: 'inactive'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for free + past_due', () => {
      const candidate = {
        subscription_tier: 'free',
        subscription_status: 'past_due'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });
  });

  describe('Missing or null values', () => {
    it('should return false for missing subscription_tier', () => {
      const candidate = {
        subscription_status: 'active'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for missing subscription_status', () => {
      const candidate = {
        subscription_tier: 'premium'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for null subscription_tier', () => {
      const candidate = {
        subscription_tier: null,
        subscription_status: 'active'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for null subscription_status', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: null
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should return false for empty object', () => {
      const candidate = {};

      expect(isSubscribed(candidate)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should be case-sensitive for subscription_tier', () => {
      const candidate = {
        subscription_tier: 'Premium', // Wrong case
        subscription_status: 'active'
      };

      expect(isSubscribed(candidate)).toBe(false);
    });

    it('should be case-sensitive for subscription_status', () => {
      const candidate = {
        subscription_tier: 'premium',
        subscription_status: 'Active' // Wrong case
      };

      expect(isSubscribed(candidate)).toBe(false);
    });
  });
});
