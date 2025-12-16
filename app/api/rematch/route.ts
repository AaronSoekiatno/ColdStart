import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
import { findMatchingStartups, getCandidateById } from '@/lib/pinecone';
import { saveMatches, findStartupIdsByNames, saveStartup } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/rematch
 * Rematches the authenticated user with startups in Pinecone
 * Uses the candidate's existing embedding from Pinecone
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get candidate from Supabase
    const candidate = await getCandidate(user.email);
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found. Please upload your resume first.' },
        { status: 404 }
      );
    }

    // Get candidate's embedding from Pinecone
    const candidatePinecone = await getCandidateById(user.email);
    if (!candidatePinecone || !candidatePinecone.metadata) {
      return NextResponse.json(
        { error: 'Candidate embedding not found in Pinecone. Please re-upload your resume.' },
        { status: 404 }
      );
    }

    // Note: The embedding is stored in Pinecone, but we need to get it
    // Since getCandidateById doesn't return the embedding vector, we'll need to fetch it differently
    // For now, let's check if we can get it from the candidate's stored data
    // Actually, we need to query Pinecone directly to get the vector
    
    const { Pinecone } = await import('@pinecone-database/pinecone');
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';
    
    if (!pineconeApiKey) {
      return NextResponse.json(
        { error: 'Pinecone not configured' },
        { status: 500 }
      );
    }

    const pinecone = new Pinecone({ apiKey: pineconeApiKey });
    const index = pinecone.index(pineconeIndexName);
    
    // Fetch the candidate's embedding from Pinecone
    const fetchResponse = await index.namespace('candidates').fetch([user.email]);
    const candidateRecord = fetchResponse.records[user.email];
    
    if (!candidateRecord || !candidateRecord.values) {
      return NextResponse.json(
        { error: 'Candidate embedding not found in Pinecone. Please re-upload your resume.' },
        { status: 404 }
      );
    }

    const embedding = candidateRecord.values;

    // Find matching startups (up to 10000 matches)
    const maxMatches = 10000;
    const matches = await findMatchingStartups(embedding, maxMatches);

    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches found',
        matches: [],
        count: 0,
      });
    }

    // Map Pinecone matches to Supabase startup IDs
    const startupNames = matches.map(match => match.metadata.name || 'Unknown');
    const startupIdMap = await findStartupIdsByNames(startupNames);
    
    const matchMappings: Array<{ startup_id: string; score: number }> = [];
    const startupsToCreate: Array<{ match: typeof matches[0] }> = [];

    for (const match of matches) {
      const startupName = match.metadata.name || 'Unknown';
      const supabaseStartupId = startupIdMap.get(startupName);

      if (supabaseStartupId) {
        matchMappings.push({
          startup_id: supabaseStartupId,
          score: match.score,
        });
      } else {
        // Queue for creation
        startupsToCreate.push({ match });
      }
    }

    // Create missing startups in parallel
    if (startupsToCreate.length > 0) {
      const createPromises = startupsToCreate.map(async ({ match }) => {
        try {
          const startupName = match.metadata.name || 'Unknown';
          await saveStartup({
            id: match.id,
            name: startupName,
            industry: match.metadata.industry || '',
            description: match.metadata.description || '',
            funding_stage: match.metadata.funding_stage || '',
            funding_amount: match.metadata.funding_amount || '',
            location: match.metadata.location || '',
            website: match.metadata.website || '',
            keywords: match.metadata.tags || '',
          });
          return { match, startupId: match.id };
        } catch (error) {
          console.warn(`Failed to create startup "${match.metadata.name}":`, error);
          return null;
        }
      });

      const createdStartups = await Promise.all(createPromises);
      
      createdStartups.forEach((result) => {
        if (result) {
          matchMappings.push({
            startup_id: result.startupId,
            score: result.match.score,
          });
        }
      });
    }

    // Save matches to Supabase
    await saveMatches(candidate.id, matchMappings);

    return NextResponse.json({
      success: true,
      message: `Successfully rematched with ${matches.length} startups`,
      matches: matches.map((match) => ({
        startup: match.metadata,
        score: match.score,
        id: match.id,
      })),
      count: matches.length,
    });

  } catch (error) {
    console.error('Error in rematch API:', error);
    return NextResponse.json(
      {
        error: 'Failed to rematch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


