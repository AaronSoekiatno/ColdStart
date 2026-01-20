/**
 * Supabase Realtime Mock
 * Test utilities for mocking Supabase real-time subscriptions
 * 100% provided - No TODOs
 */

import { vi } from 'vitest';

export const createMockRealtimeChannel = () => {
  const callbacks = new Map<string, Function>();

  const channel = {
    on: vi.fn((event: string, config: any, callback: Function) => {
      const key = `${event}-${config.event}`;
      callbacks.set(key, callback);
      return channel;
    }),
    subscribe: vi.fn(() => 'SUBSCRIBED'),
    unsubscribe: vi.fn(),

    // Test helpers to simulate events
    simulateInsert: (payload: any) => {
      const cb = callbacks.get('postgres_changes-INSERT');
      if (cb) cb({ new: payload, eventType: 'INSERT' });
    },
    simulateUpdate: (payload: any) => {
      const cb = callbacks.get('postgres_changes-UPDATE');
      if (cb) cb({ new: payload, eventType: 'UPDATE' });
    },
  };

  return channel;
};

export const createMockSupabaseClient = () => {
  const channels = new Map<string, ReturnType<typeof createMockRealtimeChannel>>();

  return {
    channel: vi.fn((name: string) => {
      if (!channels.has(name)) {
        channels.set(name, createMockRealtimeChannel());
      }
      return channels.get(name);
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null,
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: {},
          error: null,
        })),
      })),
      order: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { email: 'test@example.com' } },
        error: null,
      })),
    },
    // Expose channels for test access
    _getChannel: (name: string) => channels.get(name),
  };
};
