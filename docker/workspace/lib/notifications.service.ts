/**
 * Notifications Service Layer
 * 70% provided - Candidates implement query logic (30%)
 */

import { createClient } from '@supabase/supabase-js';
import { Notification, NotificationsResponse, MarkAsReadResponse } from './types/notification';

/**
 * Get all notifications for a candidate (in their isolated schema)
 *
 * TODO: Candidates must implement:
 * 1. Create Supabase client with schema-specific connection
 * 2. Query notifications table ordered by created_at DESC
 * 3. Calculate unread count
 * 4. Return NotificationsResponse
 *
 * @param schemaName - The candidate's provisioned schema name
 * @returns Promise<NotificationsResponse>
 */
export async function getUserNotifications(schemaName: string): Promise<NotificationsResponse> {
  // TODO: Create Supabase client with candidate's schema
  // Hint: Use createClient with URL and anon key from environment variables
  // Hint: Configure the client to use the candidate's schema
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: schemaName }
    }
  );

  // TODO: Query notifications table ordered by created_at DESC
  // Hint: Use supabase.from('notifications').select('*').order('created_at', { ascending: false })
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], unreadCount: 0 };
  }

  const notifications = (data || []) as Notification[];

  // TODO: Calculate unread count
  // Hint: Filter notifications where read === false and get the length
  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount };
}

/**
 * Mark a notification as read
 *
 * TODO: Candidates must implement:
 * 1. Create Supabase client with schema-specific connection
 * 2. UPDATE notifications SET read = true WHERE id = notificationId
 * 3. Return success boolean
 *
 * @param schemaName - The candidate's provisioned schema name
 * @param notificationId - The notification ID to mark as read
 * @returns Promise<MarkAsReadResponse>
 */
export async function markNotificationAsRead(
  schemaName: string,
  notificationId: string
): Promise<MarkAsReadResponse> {
  // TODO: Create Supabase client with candidate's schema
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: schemaName }
    }
  );

  // TODO: UPDATE notifications SET read = true WHERE id = notificationId
  // Hint: Use supabase.from('notifications').update({ read: true }).eq('id', notificationId)
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
