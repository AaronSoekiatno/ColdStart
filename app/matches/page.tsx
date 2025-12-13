'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
import { BugReportModal } from '@/components/BugReportModal';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface MatchRecord {
  id: string;
  score: number;
  matched_at: string;
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
  const [showBugReport, setShowBugReport] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

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

        // Get candidate info
        const response = await fetch('/api/matches?page=1&limit=6', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/?error=no_resume');
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

  // Reset current match index when matches change
  useEffect(() => {
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches.length, currentMatchIndex]);

  // Memoized values - must be called before any conditional returns
  const hasMatches = useMemo(() => matches.length > 0, [matches.length]);
  
  const matchCountText = useMemo(() => {
    if (!hasMatches) return 'Upload a resume to see personalized startup matches.';    
    return 'Review these companies and send personalized emails.';
  }, [hasMatches]);

  if (isLoading) {
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
      <section className="pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 md:pb-20">
        {/* Fixed navigation arrows */}
        {hasMatches && (
          <>
            {/* Left arrow button */}
            <button
              onClick={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentMatchIndex === 0}
              className="fixed left-1 sm:left-2 md:left-4 lg:left-[calc(50%-512px-60px)] top-[240px] sm:top-[260px] md:top-[320px] lg:top-[350px] z-50 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Previous match"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>

            {/* Right arrow button */}
            <button
              onClick={() => setCurrentMatchIndex((prev) => Math.min(matches.length - 1, prev + 1))}
              disabled={currentMatchIndex >= matches.length - 1}
              className="fixed right-1 sm:right-2 md:right-4 lg:right-[calc(50%-512px-60px)] top-[240px] sm:top-[260px] md:top-[320px] lg:top-[350px] z-50 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-blue-300 shadow-lg text-white transition hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100 cursor-pointer flex items-center justify-center"
              aria-label="Next match"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
            </button>
          </>
        )}
        <div className="container mx-auto px-3 sm:px-4">
          {/* Report Bug Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowBugReport(true)}
              variant="outline"
              className="bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Bug className="mr-2 h-4 w-4" />
              Report Bug
            </Button>
          </div>

          {hasMatches ? (
            <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto relative pl-12 sm:pl-0 pr-12 sm:pr-0 md:pl-0 md:pr-0">
              {/* Single match card display */}
              {matches[currentMatchIndex] && (
                <div key={matches[currentMatchIndex].id} className="animate-fade-in">
                  <MatchCard match={matches[currentMatchIndex]} />
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

      {/* Bug Report Modal */}
      <BugReportModal open={showBugReport} onOpenChange={setShowBugReport} />
    </div>
  );
}
