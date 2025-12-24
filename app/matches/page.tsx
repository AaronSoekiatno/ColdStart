'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSubscribed } from '@/lib/supabase';
import { MatchCard } from '@/components/features/matches/MatchCard';
import { Header } from '@/components/layout/Header';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface MatchRecord {
  id: string;
  score: number;
  matched_at: string;
  has_job_listings?: boolean;
  job?: {
    job_url?: string;
    job_title?: string;
    job_type?: string;
  } | null;
  startup: {
    id?: string;
    name: string;
    industry: string;
    location: string;
    funding_amount?: string;
    website: string;
    founder_emails?: string;
    founder_names?: string;
    founder_linkedin?: string;
    founder_backgrounds?: string;
    founders_pfp?: string;
    batch?: string;
    description?: string;
    company_logo?: string;
    yc_link?: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function MatchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [hasError, setHasError] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Memoized values - must be declared before useEffect hooks
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);

  // All users can see all matches
  const visibleMatches = useMemo(() => {
    return matches;
  }, [matches]);

  const hiddenMatchCount = useMemo(() => {
    return 0;
  }, []);

  // Handle navigation
  const handleNextMatch = () => {
    setCurrentMatchIndex((prev) => Math.min(visibleMatches.length - 1, prev + 1));
  };

  const handlePreviousMatch = () => {
    setCurrentMatchIndex((prev) => Math.max(0, prev - 1));
  };

  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
          router.push(`/?signup=true&redirect=/matches`);
          return;
        }

        setUser(currentUser);

        // Get candidate info and premium status
        const candidateResponse = await fetch('/api/candidate-info', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (candidateResponse.ok) {
          const candidateInfo = await candidateResponse.json();
          setIsPremium(isSubscribed(candidateInfo));
        }

        // Get first 20 matches for immediate display
        const response = await fetch('/api/matches?page=1&limit=20', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            // No resume - redirect to home with uploadResume flag
            router.push('/?uploadResume=true');
            return;
          }
          if (response.status === 429) {
            // Rate limit exceeded
            const errorData = await response.json().catch(() => ({}));
            setHasError(true);
            console.error('Rate limit exceeded:', errorData);
            // Don't throw - show error message to user
            return;
          }
          throw new Error('Failed to load matches');
        }

        const data = await response.json();
        setMatches(data.items || data.matches || []);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error initializing matches page:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  // Fetch next page when user is approaching the end of current matches
  useEffect(() => {
    const fetchNextPage = async () => {
      // Only fetch if:
      // 1. We have pagination info
      // 2. There's more data to fetch
      // 3. User is within 5 matches of the end
      // 4. We're not already loading
      if (!pagination || !pagination.hasMore || isLoading) {
        return;
      }

      const remainingMatches = matches.length - currentMatchIndex;
      if (remainingMatches > 5) {
        return; // Still far from the end
      }

      console.log('[Matches] Fetching next page:', pagination.page + 1);

      try {
        const nextPage = pagination.page + 1;
        const response = await fetch(`/api/matches?page=${nextPage}&limit=20`, {
          credentials: 'include',
        });

        if (!response.ok) {
          console.error('[Matches] Failed to fetch next page');
          return;
        }

        const data = await response.json();
        const newMatches = data.items || data.matches || [];

        // Append new matches to existing ones
        setMatches(prev => [...prev, ...newMatches]);
        setPagination(data.pagination);

        console.log('[Matches] Loaded page', nextPage, '- Added', newMatches.length, 'matches');
      } catch (error) {
        console.error('[Matches] Error fetching next page:', error);
      }
    };

    fetchNextPage();
  }, [currentMatchIndex, matches.length, pagination, isLoading]);

  // Reset current match index when matches change
  useEffect(() => {
    if (visibleMatches.length > 0 && currentMatchIndex >= visibleMatches.length) {
      setCurrentMatchIndex(0);
    }
  }, [visibleMatches.length, currentMatchIndex]);

  // Preload images for current and adjacent cards
  useEffect(() => {
    const preloadImages = (matchIndex: number) => {
      const match = visibleMatches[matchIndex];
      if (!match?.startup?.founders_pfp) return;

      const foundersPfp = match.startup.founders_pfp;

      // Parse founders_pfp - handle both array and string formats
      let urls: string[] = [];
      if (Array.isArray(foundersPfp)) {
        urls = foundersPfp
          .map(url => String(url).trim())
          .filter(url => url && url !== '');
      } else if (typeof foundersPfp === 'string') {
        urls = foundersPfp
          .split(',')
          .map(url => url.trim())
          .filter(url => url && url !== '');
      }

      // Preload each image
      urls.forEach((url) => {
        if (url) {
          const img = new Image();
          img.src = `/api/image-proxy?url=${encodeURIComponent(url)}`;
        }
      });
    };

    // Preload images for current, next, and previous cards
    if (visibleMatches.length > 0) {
      preloadImages(currentMatchIndex);
      if (currentMatchIndex > 0) {
        preloadImages(currentMatchIndex - 1);
      }
      if (currentMatchIndex < visibleMatches.length - 1) {
        preloadImages(currentMatchIndex + 1);
      }
    }
  }, [currentMatchIndex, visibleMatches]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="flex-1 flex items-center justify-center px-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
        </section>
      </div>
    );
  }

  if (hasError || !user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-gray-900">
              <p className="mb-4">Failed to load matches.</p>
              <p className="text-sm text-gray-600 mb-4">
                This may be due to database rate limits. Please wait a moment and try again.
              </p>
              <button
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />
      <section className="pt-16 sm:pt-20 md:pt-24 lg:pt-32 pb-8 sm:pb-12 md:pb-20">
        {/* Fixed navigation arrows */}
        {hasMatches && (
          <>
            {/* Left arrow button */}
            <button
              onClick={handlePreviousMatch}
              disabled={currentMatchIndex === 0}
              className="fixed left-1 sm:left-2 md:left-4 lg:left-[calc(50%-512px-60px)] top-[180px] sm:top-[220px] md:top-[280px] lg:top-[350px] z-50 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Previous match"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>

            {/* Right arrow button */}
            <button
              onClick={handleNextMatch}
              disabled={currentMatchIndex >= visibleMatches.length - 1}
              className="fixed right-1 sm:right-2 md:right-4 lg:right-[calc(50%-512px-60px)] top-[180px] sm:top-[220px] md:top-[280px] lg:top-[350px] z-50 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Next match"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>
          </>
        )}

        <div className="container mx-auto px-2 sm:px-4">
          {hasMatches ? (
            <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto relative pl-10 sm:pl-0 pr-10 sm:pr-0 md:pl-0 md:pr-0">
              {/* Single match card display */}
              {visibleMatches[currentMatchIndex] && (
                <div key={visibleMatches[currentMatchIndex].id} className="animate-fade-in">
                  <MatchCard
                    match={visibleMatches[currentMatchIndex]}
                    isPremium={isPremium}
                    userEmail={user?.email || ''}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 md:p-12 text-center text-gray-900">
              <p className="text-sm sm:text-base md:text-lg text-gray-900">No matches yet. Upload your resume to get started.</p>
            </div>
          )}
        </div>
      </section>

      {/* Upgrade Modal */}
      {user?.email && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          hiddenMatchCount={hiddenMatchCount}
          email={user.email}
          isPremium={isPremium}
          customTitle={hiddenMatchCount > 0 ? `🔒 ${hiddenMatchCount} More Match${hiddenMatchCount === 1 ? '' : 'es'} Available` : 'Upgrade to Premium'}
        />
      )}
    </div>
  );
}
