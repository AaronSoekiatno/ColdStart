import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration constants
const BATCH_SIZE = 5;

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

interface UseMatchesState {
  allMatches: MatchRecord[];
  currentIndex: number;
  nextPage: number;
  hasMore: boolean;
  totalMatches: number;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
}

interface UseMatchesReturn {
  matches: MatchRecord[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  loadMoreIfNeeded: () => Promise<void>;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalMatches: number;
  hasError: boolean;
}

export function useMatches(): UseMatchesReturn {
  const [state, setState] = useState<UseMatchesState>({
    allMatches: [],
    currentIndex: 0,
    nextPage: 1,
    hasMore: true,
    totalMatches: 0,
    isInitialLoading: true,
    isLoadingMore: false,
    hasError: false,
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchNextBatch = useCallback(async () => {
    // Prevent duplicate fetches
    if (fetchingRef.current) {
      console.log('[useMatches] Fetch already in progress, skipping');
      return;
    }

    // Check if we should fetch
    if (!state.hasMore && state.nextPage > 1) {
      console.log('[useMatches] No more matches to fetch');
      return;
    }

    const pageToFetch = state.nextPage;

    console.log('[useMatches] Fetching page', pageToFetch);

    fetchingRef.current = true;

    try {
      const response = await fetch(`/api/matches?page=${pageToFetch}&limit=${BATCH_SIZE}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('NO_RESUME');
        }
        throw new Error('Failed to load matches');
      }

      const data = await response.json();
      const newMatches = data.matches || [];
      const pagination: PaginationInfo = data.pagination;

      console.log('[useMatches] Received', newMatches.length, 'matches. Has more:', pagination.hasMore);

      // Only update state if component is still mounted
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          allMatches: [...prev.allMatches, ...newMatches],
          nextPage: prev.nextPage + 1,
          hasMore: pagination.hasMore,
          totalMatches: pagination.total,
          isInitialLoading: false,
          isLoadingMore: false,
        }));
      }
    } catch (error) {
      console.error('[useMatches] Error fetching matches:', error);

      // Only update state if component is still mounted
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          hasError: error instanceof Error && error.message === 'NO_RESUME' ? false : true,
          isInitialLoading: false,
          isLoadingMore: false,
        }));
      }

      // Re-throw NO_RESUME error so parent can handle redirect
      if (error instanceof Error && error.message === 'NO_RESUME') {
        throw error;
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [state.hasMore, state.nextPage]);

  // Initial load - only runs once on mount
  useEffect(() => {
    if (state.isInitialLoading && state.nextPage === 1) {
      console.log('[useMatches] Initial load triggered');
      fetchNextBatch();
    }
  }, [state.isInitialLoading, state.nextPage, fetchNextBatch]);

  // Load more on demand
  const loadMoreIfNeeded = useCallback(async () => {
    // If we're at or past the last loaded match, and there are more matches, load them
    if (state.currentIndex >= state.allMatches.length - 1 && state.hasMore && !state.isLoadingMore && !fetchingRef.current) {
      console.log('[useMatches] Loading more matches on demand');
      setState(prev => ({ ...prev, isLoadingMore: true }));
      await fetchNextBatch();
    }
  }, [state.currentIndex, state.allMatches.length, state.hasMore, state.isLoadingMore, fetchNextBatch]);

  const setCurrentIndex = useCallback((index: number) => {
    if (isMounted.current) {
      setState(prev => ({ ...prev, currentIndex: index }));
    }
  }, []);

  return {
    matches: state.allMatches,
    currentIndex: state.currentIndex,
    setCurrentIndex,
    loadMoreIfNeeded,
    isInitialLoading: state.isInitialLoading,
    isLoadingMore: state.isLoadingMore,
    hasMore: state.hasMore,
    totalMatches: state.totalMatches,
    hasError: state.hasError,
  };
}
