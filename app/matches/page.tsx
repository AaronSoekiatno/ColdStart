'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSubscribed } from '@/lib/supabase';
import { MatchCard } from '@/components/features/matches/MatchCard';
import { Header } from '@/components/layout/Header';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { OnboardingModal } from '@/components/modals/OnboardingModal';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Play } from 'lucide-react';
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
  jobs?: Array<{
    job_url?: string;
    job_title?: string;
    job_type?: string;
    salary_range?: string;
    experience_level?: string;
    created_at?: string;
  }>;
  alsoConsider?: Array<{
    job_url?: string;
    job_title?: string;
    job_type?: string;
    salary_range?: string;
    experience_level?: string;
    created_at?: string;
  }>;
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
  const [savedMatchIds, setSavedMatchIds] = useState<string[]>([]); // Store all saved match IDs from Supabase
  const [savedStartupIds, setSavedStartupIds] = useState<string[]>([]); // Store all saved startup IDs (to handle match ID changes)
  const [assessmentStatus, setAssessmentStatus] = useState<'not_started' | 'in_progress' | 'completed' | null>(null);
  const [githubAnalysis, setGithubAnalysis] = useState<Record<string, any>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Memoized values - must be declared before useEffect hooks
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);

  // All users can see all matches
  const visibleMatches = useMemo(() => {
    return matches;
  }, [matches]);

  const hiddenMatchCount = useMemo(() => {
    return 0;
  }, []);

  // Calculate initialIsSaved for current match - memoized to ensure it updates when savedMatchIds changes
  // Check by both match_id (for exact match) and startup_id (to handle match ID changes)
  const currentMatchIsSaved = useMemo(() => {
    if (!visibleMatches[currentMatchIndex]) return false;
    const matchId = visibleMatches[currentMatchIndex].id;
    const startupId = visibleMatches[currentMatchIndex].startup?.id;

    // Check by match_id first (exact match)
    const isSavedByMatchId = savedMatchIds.includes(matchId);
    // Also check by startup_id (handles cases where match ID changed but startup is still saved)
    const isSavedByStartupId = startupId ? savedStartupIds.includes(startupId) : false;
    return isSavedByMatchId || isSavedByStartupId;
  }, [visibleMatches, currentMatchIndex, savedMatchIds, savedStartupIds]);

  // Handle navigation
  const handleNextMatch = () => {
    setCurrentMatchIndex((prev) => Math.min(visibleMatches.length - 1, prev + 1));
  };

  const handlePreviousMatch = () => {
    setCurrentMatchIndex((prev) => Math.max(0, prev - 1));
  };

  // Function to fetch saved match IDs from Supabase (source of truth)
  const fetchSavedMatchIds = async () => {
    try {
      // Add cache-busting query parameter to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const savedResponse = await fetch(`/api/matches/saved/all${cacheBuster}`, {
        credentials: 'include',
        cache: 'no-store', // Always fetch fresh data from Supabase
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (savedResponse.ok) {
        const savedData = await savedResponse.json();
        setSavedMatchIds(savedData.matchIds || []);
        setSavedStartupIds(savedData.startupIds || []);
      }
    } catch (error) {
      console.error('[MatchesPage] Error loading saved match IDs:', error);
    }
  };

  // Restore current match index from sessionStorage on mount
  useEffect(() => {
    const storedIndex = sessionStorage.getItem('matchesCurrentIndex');
    if (storedIndex) {
      const index = parseInt(storedIndex, 10);
      if (!isNaN(index) && index >= 0) {
        setCurrentMatchIndex(index);
      }
      // Clear it after reading to avoid stale state
      sessionStorage.removeItem('matchesCurrentIndex');
    }
  }, []);

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
        let candidateId: string | null = null;
        if (candidateResponse.ok) {
          const candidateInfo = await candidateResponse.json();
          setIsPremium(isSubscribed(candidateInfo));
          candidateId = candidateInfo.id;
          setOnboardingCompleted(candidateInfo.onboarding_completed);
        }

        // Get first 20 matches for immediate display
        const response = await fetch('/api/matches?page=1&limit=20', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            // No resume - just stay on matches page with empty state
            setMatches([]);
            setPagination(null);
          } else if (response.status === 429) {
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

        // Fetch saved match IDs in batch (replaces 40+ individual calls)
        await fetchSavedMatchIds();

        // Fetch GitHub analysis for current candidate
        if (candidateId) {
          try {
            const response = await fetch(`/api/github/analyze/results/${candidateId}`, {
              credentials: 'include',
            });
            if (response.ok) {
              const analysisData = await response.json();
              setGithubAnalysis({ [candidateId]: analysisData });
            }
          } catch (error) {
            console.error('[Matches] Failed to fetch GitHub analysis:', error);
            // Not critical - continue without analysis data
          }
        }

        // Fetch assessment status to update button text
        try {
          const assessmentResponse = await fetch('/api/topcandidates/assessment-status', {
            credentials: 'include',
          });
          if (assessmentResponse.ok) {
            const assessmentData = await assessmentResponse.json();
            setAssessmentStatus(assessmentData.status || 'not_started');
          }
        } catch (error) {
          console.error('Error fetching assessment status:', error);
          // Not critical - default to showing "Start Assessment"
        }
      } catch (error) {
        console.error('Error initializing matches page:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  // Refetch saved match IDs when page becomes visible again (e.g., browser back button, tab switch)
  // Always refetch from Supabase to ensure UI reflects actual saved state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Debounce: Wait 500ms before refetching to ensure any pending saves complete
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          // Always refetch from Supabase - this is the source of truth
          fetchSavedMatchIds();
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

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

        {/* Quick Access to Assessment */}
        <div className="container mx-auto px-4 mb-4 max-w-4xl">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {assessmentStatus === 'completed'
                    ? '✅ Assessment Complete'
                    : assessmentStatus === 'in_progress'
                      ? '📝 Continue Your Assessment'
                      : '🎯 Boost Your Profile'}
                </h3>
                <p className="text-sm text-gray-600">
                  {assessmentStatus === 'completed'
                    ? 'Great job! You can review your assessment anytime.'
                    : assessmentStatus === 'in_progress'
                      ? 'You started your assessment. Complete it to improve your match quality.'
                      : 'Complete a 20-minute technical assessment to stand out to employers.'}
                </p>
              </div>
              <Button
                onClick={() => router.push('/assessment')}
                variant={assessmentStatus === 'not_started' ? 'default' : 'outline'}
                className={assessmentStatus === 'not_started'
                  ? 'bg-[#498EDC] hover:bg-[#3a7bc4] text-white border-0 whitespace-nowrap'
                  : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 whitespace-nowrap'}
              >
                <Play className="mr-2 h-4 w-4" />
                {assessmentStatus === 'completed'
                  ? 'View Assessment'
                  : assessmentStatus === 'in_progress'
                    ? 'Continue'
                    : 'Start Assessment'}
              </Button>
            </div>
          </div>
        </div>

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
                    initialIsSaved={currentMatchIsSaved}
                    currentIndex={currentMatchIndex}
                    githubAnalysis={Object.values(githubAnalysis)[0] || null}
                    onboardingCompleted={onboardingCompleted === true}
                    onOnboardingNeeded={() => setShowOnboarding(true)}
                    onSaveToggle={(matchId, isSaved) => {
                      // Optimistically update parent state for immediate UI feedback
                      // The actual state will be synced from Supabase on next refetch
                      if (isSaved) {
                        setSavedMatchIds(prev => {
                          // Avoid duplicates
                          if (prev.includes(matchId)) return prev;
                          return [...prev, matchId];
                        });
                      } else {
                        setSavedMatchIds(prev => prev.filter(id => id !== matchId));
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl md:rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 md:p-12 text-center text-gray-900">
              <h2 className="text-xl font-bold mb-4">Find your next startup role</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Hermes uses AI to match your background with open roles at top YC and VC-backed startups.
              </p>
              <Button
                onClick={() => setShowOnboarding(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 py-6 text-lg font-semibold shadow-lg transform transition hover:scale-105"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Onboarding Modal */}
      <OnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          setOnboardingCompleted(true);
          // Reload data without full page reload to prevent infinite loop
          window.location.href = '/matches';
        }}
      />

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
