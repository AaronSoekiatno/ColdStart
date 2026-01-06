import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file FIRST before any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { findMatchingStartups, upsertCandidate } from '../../lib/pinecone';

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

// Initialize Gemini for embeddings (if needed)
const geminiApiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
}

/**
 * Find startup IDs by names (batch lookup) - uses startups3 table
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

  // Batch queries in chunks to avoid overwhelming Supabase
  const BATCH_SIZE = 20;
  const batches: string[][] = [];
  
  for (let i = 0; i < validNames.length; i += BATCH_SIZE) {
    batches.push(validNames.slice(i, i + BATCH_SIZE));
  }

  // Process batches sequentially, but queries within each batch in parallel
  for (const batch of batches) {
    const lookupPromises = batch.map(async (name) => {
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

    const batchResults = await Promise.allSettled(lookupPromises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.id) {
        resultMap.set(result.value.name, result.value.id);
      }
    });

    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return resultMap;
}

/**
 * Build embedding text from candidate data
 */
function buildEmbeddingText(candidate: {
  skills?: string | null;
  location?: string | null;
  education_level?: string | null;
  university?: string | null;
  experience?: string | null;
  technical_projects?: string | null;
  role_type?: string[] | null;
  years_of_experience?: string | null;
}): string {
  const skills = candidate.skills ? candidate.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
  const experience = candidate.experience ? candidate.experience.split(',').map(e => e.trim()).filter(Boolean) : [];
  const technical_projects = candidate.technical_projects ? candidate.technical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
  
  const roleTypes = Array.isArray(candidate.role_type) 
    ? candidate.role_type.filter(Boolean)
    : candidate.role_type 
      ? [candidate.role_type].filter(Boolean)
      : [];

  const combinedText = `
Technical Skills: ${skills.join(', ')}
Location: ${candidate.location || 'Not specified'}
Education: ${candidate.education_level || 'Not specified'} from ${candidate.university || 'Not specified'}
Experience: ${experience.length > 0 ? experience.join('; ') : 'None listed'}
Technical Projects: ${technical_projects.length > 0 ? technical_projects.join('; ') : 'None listed'}
Role Types: ${roleTypes.length > 0 ? roleTypes.join(', ') : 'Not specified'}
Years of Experience: ${candidate.years_of_experience || 'Not specified'}
  `.trim();

  return combinedText;
}

/**
 * Generate embedding using Gemini with retry logic
 */
