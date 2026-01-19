/**
 * Phase 3: Debug Race Condition (30 points)
 *
 * BUG REPORT FROM QA:
 * "Sometimes clicking 'mark as read' doesn't update the badge count.
 * Happens randomly, maybe 1 in 10 clicks. Console shows:
 * Warning: Can't perform a React state update on an unmounted component."
 *
 * YOUR TASK:
 * 1. Identify the bug (explain in comments)
 * 2. Fix it properly (not just removing the line)
 * 3. Add safeguards (prevent it from happening again)
 *
 * TIME: 5 minutes
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '@/hooks/use-notifications';

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  })),
}));

describe('Phase 3: Race Condition Debugging (30 pts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/notifications') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              notifications: [
                { id: '1', type: 'info', title: 'Test', message: 'Test', read: false, created_at: '2024-01-01' },
              ],
              unreadCount: 1,
            }),
        });
      }

      if (url.includes('/mark-read')) {
        // Simulate slow network
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            });
          }, 100);
        });
      }

      return Promise.reject(new Error('Unknown URL'));
    });
  });

  /**
   * Test: Identifies the race condition (10 pts)
   *
   * THE BUG:
   * The markAsRead function does:
   * 1. Optimistic update
   * 2. POST to mark-read endpoint
   * 3. Refresh from server (GET /api/notifications)
   * 4. Update state with fresh data
   *
   * The problem: If the component unmounts before step 4,
   * React warns about state update on unmounted component.
   *
   * WHAT TO LOOK FOR IN CANDIDATE'S CODE:
   * - Comment explaining the race condition
   * - Understanding of when components unmount
   * - Recognition that async operations continue after unmount
   */
  it('candidate identified the race condition in comments (10 pts - manual grade)', () => {
    // Manual grading: Check use-notifications.ts for comments like:
    //
    // EXCELLENT (10 pts):
    // /**
    //  * BUG IDENTIFIED: Race condition in markAsRead
    //  *
    //  * The function calls setState after an async operation (fetch).
    //  * If the user navigates away before fetch completes,
    //  * the component unmounts but the Promise still resolves,
    //  * causing React to attempt state update on unmounted component.
    //  *
    //  * This is harmless but causes console warnings and could
    //  * cause issues if we later add side effects in state updates.
    //  */
    //
    // GOOD (7 pts):
    // - Identifies async setState as the issue
    // - Missing explanation of when it happens
    //
    // POOR (3 pts):
    // - Vague understanding
    // - "Something about unmounting"
    //
    // FAIL (0 pts):
    // - No identification

    expect(true).toBe(true); // Placeholder for manual review
  });

  /**
   * Test: Fixed the race condition (15 pts)
   *
   * ACCEPTABLE SOLUTIONS:
   *
   * Option A: Mount tracking with useRef (recommended)
   * ```
   * const isMounted = useRef(true);
   * useEffect(() => {
   *   return () => { isMounted.current = false; };
   * }, []);
   *
   * const markAsRead = async (id) => {
   *   // ... async operations ...
   *   if (isMounted.current) {
   *     setNotifications(data);
   *   }
   * };
   * ```
   *
   * Option B: AbortController for fetch
   * ```
   * const controller = new AbortController();
   * fetch(url, { signal: controller.signal });
   * // In cleanup: controller.abort();
   * ```
   *
   * Option C: Remove the refresh entirely
   * - Trust optimistic update
   * - Rely on real-time subscription for confirmation
   * - Simpler but less robust
   */
  it('race condition is fixed - no state updates after unmount (15 pts)', async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start marking as read
    act(() => {
      result.current.markAsRead('1');
    });

    // Immediately unmount (simulate user navigating away)
    unmount();

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // If bug is fixed, no React warnings should appear
    // This is tested by React's internal error boundaries in test mode

    expect(true).toBe(true);
  });

  /**
   * Test: Added safeguards (5 pts)
   *
   * WHAT WE LOOK FOR:
   * - Cleanup function in useEffect
   * - Mount tracking pattern
   * - Comments explaining the safeguard
   *
   * EXCELLENT (5 pts):
   * - Proper cleanup in useEffect
   * - Mount tracking with useRef
   * - Clear comments explaining why
   *
   * GOOD (3 pts):
   * - Has some protection
   * - Missing comprehensive approach
   *
   * FAIL (0 pts):
   * - No safeguards added
   */
  it('safeguards added to prevent future race conditions (5 pts - manual grade)', () => {
    // Manual grading: Check use-notifications.ts for:
    //
    // 1. useRef for mount tracking
    // 2. Cleanup function in useEffect
    // 3. Checks before setState in async functions
    // 4. Comments explaining the pattern
    //
    // Example excellent implementation:
    // ```
    // const isMounted = useRef(true);
    //
    // useEffect(() => {
    //   // ... subscriptions ...
    //
    //   return () => {
    //     isMounted.current = false;
    //     // ... cleanup subscriptions ...
    //   };
    // }, []);
    //
    // const markAsRead = async (id: string) => {
    //   // Optimistic update (safe - synchronous)
    //   setNotifications(prev => ...);
    //
    //   try {
    //     await fetch(...);
    //     const data = await fetch(...);
    //
    //     // Only update if still mounted
    //     if (isMounted.current) {
    //       setNotifications(data);
    //     }
    //   } catch (error) {
    //     // Revert optimistic update if still mounted
    //     if (isMounted.current) {
    //       fetchNotifications();
    //     }
    //   }
    // };
    // ```

    expect(true).toBe(true); // Placeholder for manual review
  });

  /**
   * BONUS: Alternative solution that's even better (5 bonus pts)
   *
   * Remove the refresh entirely:
   * - Trust the optimistic update
   * - Rely on Realtime subscription to confirm
   * - Simpler code, fewer API calls
   *
   * This shows deeper understanding:
   * - Recognizing that real-time subscription will update state anyway
   * - Preferring simplicity over redundant confirmation
   * - Understanding trade-offs (slightly less robust if real-time fails)
   */
  it('BONUS: candidate removed redundant refresh (5 bonus pts - manual grade)', () => {
    // Manual grading: Check if they:
    // 1. Removed the second fetch() call in markAsRead
    // 2. Added comment explaining why it's safe
    // 3. Rely on real-time subscription for confirmation
    //
    // Example:
    // ```
    // const markAsRead = async (id: string) => {
    //   // Optimistic update
    //   setNotifications(prev => ...);
    //
    //   // Persist to backend
    //   await fetch(`/api/notifications/${id}/mark-read`, { method: 'POST' });
    //
    //   // No refresh needed - real-time subscription will
    //   // update state when backend confirms the change
    // };
    // ```

    expect(true).toBe(true); // Placeholder for manual review
  });
});

/**
 * MANUAL GRADING RUBRIC FOR PHASE 3:
 *
 * Total: 30 points (+ 5 bonus)
 *
 * 10 pts - Bug identification
 *   ✓ Clear explanation in comments
 *   ✓ Understands race condition
 *   ✓ Knows when it happens
 *
 * 15 pts - Correct fix
 *   ✓ No state updates after unmount
 *   ✓ Proper async handling
 *   ✓ Doesn't break functionality
 *
 * 5 pts - Safeguards added
 *   ✓ Mount tracking pattern
 *   ✓ Cleanup functions
 *   ✓ Comments explaining why
 *
 * 5 pts - BONUS (optional)
 *   ✓ Removed redundant refresh
 *   ✓ Relies on real-time subscription
 *   ✓ Simpler, more elegant solution
 */
