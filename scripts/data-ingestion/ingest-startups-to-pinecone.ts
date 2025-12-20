import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { upsertStartup } from '../lib/pinecone';
import { generateEmbeddingText } from '../yc_companies/scrape_techcrunch_supabase_pinecone';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini for embeddings
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is required for generating embeddings');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

// Check Pinecone environment variables
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';

if (!pineconeApiKey) {
  throw new Error('PINECONE_API_KEY is required for storing embeddings');
}

console.log(`✓ Using Pinecone index: ${pineconeIndexName}\n`);

/**
 * Generates an embedding using Gemini with retry logic
 */
async function generateEmbedding(text: string, retries: number = 3): Promise<number[]> {
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
      
      // Check for rate limit errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('quota')) {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.warn(`  ⚠️  Rate limited, waiting ${delay}ms before retry ${attempt + 2}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For non-rate-limit errors or final attempt, throw
      if (attempt === retries - 1) {
        throw new Error(`Failed to generate embedding after ${retries} attempts: ${errorMessage}`);
      }
    }
  }
  
  throw new Error('Failed to generate embedding: Unknown error');
}

/**
 * Process a single startup: generate embedding and store in Pinecone
 */
async function processStartup(startup: any, index: number, total: number): Promise<void> {
  const startupId = startup.id || startup.name?.toLowerCase().replace(/\s+/g, '-') || `startup-${index}`;
  
  console.log(`[${index + 1}/${total}] Processing: ${startup.name || 'Unknown'}`);

  try {
    // Generate embedding text using the same function as the scraper
    const embeddingText = generateEmbeddingText(
      startup.description || '',
      startup.name || '',
      startup.funding_stage || null,
      startup.funding_amount || null,
      startup.location || null,
      startup.industry || null,
      startup.business_type || null,
      {
        tech_stack: startup.tech_stack || null,
        team_size: startup.team_size || null,
        founder_backgrounds: startup.founder_backgrounds || null,
        website_keywords: startup.website_keywords || null,
        hiring_roles: startup.job_openings || null,
      }
    );

    if (!embeddingText || embeddingText.trim().length === 0) {
      console.warn(`  ⚠️  Skipping: No embedding text available`);
      return;
    }

    // Generate embedding
    console.log('  Generating embedding...');
    const embedding = await generateEmbedding(embeddingText);

    if (embedding.length === 0) {
      console.warn(`  ⚠️  Skipping: Empty embedding generated`);
      return;
    }

    console.log(`  ✓ Generated embedding (${embedding.length} dimensions)`);

    // Prepare metadata for Pinecone
    const tags = startup.business_type && startup.industry
      ? `${startup.business_type}, ${startup.industry}`
      : startup.business_type || startup.industry || '';

    const metadata = {
      name: startup.name || 'Unknown',
      industry: startup.industry || '',
      description: startup.description || '',
      funding_stage: startup.funding_stage || '',
      funding_amount: startup.funding_amount || '',
      location: startup.location || '',
      website: startup.website || '',
      tags: tags,
    };

    // Store in Pinecone using the library function
    console.log('  Storing in Pinecone...');
    await upsertStartup(startupId, embedding, metadata);
    console.log(`  ✓ Successfully stored in Pinecone (ID: ${startupId})`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error processing startup: ${errorMessage}`);
    // Continue with next startup instead of failing completely
  }
}

/**
 * Main function to ingest startups into Pinecone
 */
async function main() {
  const limit = 1000;
  
  console.log('🚀 Starting startup ingestion to Pinecone...\n');
  console.log(`📊 Fetching up to ${limit} startups from Supabase...\n`);

  try {
    // Fetch startups from Supabase
    const { data: startups, error } = await supabase
      .from('startups')
      .select('*')
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch startups: ${error.message}`);
    }

    if (!startups || startups.length === 0) {
      console.log('⚠️  No startups found in database');
      return;
    }

    console.log(`✓ Found ${startups.length} startups\n`);
    console.log('📝 Processing startups and generating embeddings...\n');

    // Process startups with a small delay between each to avoid rate limits
    const delayBetweenRequests = 100; // 100ms delay between requests
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < startups.length; i++) {
      try {
        await processStartup(startups[i], i, startups.length);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to process startup ${i + 1}: ${errorMessage}`);
      }

      // Add delay between requests to avoid rate limits
      if (i < startups.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Ingestion complete!');
    console.log(`   Successfully processed: ${successCount}/${startups.length}`);
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

