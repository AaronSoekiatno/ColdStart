import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file FIRST before any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { findMatchingStartups } from '../lib/pinecone';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Initialize Pinecone
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';

if (!pineconeApiKey) {
  throw new Error('PINECONE_API_KEY is required');
}

const pinecone = new Pinecone({ apiKey: pineconeApiKey });
const index = pinecone.index(pineconeIndexName);

/**
 * Find startup IDs by names (batch lookup)
 * Uses parallel individual lookups for case-insensitive matching
 */
async function findStartupIdsByNames(names: string[]): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  if (!names || names.length === 0) {
    return resultMap;
  }

  // Filter out empty names and normalize
  const validNames = names
    .filter(name => name && name.trim() !== '')
    .map(name => name.trim());

  if (validNames.length === 0) {
    return resultMap;
  }

  // Use parallel individual lookups for case-insensitive matching
  const lookupPromises = validNames.map(async (name) => {
    try {
      const { data, error } = await supabase
        .from('startups3')
        .select('id')
        .ilike('name', name.trim())
        .limit(1)
        .single();

      if (error || !data) {
        return { name, id: null };
      }

      return { name, id: data.id };
    } catch (error) {
      return { name, id: null };
    }
  });

  const results = await Promise.all(lookupPromises);
  
  results.forEach(({ name, id }) => {
    if (id) {
      resultMap.set(name, id);
    }
  });

  return resultMap;
}

/**
 * Save a startup to Supabase
 */
async function saveStartup(startup: {
  id: string;
  name: string;
  industry?: string;
  description?: string;
  funding_stage?: string;
  funding_amount?: string;
  location?: string;
  website?: string;
  keywords?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('startups3')
    .upsert({
      id: startup.id,
      name: startup.name,
      industry: startup.industry || '',
      description: startup.description || '',
      funding_stage: startup.funding_stage || '',
      funding_amount: startup.funding_amount || '',
      location: startup.location || '',
      website: startup.website || '',
      keywords: startup.keywords || '',
    }, {
      onConflict: 'id',
    });

  if (error) {
    throw new Error(`Failed to save startup: ${error.message}`);
  }
}

/**
 * Save multiple matches for a candidate
 */
async function saveMatches(
  candidateId: string,
  matches: Array<{ startup_id: string; score: number }>
): Promise<void> {
  // Delete all existing matches for this candidate first
  const { error: deleteError } = await supabase
    .from('matches')
    .delete()
    .eq('candidate_id', candidateId);

  if (deleteError) {
    throw new Error(`Failed to clear old matches: ${deleteError.message}`);
  }

  // Insert new matches
  const matchRows = matches.map((match) => ({
    candidate_id: candidateId,
    startup_id: match.startup_id,
    score: match.score,
    matched_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('matches')
    .insert(matchRows);

  if (insertError) {
    throw new Error(`Failed to save matches: ${insertError.message}`);
  }
}

/**
 * Rematch a single candidate with startups
 */
async function rematchCandidate(candidate: any, indexNum: number, total: number): Promise<void> {
  const email = candidate.email;
  console.log(`[${indexNum + 1}/${total}] Rematching: ${candidate.name || email}`);

  try {
    // Fetch candidate's embedding from Pinecone
    const fetchResponse = await index.namespace('candidates').fetch([email]);
    const candidateRecord = fetchResponse.records[email];
    
    if (!candidateRecord || !candidateRecord.values) {
      console.warn(`  ⚠️  No embedding found in Pinecone for ${email}`);
      return;
    }

    const embedding = candidateRecord.values;
    console.log(`  ✓ Found embedding (${embedding.length} dimensions)`);

    // Find matching startups
    console.log('  Finding matches...');
    const maxMatches = 10000;
    const matches = await findMatchingStartups(embedding, maxMatches);

    if (matches.length === 0) {
      console.log(`  ⚠️  No matches found`);
      return;
    }

    console.log(`  ✓ Found ${matches.length} matches`);

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
        startupsToCreate.push({ match });
      }
    }

    // Create missing startups
    if (startupsToCreate.length > 0) {
      console.log(`  Creating ${startupsToCreate.length} missing startups...`);
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
          console.warn(`    ⚠️  Failed to create startup "${match.metadata.name}":`, error);
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
    console.log(`  Saving ${matchMappings.length} matches...`);
    await saveMatches(candidate.id, matchMappings);
    console.log(`  ✓ Successfully rematched`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error rematching candidate: ${errorMessage}`);
  }
}

/**
 * Main function to rematch all candidates
 */
async function main() {
  console.log('🚀 Starting rematch for all candidates...\n');

  try {
    // Fetch all candidates from Supabase
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, email, name');

    if (error) {
      throw new Error(`Failed to fetch candidates: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  No candidates found');
      return;
    }

    console.log(`✓ Found ${candidates.length} candidates\n`);
    console.log('📝 Rematching candidates with startups...\n');

    let successCount = 0;
    let errorCount = 0;

    // Process candidates with a delay to avoid rate limits
    const delayBetweenRequests = 200; // 200ms delay

    for (let i = 0; i < candidates.length; i++) {
      try {
        await rematchCandidate(candidates[i], i, candidates.length);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to rematch candidate ${i + 1}: ${errorMessage}`);
      }

      // Add delay between requests
      if (i < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Rematch complete!');
    console.log(`   Successfully rematched: ${successCount}/${candidates.length}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

