/**
 * Notification Dropdown Component
 * 70% provided - Candidates implement notification list rendering (30%)
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

        {/**
          * Product Request: "Interactive Notifications"
          * 
          * We're getting complaints that users lose context when clicking notifications.
          * Can we add a quick reply input directly in this dropdown?
          * 
          * Requirements:
          * - Needs to feel instant (optimistic updates?)
          * - Should handle concurrent replies gracefully
          * - Re-use existing patterns where possible (check other services?)
          */}
        {notifications.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            className={cn(
              "flex flex-col items-start gap-1 p-3 cursor-default",
              notification.read ? "opacity-60" : "opacity-100"
            )}
          >
            <div className="flex justify-between items-start w-full gap-2">
              <div className="flex-1">
                <div
                  className={cn(
                    "text-sm",
                    notification.read ? "font-normal" : "font-semibold"
                  )}
                >
                  {notification.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {notification.message}
                </div>
              </div>

              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(notification.id);
                  }}
                  className="flex-shrink-0 p-1 hover:bg-accent rounded"
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {new Date(notification.created_at).toLocaleString()}
            </div>
          </DropdownMenuItem>
        ))}

        {notifications.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        )}
      </div>
    </DropdownMenuContent>
  );
}
