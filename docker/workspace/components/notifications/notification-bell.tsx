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
            "relative p-2 hover:bg-white/10 rounded-lg transition-colors"
          )}
        >
          <Bell className="h-6 w-6 text-white" />

          {/* TODO: Add badge to show unread count when unreadCount > 0 */}
        </button>
      </DropdownMenuTrigger>
      <NotificationDropdown />
    </DropdownMenu>
  );
}
