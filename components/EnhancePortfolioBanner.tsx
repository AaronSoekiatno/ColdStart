'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnhancePortfolioBannerProps {
  resumeId?: string;
  isNewUser: boolean;
}

export function EnhancePortfolioBanner({ resumeId, isNewUser }: EnhancePortfolioBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('enhancePortfolioBannerDismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enhancePortfolioBannerDismissed', 'true');
    }
  };

  const handleEnhance = () => {
    if (resumeId) {
      window.location.href = `/resumes/tailor?resumeId=${resumeId}`;
    } else {
      // If no resume ID, just navigate to resumes page
      window.location.href = '/resumes';
    }
  };

  // Don't show if dismissed or not a new user
  if (isDismissed || !isNewUser) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Enhance Your Portfolio
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Get suggestions to improve your resume and stand out to startup founders.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-blue-100 rounded-full transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

