/**
 * Notification Bell Component
 *
 * Displays a bell icon with an unread notification badge.
 */

"use client";

import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationDropdown } from "./notification-dropdown";
import { cn } from "@/utils/cn";

export function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative p-1 hover:opacity-70 transition-opacity rounded-full focus:outline-none"
          )}
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" />

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <NotificationDropdown />
    </DropdownMenu>
  );
}
