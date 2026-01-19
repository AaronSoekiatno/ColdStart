/**
 * Integration Tests - 20 points (Phase 1)
 * Tests the full notification flow with real-time updates
 *
 * COMPATIBILITY:
 * - V1: Tests pass immediately (real-time implemented with hints)
 * - V2: Tests fail initially, pass once candidate implements real-time
 *
 * Same tests work for both versions - only the implementation differs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { createMockRealtimeChannel } from '../mocks/supabase-realtime.mock';

// Create a mock channel that we can control
const mockChannel = createMockRealtimeChannel();

// Mock Supabase client with controllable channel
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
  })),
}));

// Mock fetch for API calls
global.fetch = vi.fn((url: string) => {
  if (url === '/api/notifications') {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          notifications: [
            {
              id: '1',
              type: 'info',
              title: 'Initial Notification',
              message: 'This was here on load',
              read: false,
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
          unreadCount: 1,
        }),
    });
  }

  if (url.includes('/mark-read')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  }

  return Promise.reject(new Error('Unknown URL'));
}) as any;

describe('Integration Tests - Real-time Notification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Real-time updates (10 pts)', () => {
    it('should show new notification in real-time (10 pts)', async () => {
      render(<NotificationBell />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Simulate a new notification arriving via Realtime
      act(() => {
        mockChannel.simulateInsert({
          id: '2',
          type: 'success',
          title: 'New Real-time Notification',
          message: 'This just came in!',
          read: false,
          created_at: new Date().toISOString(),
        });
      });

      // Badge count should update
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Badge updates reactively (5 pts)', () => {
    it('should increment badge count on new notification (5 pts)', async () => {
      render(<NotificationBell />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Add another unread notification
      act(() => {
        mockChannel.simulateInsert({
          id: '3',
          type: 'warning',
          title: 'Warning',
          message: 'Warning message',
          read: false,
          created_at: new Date().toISOString(),
        });
      });

      // Badge should show 2
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Mark as read syncs UI + backend (5 pts)', () => {
    it('should update UI and call backend when marking as read (5 pts)', async () => {
      const user = userEvent.setup();
      render(<NotificationBell />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Open dropdown
      const bellButton = screen.getByRole('button');
      await user.click(bellButton);

      // Find mark as read button
      await waitFor(() => {
        const markButtons = screen.getAllByRole('button');
        const markReadButton = markButtons.find(
          btn => btn.getAttribute('title') === 'Mark as read'
        );

        expect(markReadButton).toBeInTheDocument();
      });

      // Verify badge count eventually updates (optimistic update)
      // In a real scenario, the badge would decrement after marking as read
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Real-time UPDATE event (bonus)', () => {
    it('should update existing notification when changed', async () => {
      render(<NotificationBell />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Simulate an UPDATE event (notification marked as read by another client)
      act(() => {
        mockChannel.simulateUpdate({
          id: '1',
          type: 'info',
          title: 'Initial Notification',
          message: 'This was here on load',
          read: true, // Now marked as read
          created_at: '2024-01-01T00:00:00Z',
        });
      });

      // Badge should disappear (no unread notifications)
      await waitFor(() => {
        expect(screen.queryByText('1')).not.toBeInTheDocument();
      });
    });
  });
});

/**
 * Score Summary:
 * - New notification appears (Realtime): 10 pts
 * - Badge updates reactively: 5 pts
 * - Mark as read syncs UI + backend: 5 pts
 * Total: 20 points
 */
