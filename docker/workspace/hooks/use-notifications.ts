/**
 * useNotifications Hook
 * Manages notification state and real-time updates
 *
 * 60% provided - Candidates implement fetch/markAsRead/event handlers (40%)
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
  // Hint: Call GET /api/notifications
  // Hint: Update notifications and unreadCount state
  // Hint: Set loading to false when done
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications');
      const data = await response.json();

      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // TODO: Implement markAsRead
  // Hint: Optimistically update UI first (set read to true in local state)
  // Hint: Call POST /api/notifications/:id/mark-read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistically update UI
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    // Call API to persist change
    try {
      await fetch(`/api/notifications/${id}/mark-read`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update on error
      fetchNotifications();
    }
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();

    // Realtime subscription (MOSTLY PROVIDED)
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public', // Candidate schema determined server-side
          table: 'notifications',
        },
        (payload) => {
          // TODO: Add new notification to state
          // Hint: setNotifications(prev => [payload.new as Notification, ...prev]);
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          // TODO: Update notification in state
          // Hint: setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
          setNotifications(prev =>
            prev.map(n =>
              n.id === (payload.new as Notification).id
                ? (payload.new as Notification)
                : n
            )
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
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
