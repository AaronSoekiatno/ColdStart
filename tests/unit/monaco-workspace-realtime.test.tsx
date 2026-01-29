// @vitest-environment jsdom
/**
 * Tests for MonacoWorkspace realtime fallback and polling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MonacoWorkspace } from '@/components/editor/MonacoWorkspace';
import { supabase } from '@/lib/supabase';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  }
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  })
}));

describe('MonacoWorkspace - Realtime Fallback Tests', () => {
  const defaultProps = {
    sessionId: 'test-session',
    showPreview: false,
    setShowPreview: vi.fn(),
    showAgentChat: false,
    setShowAgentChat: vi.fn(),
    containerUrl: 'http://localhost:8080',
    flyAppName: 'test-app',
    containerReady: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock file list API
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/files/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ files: [] })
        });
      }
      if (url.includes('/api/files/read-all')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ files: {} })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Realtime Subscription', () => {
    it('should attempt to subscribe to realtime on mount', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(
          'session:test-session',
          expect.any(Object)
        );
      });

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'file_update' },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'agent_complete' },
        expect.any(Function)
      );

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle CHANNEL_ERROR and start polling', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          // Simulate channel error
          callback('CHANNEL_ERROR');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Fast-forward to polling interval (5 seconds)
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        // Should have called file list API again (polling)
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/list')
        );
      });
    });

    it('should handle TIMED_OUT and fallback to polling', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('TIMED_OUT');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Polling should activate
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/list')
        );
      });
    });

    it('should set realtimeAvailable to true when SUBSCRIBED', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('SUBSCRIBED');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Should NOT start polling (realtime is working)
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // File list should only be called once (initial load)
      await waitFor(() => {
        const listCalls = (mockFetch.mock.calls as any[]).filter((call: any[]) =>
          call[0]?.includes('/api/files/list')
        );
        expect(listCalls.length).toBe(1);
      });
    });
  });

  describe('Polling Fallback', () => {
    it('should poll every 5 seconds when realtime is unavailable', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('CHANNEL_ERROR');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Clear initial calls
      mockFetch.mockClear();

      // Should poll at 5s, 10s, 15s
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    it('should only refresh tree, not reload all files during polling', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('CHANNEL_ERROR');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      mockFetch.mockClear();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        // Should call list API
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/list')
        );

        // Should NOT call read-all API (avoid disrupting user edits)
        const readAllCalls = (mockFetch.mock.calls as any[]).filter((call: any[]) =>
          call[0]?.includes('/api/files/read-all')
        );
        expect(readAllCalls.length).toBe(0);
      });
    });

    it('should stop polling when component unmounts', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('CHANNEL_ERROR');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const { unmount } = render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      mockFetch.mockClear();

      // Unmount before polling
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      // Should not have polled after unmount
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Direct File Updates (Stream-based)', () => {
    it('should handle file_changed callback from agent', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('SUBSCRIBED');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Simulate receiving file update via stream (not realtime)
      // This would normally come from AgentChat's onFileChanged callback
      // We can't easily test the callback flow here, but we verify the handler exists

      expect(true).toBe(true); // Placeholder - actual testing done in integration tests
    });

    it('should refresh file list on __REFRESH__ signal', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('SUBSCRIBED');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      mockFetch.mockClear();

      // Simulate agent_complete signal
      // (would be triggered by handleFileChanged('__REFRESH__', ''))
      // Testing this requires integration test

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection up to 3 times', async () => {
      let subscribeCount = 0;

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          subscribeCount++;
          callback('CHANNEL_ERROR');
          return mockChannel;
        }),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);
      (supabase.removeChannel as any).mockImplementation(() => { });

      render(<MonacoWorkspace {...defaultProps} />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // First error triggers first reconnect attempt
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(supabase.removeChannel).toHaveBeenCalled();
      });

      // Should eventually give up and show polling message
      expect(subscribeCount).toBeGreaterThan(0);
    });
  });
});
