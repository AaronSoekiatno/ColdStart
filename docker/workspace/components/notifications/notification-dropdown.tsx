/**
 * Notification Dropdown Component
 *
 * Displays a list of notifications with mark-as-read functionality.
 */

"use client";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-notifications";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

export function NotificationDropdown() {
  const { notifications, markAsRead } = useNotifications();

  return (
    <DropdownMenuContent className="w-[400px]" align="end">
      <DropdownMenuLabel>Notifications</DropdownMenuLabel>

      <div className="max-h-[400px] overflow-y-auto">
        {/* TODO: Map notifications to DropdownMenuItem components */}
        {/* Show: title, message, timestamp, mark-as-read button (if unread) */}
        {/* Style: different opacity/font-weight for read vs unread */}

        {notifications.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        )}
      </div>
    </DropdownMenuContent>
  );
}
