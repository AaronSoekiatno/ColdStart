import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats job recency as relative time (e.g., "Posted 2 days ago", "Just posted")
 * @param createdAt - ISO timestamp string or undefined
 * @returns Formatted string or null if date is invalid/missing
 */
export function formatJobRecency(createdAt: string | undefined): string | null {
  if (!createdAt) {
    return null;
  }

  try {
    const now = new Date();
    const created = new Date(createdAt);
    
    // Check if date is valid
    if (isNaN(created.getTime())) {
      return null;
    }

    const diffMs = now.getTime() - created.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    let result: string | null = null;

    // Less than 1 hour
    if (diffMinutes < 60) {
      if (diffMinutes < 1) {
        result = "Just posted";
      } else {
        result = `Posted ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      }
    }
    // Less than 24 hours
    else if (diffHours < 24) {
      result = `Posted ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    // Less than 30 days
    else if (diffDays < 30) {
      result = `Posted ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    // More than 30 days - still show but with weeks/months
    else {
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);

      if (diffMonths >= 1) {
        result = `Posted ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
      } else {
        result = `Posted ${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
      }
    }

    return result;
  } catch (error) {
    console.error('[formatJobRecency] Error formatting job recency:', error);
    return null;
  }
}

