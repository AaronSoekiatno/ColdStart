/**
 * Notifications Service Layer
 *
 * Each candidate has an isolated database schema.
 * Use the schemaName parameter to query the correct schema.
 */

import { createClient } from '@supabase/supabase-js';
import { Notification, NotificationsResponse, MarkAsReadResponse } from './types/notification';

/**
 * Fetch all notifications for a candidate
 */
export async function getUserNotifications(schemaName: string): Promise<NotificationsResponse> {
  // 🪤 Trap: What Supabase key should you use for server-side schema access?

  throw new Error('Not implemented');
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  schemaName: string,
  notificationId: string
): Promise<MarkAsReadResponse> {
  throw new Error('Not implemented');
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(schemaName: string): Promise<number> {
  // TODO: Implement - return count of notifications where read = false
  
  throw new Error('Not implemented');
}
