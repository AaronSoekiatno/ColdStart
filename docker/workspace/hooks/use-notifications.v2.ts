/**
 * useNotifications Hook
 * Manages notification state and real-time updates
 *
 * REQUIREMENTS:
 * - Fetch notifications from API on mount
 * - Subscribe to real-time updates (INSERT/UPDATE events)
 * - Provide markAsRead function for user actions
 * - Track unread count reactively
 * - Clean up subscriptions on unmount
 *
 * TODO: Implement this hook
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Notification } from '@/lib/types/notification';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // TODO: Implement fetchNotifications
  // Requirements:
  // - Call GET /api/notifications
  // - Update notifications and unreadCount state
  // - Handle loading state
  // - Handle errors gracefully
  const fetchNotifications = useCallback(async () => {
    throw new Error('Not implemented');
  }, []);

  // TODO: Implement markAsRead
  // Requirements:
  // - Optimistically update UI (mark as read immediately)
  // - Call POST /api/notifications/:id/mark-read
  // - Refresh from server to confirm (Phase 3 trap is here 🪤)
  // - Handle errors (revert optimistic update on failure)
  const markAsRead = useCallback(async (id: string) => {
    throw new Error('Not implemented');
  }, []);

  useEffect(() => {
    // TODO: Implement real-time subscription
    // Requirements:
    // - Call fetchNotifications on mount
    // - Subscribe to Supabase Realtime channel
    // - Handle INSERT events (new notifications)
    // - Handle UPDATE events (notification state changes)
    // - Unsubscribe on unmount (prevent memory leaks 🪤)
    //
    // Realtime subscription pattern:
    // const channel = supabase
    //   .channel('channel-name')
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, callback)
    //   .subscribe();
    //
    // return () => { /* cleanup */ };

    fetchNotifications();

    // TODO: Add Realtime subscription here

    return () => {
      // TODO: Cleanup subscriptions
    };
  }, [fetchNotifications]);

  // Recalculate unread count when notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
  };
}
