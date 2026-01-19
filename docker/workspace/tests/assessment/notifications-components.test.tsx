/**
 * Frontend Component Tests - 40 points (Phase 1)
 * Tests the notification UI components
 *
 * COMPATIBILITY:
 * - V1: Tests pass immediately (components implemented with hints)
 * - V2: Tests fail initially, pass once candidate implements components
 *
 * Same tests work for both versions - only the implementation differs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';

// Mock the useNotifications hook
const mockNotifications = [
  {
    id: '1',
    type: 'info' as const,
    title: 'Test Notification',
    message: 'This is a test message',
    read: false,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    type: 'success' as const,
    title: 'Read Notification',
    message: 'This notification is read',
    read: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

const mockUseNotifications = {
  notifications: mockNotifications,
  unreadCount: 1,
  loading: false,
  fetchNotifications: vi.fn(),
  markAsRead: vi.fn(),
};

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => mockUseNotifications,
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  })),
}));

describe('Frontend Component Tests - Notifications UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.unreadCount = 1;
    mockUseNotifications.notifications = mockNotifications;
  });

  describe('NotificationBell Component', () => {
    it('should render bell icon (5 pts)', () => {
      render(<NotificationBell />);

      // Look for the bell button
      const bellButton = screen.getByRole('button');
      expect(bellButton).toBeInTheDocument();
    });

    it('should show badge with unread count (10 pts)', () => {
      render(<NotificationBell />);

      // Check if badge displays the count
      const badge = screen.getByText('1');
      expect(badge).toBeInTheDocument();
    });

    it('should hide badge when count is 0 (5 pts)', () => {
      mockUseNotifications.unreadCount = 0;

      render(<NotificationBell />);

      // Badge should not be in the document
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('NotificationDropdown Component', () => {
    it('should render notification list (10 pts)', () => {
      render(<NotificationDropdown />);

      // Check if notifications are displayed
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('Read Notification')).toBeInTheDocument();
    });

    it('should show different styling for read/unread (5 pts)', () => {
      const { container } = render(<NotificationDropdown />);

      // Check that items have different opacity classes
      const items = container.querySelectorAll('[class*="opacity"]');
      expect(items.length).toBeGreaterThan(0);

      // Verify at least one unread and one read notification
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('Read Notification')).toBeInTheDocument();
    });

    it('should call markAsRead when mark button clicked (5 pts)', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      // Find and click the mark as read button (Check icon)
      const markButtons = screen.getAllByRole('button');
      const markReadButton = markButtons.find(
        btn => btn.getAttribute('title') === 'Mark as read'
      );

      if (markReadButton) {
        await user.click(markReadButton);

        await waitFor(() => {
          expect(mockUseNotifications.markAsRead).toHaveBeenCalledWith('1');
        });
      }
    });

    it('should show empty state when no notifications (bonus)', () => {
      mockUseNotifications.notifications = [];

      render(<NotificationDropdown />);

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });
});

/**
 * Score Summary:
 * - Bell icon renders: 5 pts
 * - Badge shows unread count: 10 pts
 * - Badge hidden when count = 0: 5 pts
 * - Dropdown renders notification list: 10 pts
 * - Read/unread styling different: 5 pts
 * - Mark as read button works: 5 pts
 * Total: 40 points
 */
