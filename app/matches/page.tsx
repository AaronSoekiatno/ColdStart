'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSubscribed } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
import { UpgradeModal } from '@/components/UpgradeModal';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface MatchRecord {
  id: string;
  score: number;
  matched_at: string;
  has_job_listings?: boolean;
  startup: {
    id?: string;
    name: string;
    industry: string;
    location: string;
    funding_stage: string;
    funding_amount: string;
    tags: string;
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
  
  // Free users can only see 10 matches
  const FREE_MATCH_LIMIT = 10;

  // Memoized values - must be declared before useEffect hooks
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);
  
  // Limit matches for free users
  const visibleMatches = useMemo(() => {
    if (isPremium) {
      return matches;
    }
    return matches.slice(0, FREE_MATCH_LIMIT);
  }, [matches, isPremium, FREE_MATCH_LIMIT]);
  
  const hiddenMatchCount = useMemo(() => {
    if (isPremium) return 0;
    return Math.max(0, matches.length - FREE_MATCH_LIMIT);
  }, [matches.length, isPremium, FREE_MATCH_LIMIT]);
  
  // Handle navigation with premium check
  const handleNextMatch = () => {
    if (!isPremium && currentMatchIndex >= FREE_MATCH_LIMIT - 1) {
      setShowUpgradeModal(true);
      return;
    }
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
          throw new Error('Failed to load matches');
        }

        const data = await response.json();
        setMatches(data.matches || []);
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

  // Background fetch remaining matches after initial load
  useEffect(() => {
    const fetchRemainingMatches = async () => {
      // Only fetch if we have initial matches and pagination info
      if (!pagination || !pagination.hasMore || matches.length === 0) {
        return;
      }

      console.log('[Matches] Background fetching remaining matches...');

      try {
        // Fetch all remaining pages
        const fetchPromises = [];

        for (let page = 2; page <= pagination.totalPages; page++) {
          fetchPromises.push(
            fetch(`/api/matches?page=${page}&limit=20`, {
              credentials: 'include',
            })
              .then(async (res) => {
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({ error: 'Failed to fetch matches' }));
                  throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
                }
                return res.json();
              })
              .catch((error) => {
                console.error(`[Matches] Error fetching page ${page}:`, error);
                // Return empty result for this page so Promise.all doesn't fail
                return { matches: [], pagination: { hasMore: false } };
              })
          );
        }

        const results = await Promise.all(fetchPromises);

        // Combine all matches
        const allNewMatches = results.flatMap(result => result.matches || []);

        console.log('[Matches] Background fetch complete. Loaded', allNewMatches.length, 'additional matches');

        // Append to existing matches
        setMatches(prev => [...prev, ...allNewMatches]);
      } catch (error) {
        console.error('[Matches] Error fetching remaining matches:', error);
        // Silently fail - user already has first 20 matches
      }
    };

    // Start background fetch after initial matches are loaded
    if (matches.length > 0 && pagination?.hasMore) {
      fetchRemainingMatches();
    }
  }, [matches.length > 0, pagination?.hasMore]); // Only run once when we have initial matches

  // Reset current match index when matches change
  useEffect(() => {
    if (visibleMatches.length > 0 && currentMatchIndex >= visibleMatches.length) {
      setCurrentMatchIndex(0);
    }
  }, [visibleMatches.length, currentMatchIndex]);

  // Preload images for adjacent cards to improve UX
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

      // Preload current, next, and previous cards
      if (visibleMatches.length > 0) {
        // Preload current card
        preloadImages(currentMatchIndex);
        
        // Preload previous card
        if (currentMatchIndex > 0) {
          preloadImages(currentMatchIndex - 1);
        }
        
        // Preload next card
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
              <p>Failed to load matches. Please try again.</p>
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
              disabled={isPremium && currentMatchIndex >= visibleMatches.length - 1}
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
                  <MatchCard match={visibleMatches[currentMatchIndex]} isPremium={isPremium} userEmail={user?.email || ''} />
                </div>
              )}
              {/* Show upgrade prompt if user has reached free limit */}
              {!isPremium && hiddenMatchCount > 0 && currentMatchIndex === FREE_MATCH_LIMIT - 1 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    You've viewed {FREE_MATCH_LIMIT} matches. Upgrade to see {hiddenMatchCount} more!
                  </p>
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
