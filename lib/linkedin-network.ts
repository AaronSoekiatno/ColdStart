/**
 * LinkedIn Network Integration Utilities
 *
 * These functions help integrate LinkedIn network context into candidate search and display.
 * Per product spec: linkedin-scraping-product-spec.md section 7
 */

import { supabase, supabaseAdmin } from './supabase';

export interface NetworkContext {
  type: 'linkedin_1st_degree';
  connectedSince: string;
  mutualContext?: string; // Company or school where they connected
  matchConfidence: number;
  connectionDetails: {
    firstName: string;
    lastName: string;
    company?: string;
    position?: string;
    profileUrl?: string;
  };
}

/**
 * Check if a candidate is in the founder's LinkedIn network
 * Returns network context if found, null otherwise
 */
export async function getNetworkContext(
  candidateId: string,
  founderId: string
): Promise<NetworkContext | null> {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('founder_connections')
    .select('*')
    .eq('user_id', founderId)
    .eq('matched_candidate_id', candidateId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    type: 'linkedin_1st_degree',
    connectedSince: data.connected_date || 'Unknown',
    mutualContext: data.company,
    matchConfidence: data.match_confidence || 0,
    connectionDetails: {
      firstName: data.first_name,
      lastName: data.last_name,
      company: data.company,
      position: data.position,
      profileUrl: data.profile_url,
    },
  };
}

/**
 * Get all candidates in a founder's network
 * Returns array of candidate IDs
 */
export async function getNetworkCandidateIds(
  founderId: string
): Promise<string[]> {
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from('founder_connections')
    .select('matched_candidate_id')
    .eq('user_id', founderId)
    .not('matched_candidate_id', 'is', null);

  if (error || !data) {
    return [];
  }

  return data.map(row => row.matched_candidate_id).filter(Boolean);
}

/**
 * Enrich candidates with network context
 * Takes an array of candidates and adds network field if they're in the founder's network
 *
 * Usage example:
 * ```typescript
 * const candidates = await fetchCandidates();
 * const enrichedCandidates = await enrichCandidatesWithNetwork(candidates, founderId);
 * ```
 */
export async function enrichCandidatesWithNetwork<T extends { id: string }>(
  candidates: T[],
  founderId: string
): Promise<(T & { networkContext?: NetworkContext })[]> {
  const client = supabaseAdmin || supabase;

  // Get all connections for this founder
  const { data: connections, error } = await client
    .from('founder_connections')
    .select('*')
    .eq('user_id', founderId)
    .not('matched_candidate_id', 'is', null);

  if (error || !connections) {
    return candidates;
  }

  // Create a map for quick lookup
  const connectionMap = new Map(
    connections.map(conn => [conn.matched_candidate_id, conn])
  );

  // Enrich candidates
  return candidates.map(candidate => {
    const connection = connectionMap.get(candidate.id);

    if (!connection) {
      return candidate;
    }

    return {
      ...candidate,
      networkContext: {
        type: 'linkedin_1st_degree',
        connectedSince: connection.connected_date || 'Unknown',
        mutualContext: connection.company,
        matchConfidence: connection.match_confidence || 0,
        connectionDetails: {
          firstName: connection.first_name,
          lastName: connection.last_name,
          company: connection.company,
          position: connection.position,
          profileUrl: connection.profile_url,
        },
      },
    };
  });
}

/**
 * Boost candidate scores for network matches
 * Adds +20 points to priority score for candidates in network
 *
 * Usage example:
 * ```typescript
 * const candidates = await searchCandidates(query);
 * const boostedCandidates = await boostNetworkMatches(candidates, founderId);
 * // Sort by priorityScore: boostedCandidates.sort((a, b) => b.priorityScore - a.priorityScore)
 * ```
 */
export async function boostNetworkMatches<T extends { id: string; priorityScore?: number }>(
  candidates: T[],
  founderId: string
): Promise<T[]> {
  const networkCandidateIds = await getNetworkCandidateIds(founderId);
  const networkSet = new Set(networkCandidateIds);

  return candidates.map(candidate => {
    if (networkSet.has(candidate.id)) {
      return {
        ...candidate,
        priorityScore: (candidate.priorityScore || 0) + 20,
      };
    }
    return candidate;
  });
}

/**
 * Sort candidates with network matches first
 * Network matches appear at the top, then sorted by other criteria
 *
 * Usage example:
 * ```typescript
 * const candidates = await searchCandidates(query);
 * const sortedCandidates = await sortWithNetworkFirst(candidates, founderId);
 * ```
 */
export async function sortWithNetworkFirst<T extends { id: string }>(
  candidates: T[],
  founderId: string,
  sortFn?: (a: T, b: T) => number
): Promise<T[]> {
  const networkCandidateIds = await getNetworkCandidateIds(founderId);
  const networkSet = new Set(networkCandidateIds);

  // Separate network and non-network candidates
  const networkCandidates = candidates.filter(c => networkSet.has(c.id));
  const nonNetworkCandidates = candidates.filter(c => !networkSet.has(c.id));

  // Apply custom sort within each group if provided
  if (sortFn) {
    networkCandidates.sort(sortFn);
    nonNetworkCandidates.sort(sortFn);
  }

  // Network candidates first, then others
  return [...networkCandidates, ...nonNetworkCandidates];
}

/**
 * Get count of network matches in Hermes database
 */
export async function getNetworkMatchCount(founderId: string): Promise<number> {
  const client = supabaseAdmin || supabase;

  const { count, error } = await client
    .from('founder_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', founderId)
    .not('matched_candidate_id', 'is', null);

  return count || 0;
}
