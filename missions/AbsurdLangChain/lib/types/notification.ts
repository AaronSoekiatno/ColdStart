/**
 * Type definitions for the notification system
 * 100% provided - No TODOs
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface MarkAsReadResponse {
  success: boolean;
  error?: string;
}
