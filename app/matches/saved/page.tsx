'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSubscribed } from '@/lib/supabase';
import { SavedMatchCard } from '@/components/features/matches/SavedMatchCard';
import { Header } from '@/components/layout/Header';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { Loader2 } from 'lucide-react';
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

export default function SavedMatchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set());

  const hasMatches = matches.length > 0;

  // Load saved match IDs on mount
  useEffect(() => {
    const loadSavedMatchIds = async () => {
      const savedIds = new Set<string>();
      for (const match of matches) {
        try {
          const response = await fetch(`/api/matches/saved/check?matchId=${match.id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.isSaved) {
              savedIds.add(match.id);
            }
          }
        } catch (error) {
          console.error('Error checking saved status:', error);
        }
      }
      setSavedMatchIds(savedIds);
    };

    if (matches.length > 0) {
      loadSavedMatchIds();
    }
  }, [matches]);

  const handleToggleSave = async (matchId: string) => {
    const isCurrentlySaved = savedMatchIds.has(matchId);
    const previousSavedState = new Set(savedMatchIds);

    // Optimistically update UI
    if (isCurrentlySaved) {
      savedMatchIds.delete(matchId);
    } else {
      savedMatchIds.add(matchId);
    }
    setSavedMatchIds(new Set(savedMatchIds));

    try {
      if (isCurrentlySaved) {
        // Unsave the match
        const response = await fetch(`/api/matches/saved?matchId=${matchId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          // Revert on failure
          setSavedMatchIds(previousSavedState);
          console.error('Failed to unsave match');
        } else {
          // Remove from matches list
          setMatches(prev => prev.filter(m => m.id !== matchId));
        }
      } else {
        // Save the match
        const response = await fetch('/api/matches/saved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ matchId }),
        });

        if (!response.ok && response.status !== 409) {
          // Revert on failure (except for 409 which means already saved)
          setSavedMatchIds(previousSavedState);
          console.error('Failed to save match');
        }
      }
    } catch (error) {
      // Revert on error
      setSavedMatchIds(previousSavedState);
      console.error('Error toggling save status:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
          router.push(`/?signup=true&redirect=/matches/saved`);
          return;
        }

        setUser(currentUser);

        // Get candidate info and premium status (non-blocking - don't fail if it times out)
        fetch('/api/candidate-info', {
          credentials: 'include',
          cache: 'no-store',
        })
          .then((candidateResponse) => {
            if (candidateResponse.ok) {
              return candidateResponse.json();
            }
            return null;
          })
          .then((candidateInfo) => {
            if (candidateInfo) {
              setIsPremium(isSubscribed(candidateInfo));
            }
          })
          .catch((error) => {
            // Silently handle errors - premium status is optional
            console.warn('Failed to fetch candidate info (non-critical):', error);
          });

        // Fetch saved matches from API
        const savedResponse = await fetch('/api/matches/saved', {
          credentials: 'include',
        });

        if (!savedResponse.ok) {
          throw new Error('Failed to load saved matches');
        }

        const savedData = await savedResponse.json();
        setMatches(savedData.matches || []);
      } catch (error) {
        console.error('Error initializing saved matches page:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);


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
              <p className="mb-4">Failed to load saved matches.</p>
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
      <main className="container mx-auto px-4 pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Saved Matches</h1>
          <p className="text-gray-600">{matches.length} total saved</p>
        </div>

        {hasMatches ? (
          <div className="space-y-3">
            {matches.map((match) => (
              <SavedMatchCard
                key={match.id}
                match={match}
                isPremium={isPremium}
                userEmail={user?.email || ''}
                isSaved={savedMatchIds.has(match.id)}
                onToggleSave={() => handleToggleSave(match.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">
              No saved matches yet. Start saving matches from your matches page!
            </p>
          </div>
        )}
      </main>

      {/* Upgrade Modal */}
      {user?.email && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          hiddenMatchCount={0}
          email={user.email}
          isPremium={isPremium}
          customTitle="Upgrade to Premium"
        />
      )}
    </div>
  );
}
