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
  //
  // 🪤 TRAP 1: Are you checking if component is still mounted before setState?
  // What happens if the component unmounts while the fetch is in progress?
  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    const response = await fetch('/api/notifications');
    const data = await response.json();

    // TODO: Update state with fetched data
    // setNotifications(data.notifications);
    // setUnreadCount(data.unreadCount);
    // setLoading(false);

    throw new Error('Complete this implementation');
  }, []);

  // TODO: Implement markAsRead
  // Requirements:
  // - Optimistically update UI (mark as read immediately)
  // - Call POST /api/notifications/:id/mark-read
  // - Refresh from server to confirm
  // - Handle errors (revert optimistic update on failure)
  //
  // 🪤 TRAP 2: Do you really need to "refresh from server to confirm"?
  // You have real-time subscriptions... won't that cause a race condition?
  // Think about the order of events:
  //   1. Optimistic update (setState)
  //   2. API call completes (database UPDATE)
  //   3. Real-time UPDATE event fires (setState)
  //   4. Your "refresh" fetch completes (setState)
  // Which setState wins? What if component unmounts between steps?
  const markAsRead = useCallback(async (id: string) => {
    // Step 1: Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    // Step 2: Call API
    await fetch(`/api/notifications/${id}/mark-read`, {
      method: 'POST',
    });

    // Step 3: TODO: Refresh to confirm?
    // const response = await fetch('/api/notifications');
    // const data = await response.json();
    // setNotifications(data.notifications); // 🪤 Is this necessary? Is it safe?

    throw new Error('Complete this implementation');
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
    // 🪤 TRAP 3: What happens if the same notification arrives twice?
    // Example: Real-time INSERT fires, then user manually refreshes, then another INSERT.
    // Are you handling duplicates? Check notification.id before adding to state.
    //
    // 🪤 TRAP 4: What happens if fetchNotifications dependency changes?
    // The effect will re-run, creating a NEW subscription without cleaning up the old one.
    // You'll have multiple subscriptions listening to the same events!
    //
    // 🪤 TRAP 5: What if an UPDATE event arrives for a notification not in state?
    // This can happen if the notification was just deleted or filtered out.
    // Your map() will silently fail to update anything.

    fetchNotifications();

    // TODO: Add Realtime subscription here
    // Pattern:
    // const channel = supabase
    //   .channel('notifications')
    //   .on('postgres_changes', {
    //     event: 'INSERT',
    //     schema: 'public',
    //     table: 'notifications'
    //   }, (payload) => {
    //     // TODO: Add payload.new to notifications state
    //     // 🪤 Are you checking for duplicates?
    //   })
    //   .on('postgres_changes', {
    //     event: 'UPDATE',
    //     schema: 'public',
    //     table: 'notifications'
    //   }, (payload) => {
    //     // TODO: Update notification in state
    //     // 🪤 What if this notification doesn't exist in state?
    //   })
    //   .subscribe();

    return () => {
      // TODO: Cleanup subscriptions
      // 🪤 TRAP 6: If you don't unsubscribe, the channel stays active even after unmount
      // This causes memory leaks AND duplicate event handlers on remount
    };
  }, [fetchNotifications]);

  // Recalculate unread count when notifications change
  // 🪤 TRAP 7: This effect runs EVERY time notifications change.
  // If you're adding notifications in rapid succession (e.g., multiple real-time events),
  // this will cause multiple renders. Is that optimal?
  // Also, what happens if notifications array is mutated instead of replaced?
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
