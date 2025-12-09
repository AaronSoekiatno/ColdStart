'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { Header } from '@/components/Header';
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
    batch?: string;
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
  
  // Count only perfect-fit matches with score >= 50% (0.5)
  const perfectFitMatchCount = useMemo(() => {
    return matches.filter(match => match.score >= 0.5).length;
  }, [matches]);
  
  const matchCountText = useMemo(() => {
    if (!hasMatches) return 'Upload a resume to see personalized startup matches.';    
    return 'Review these companies and send personalized emails.';
  }, [hasMatches, perfectFitMatchCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
        <Header initialUser={user} />
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-white">
              <p>Loading matches...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (hasError || !user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
        <Header initialUser={user} />
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center text-white">
              <p>Failed to load matches. Please try again.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1422' }}>
      <Header initialUser={user} />
      <section className="pt-12 pb-20">
        <div className="container mx-auto px-4">
          {hasMatches ? (
            <div className="max-w-4xl mx-auto relative">
              {/* Left arrow button */}
              <button
                onClick={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentMatchIndex === 0}
                className="absolute -left-5 top-1/2 -translate-y-1/2 -translate-x-8 md:-translate-x-16 z-10 w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl text-white transition hover:bg-white/20 hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10 flex items-center justify-center shadow-lg"
                aria-label="Previous match"
              >
                <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
              </button>

              {/* Single match card display */}
              {matches[currentMatchIndex] && (
                <div key={matches[currentMatchIndex].id} className="animate-fade-in">
                  <MatchCard match={matches[currentMatchIndex]} />
                </div>
              )}

              {/* Right arrow button */}
              <button
                onClick={() => setCurrentMatchIndex((prev) => Math.min(matches.length - 1, prev + 1))}
                disabled={currentMatchIndex >= matches.length - 1}
                className="absolute -right-5 top-1/2 -translate-y-1/2 translate-x-8 md:translate-x-16 z-10 w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/30 bg-white/10 backdrop-blur-xl text-white transition hover:bg-white/20 hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10 flex items-center justify-center shadow-lg"
                aria-label="Next match"
              >
                <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-12 text-center text-white">
              <p className="text-lg text-white">No matches yet. Upload your resume to get started.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
