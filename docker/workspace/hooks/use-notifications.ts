/**
 * useNotifications Hook
 *
 * Manages notification state and real-time updates.
 * See ASSESSMENT_V2_UNIFIED.md for requirements.
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

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock data with dynamic timestamps calculated at fetch time
    const now = Date.now();
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'info',
        title: 'Welcome to Hermes',
        message: 'Get started by exploring the workspace.',
        read: false,
        created_at: new Date(now - 1000 * 60 * 30).toISOString(), // 30 mins ago
      },
      {
        id: '2',
        type: 'success',
        title: 'Environment Ready',
        message: 'Your development environment is fully provisioned.',
        read: false,
        created_at: new Date(now - 1000 * 60 * 60).toISOString(), // 1 hour ago
      }
    ];

    setNotifications(mockNotifications);
    setLoading(false);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Simulate real-time updates (poll every 30s)
    const interval = setInterval(() => {
        // Randomly add a new notification occasionally?
        // For now just keep existing mock data
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