async function generateEmbedding(text: string, retries: number = 3): Promise<number[]> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is required to generate embeddings');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent({
        content: {
          role: 'user',
          parts: [{ text: text }],
        },
      });

      if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
        throw new Error('Failed to generate embedding: Invalid response structure');
      }

      return result.embedding.values;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('quota')) {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`  ⚠️  Rate limited, waiting ${delay}ms before retry ${attempt + 2}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      if (attempt === retries - 1) {
        throw new Error(`Failed to generate embedding after ${retries} attempts: ${errorMessage}`);
      }
    }
  }
  
  throw new Error('Failed to generate embedding: Unknown error');
}

/**
 * Save a startup to Supabase (startups3 table)
 */
async function saveStartup(startup: {
  id: string;
  name: string;
  industry?: string;
  description?: string;
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
    let embedding: number[] | null = null;
    try {
      const fetchResponse = await index.namespace('candidates').fetch([email]);
      const candidateRecord = fetchResponse.records[email];
      
      if (candidateRecord && candidateRecord.values) {
        embedding = candidateRecord.values;
        console.log(`  ✓ Found embedding in Pinecone (${embedding.length} dimensions)`);
      }
    } catch (error) {
      // Embedding not found, will try to generate from resume
    }

    // If no embedding found, try to generate from candidate data or resume
    if (!embedding) {
      console.log(`  ⚠️  No embedding found in Pinecone, attempting to generate from resume data...`);
      
      // Check if candidate has data to generate embedding
      const hasData = candidate.skills || candidate.experience || candidate.technical_projects;
      
      let embeddingText = '';
      
      if (hasData) {
        // Use candidate's structured data
        embeddingText = buildEmbeddingText(candidate);
      } else {
        // Try to get resume from resumes table
        const { data: resume, error: resumeError } = await supabase
          .from('resumes')
          .select('resume_full_text')
          .eq('candidate_id', candidate.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (resumeError || !resume || !resume.resume_full_text) {
          console.warn(`  ⚠️  No candidate data or resume found. Skipping candidate.`);
          return;
        }

        // Use resume text directly for embedding (simpler than parsing)
        // Note: This is less optimal than structured data, but works for candidates without structured fields
        embeddingText = resume.resume_full_text.substring(0, 8000); // Limit to avoid token limits
        console.log(`  Using resume text for embedding (${embeddingText.length} chars)`);
      }
      
      if (!embeddingText || embeddingText.trim().length === 0) {
        console.warn(`  ⚠️  No data available to generate embedding. Skipping candidate.`);
        return;
      }

      console.log(`  Generating embedding...`);
      embedding = await generateEmbedding(embeddingText);
      console.log(`  ✓ Generated embedding (${embedding.length} dimensions)`);

      // Save embedding to Pinecone for future use
      try {
        await upsertCandidate(
          email,
          embedding,
          {
            name: candidate.name || 'Unknown',
            email: email,
            skills: candidate.skills || '',
            location: candidate.location || '',
            education_level: candidate.education_level || '',
            university: candidate.university || '',
            experience: candidate.experience || '',
            technical_projects: candidate.technical_projects || '',
          }
        );
        console.log(`  ✓ Saved embedding to Pinecone`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to save embedding to Pinecone:`, error);
      }
    }

    // Find matching startups
    console.log('  Finding matches...');
    const maxMatches = 10000;
    const matches = await findMatchingStartups(embedding, maxMatches);

    if (matches.length === 0) {
      console.log(`  ⚠️  No matches found`);
      return;
    }

    console.log(`  ✓ Found ${matches.length} matches`);

    // Map Pinecone matches to Supabase startup IDs (using startups3 table)
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

    // Deduplicate matches by startup_id (keep highest score for each)
    const uniqueMatches = new Map<string, number>();
    for (const match of matchMappings) {
      const existingScore = uniqueMatches.get(match.startup_id);
      if (!existingScore || match.score > existingScore) {
        uniqueMatches.set(match.startup_id, match.score);
      }
    }

    // Convert back to array
    const deduplicatedMatches = Array.from(uniqueMatches.entries()).map(([startup_id, score]) => ({
      startup_id,
      score,
    }));

    // Save matches to Supabase
    console.log(`  Saving ${deduplicatedMatches.length} matches (${matchMappings.length - deduplicatedMatches.length} duplicates removed)...`);
    await saveMatches(candidate.id, deduplicatedMatches);
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
    // Fetch all candidates from Supabase with their data for embedding generation
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, email, name, skills, location, education_level, university, experience, technical_projects, role_type, years_of_experience');

    if (error) {
      throw new Error(`Failed to fetch candidates: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  No candidates found');
      return;
    }

    console.log(`✓ Found ${candidates.length} candidates\n`);
    console.log('📝 Rematching candidates with startups in parallel batches...\n');

    // Configuration for parallel processing
    const CONCURRENCY = 5; // Number of candidates to process in parallel
    const BATCH_DELAY_MS = 500; // Delay between batches to avoid overwhelming APIs

    let successCount = 0;
    let errorCount = 0;

    // Process candidates in batches
    const totalBatches = Math.ceil(candidates.length / CONCURRENCY);
    
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      const batch = candidates.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} candidates in parallel)...\n`);

      // Process batch in parallel
      const batchPromises = batch.map((candidate, batchIndex) => 
        rematchCandidate(candidate, i + batchIndex, candidates.length)
          .then(() => {
            successCount++;
            return { success: true, candidate: candidate.email };
          })
          .catch((error) => {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ Failed to rematch candidate ${i + batchIndex + 1} (${candidate.email}): ${errorMessage}`);
            return { success: false, candidate: candidate.email, error: errorMessage };
          })
      );

      // Wait for all candidates in batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Log batch summary
      const batchSuccesses = batchResults.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      const batchErrors = batchResults.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length;
      
      console.log(`\n✓ Batch ${batchNum}/${totalBatches} complete: ${batchSuccesses} succeeded, ${batchErrors} failed`);
      console.log(`   Progress: ${Math.min(i + CONCURRENCY, candidates.length)}/${candidates.length} candidates processed`);

      // Add delay between batches to avoid rate limits
      if (i + CONCURRENCY < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
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

