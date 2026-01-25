/**
 * Notifications Service Layer
 *
 * REQUIREMENTS:
 * - Each candidate has an isolated schema (passed as schemaName parameter)
 * - Query notifications from the candidate's schema only
 * - Return notifications with unread count
 * - Support marking individual notifications as read
 *
 * CONSTRAINTS:
 * - Use Supabase client (@supabase/supabase-js)
 * - Schema isolation is critical for security
 * - Must handle errors gracefully
 *
 * TODO: Implement the two functions below
 */

import { createClient } from '@supabase/supabase-js';
import { Notification, NotificationsResponse, MarkAsReadResponse } from './types/notification';

/**
 * Fetch all notifications for a candidate
 *
 * Requirements:
 * - Connect to the candidate's isolated schema
 * - Return notifications ordered by most recent first
 * - Calculate unread count (where read = false)
 * - Handle errors without crashing
 *
 * @param schemaName - The candidate's provisioned schema name
 * @returns Promise<NotificationsResponse>
 */
export async function getUserNotifications(schemaName: string): Promise<NotificationsResponse> {
  // TODO: Implement this function
  //
  // Trap 🪤: AI might use NEXT_PUBLIC_SUPABASE_ANON_KEY here
  // That's a security issue - you need different permissions for schema queries
  //
  // Consider: What Supabase key should you use for server-side schema access?

  throw new Error('Not implemented');
}

/**
 * Mark a notification as read
 *
 * Requirements:
 * - Connect to the candidate's isolated schema
 * - Update the specific notification's read status
 * - Return success/failure status
 * - Handle errors gracefully
 *
 * @param schemaName - The candidate's provisioned schema name
 * @param notificationId - The notification ID to mark as read
 * @returns Promise<MarkAsReadResponse>
 */
export async function markNotificationAsRead(
  schemaName: string,
  notificationId: string
): Promise<MarkAsReadResponse> {
  // TODO: Implement this function
  //
  // Trap 🪤: Make sure you're updating the right schema
  // Trap 🪤: What happens if the notification doesn't exist?

  throw new Error('Not implemented');
}
