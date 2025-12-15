'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSubscribed } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useMatches } from '@/hooks/use-matches';

export default function MatchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Use the custom hook for match management
  const {
    matches,
    currentIndex,
    setCurrentIndex,
    loadMoreIfNeeded,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    hasError: matchesError,
  } = useMatches();

  // Check authentication and premium status
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
      } catch (error) {
        console.error('Error initializing matches page:', error);
      } finally {
        setIsAuthChecking(false);
      }
    };

    initialize();
  }, [router]);

  // Memoized values
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);

  const currentMatch = useMemo(
    () => matches[currentIndex],
    [matches, currentIndex]
  );

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (hasMore) {
      // At the end of loaded matches, try to load more
      await loadMoreIfNeeded();
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Loading state
  if (isAuthChecking || isInitialLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-gray-900">
              <p>Loading matches...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Error state
  if (matchesError || !user) {
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

  // Main render
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />
      <section className="pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 md:pb-20">
        {/* Fixed navigation arrows */}
        {hasMatches && (
          <>
            {/* Left arrow button */}
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="fixed left-1 sm:left-2 md:left-4 lg:left-[calc(50%-512px-60px)] top-[240px] sm:top-[260px] md:top-[320px] lg:top-[350px] z-50 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Previous match"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>

            {/* Right arrow button */}
            <button
              onClick={handleNext}
              disabled={(currentIndex >= matches.length - 1 && !hasMore) || isLoadingMore}
              className="fixed right-1 sm:right-2 md:right-4 lg:right-[calc(50%-512px-60px)] top-[240px] sm:top-[260px] md:top-[320px] lg:top-[350px] z-50 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Next match"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>
          </>
        )}

        <div className="container mx-auto px-3 sm:px-4">
          {hasMatches ? (
            <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto relative pl-12 sm:pl-0 pr-12 sm:pr-0 md:pl-0 md:pr-0">
              {/* Single match card display */}
              {currentMatch && (
                <div key={currentMatch.id} className="animate-fade-in">
                  <MatchCard match={currentMatch} isPremium={isPremium} />
                </div>
              )}

              {/* Loading indicator */}
              {isLoadingMore && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-2xl md:rounded-3xl">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-600">Loading more matches...</p>
                  </div>
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
    </div>
  );
}
