/**
 * Notification Bell Component
 * 80% provided - Candidates implement badge rendering (20%)
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

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <NotificationDropdown />
    </DropdownMenu>
  );
}
