"use client";

import { useEffect, useState } from "react";
import { Sparkles, Infinity as InfinityIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailCreditsData {
  isPremium: boolean;
  remaining: number;
  limit: number;
  used: number;
}

interface EmailCreditsProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function EmailCredits({ className = "", showLabel = true, compact = false }: EmailCreditsProps) {
  const [credits, setCredits] = useState<EmailCreditsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await fetch('/api/email-credits', {
          credentials: 'include',
          cache: 'no-store',
        });
        
        if (response.ok) {
          const data = await response.json();
          setCredits(data);
        } else {
          // If unauthorized, user is not logged in - don't show credits
          setCredits(null);
        }
      } catch (error) {
        console.error('Error fetching email credits:', error);
        setCredits(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredits();
    
    // Listen for refresh events
    const handleRefresh = () => {
      fetchCredits();
    };
    window.addEventListener('refresh-credits', handleRefresh);
    
    // Refresh credits every 30 seconds
    const interval = setInterval(fetchCredits, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-credits', handleRefresh);
    };
  }, []);

  // Don't render if loading or no credits data
  if (isLoading || !credits) {
    return null;
  }

  // Premium users show unlimited badge
  if (credits.isPremium) {
    if (compact) {
      return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200 ${className}`}>
          <InfinityIcon className="h-3.5 w-3.5 text-gray-600" />
          <span className="text-xs font-medium text-gray-700">Unlimited</span>
        </div>
      );
    }
    
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 ${className}`}>
        <InfinityIcon className="h-4 w-4 text-gray-600" />
        {showLabel && (
          <span className="text-xs font-medium text-gray-700">Unlimited emails</span>
        )}
      </div>
    );
  }

  // Free users show remaining credits
  const isLow = credits.remaining <= 1;
  const isZero = credits.remaining === 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
        isZero 
          ? 'bg-gray-100 border border-gray-300' 
          : isLow 
          ? 'bg-gray-50 border border-gray-200'
          : 'bg-gray-50 border border-gray-200'
      } ${className}`}>
        <Sparkles className={`h-3.5 w-3.5 ${
          isZero ? 'text-gray-700' : isLow ? 'text-gray-600' : 'text-gray-600'
        }`} />
        <span className={`text-xs font-medium ${
          isZero ? 'text-gray-800' : isLow ? 'text-gray-700' : 'text-gray-700'
        }`}>
          {credits.remaining}/{credits.limit}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
      isZero 
        ? 'bg-gray-100 border border-gray-300' 
        : isLow 
        ? 'bg-gray-50 border border-gray-200'
        : 'bg-gray-50 border border-gray-200'
    } ${className}`}>
      <Sparkles className={`h-4 w-4 ${
        isZero ? 'text-gray-700' : isLow ? 'text-gray-600' : 'text-gray-600'
      }`} />
      {showLabel && (   
        <span className={`text-xs font-medium ${
          isZero ? 'text-gray-800' : isLow ? 'text-gray-700' : 'text-gray-700'
        }`}>
          {credits.remaining}/{credits.limit} credits
        </span>
      )}
      {!showLabel && (
        <span className={`text-xs font-medium ${
          isZero ? 'text-gray-800' : isLow ? 'text-gray-700' : 'text-gray-700'
        }`}>
          {credits.remaining}/{credits.limit}
        </span>
      )}
    </div>
  );
}

