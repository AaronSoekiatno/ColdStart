import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file FIRST before any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { upsertCandidate } from '../lib/pinecone';

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
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * Build embedding text from candidate data (includes role preferences and experience level)
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
  // Parse comma-separated strings into arrays (matching ResumeExtractionResult format)
  const skills = candidate.skills ? candidate.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
  const experience = candidate.experience ? candidate.experience.split(',').map(e => e.trim()).filter(Boolean) : [];
  const technical_projects = candidate.technical_projects ? candidate.technical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
  
  // Handle role_type as array (it's TEXT[] in database)
  const roleTypes = Array.isArray(candidate.role_type) 
    ? candidate.role_type.filter(Boolean)
    : candidate.role_type 
      ? [candidate.role_type].filter(Boolean)
      : [];

  // Build text including role preferences and experience level for better matching
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
 * Re-embed a single candidate
 */
async function reEmbedCandidate(candidate: any, indexNum: number, total: number): Promise<void> {
  const email = candidate.email;
  console.log(`[${indexNum + 1}/${total}] Re-embedding: ${candidate.name || email}`);

  try {
    // Check if candidate has required data
    if (!candidate.skills && !candidate.experience && !candidate.technical_projects) {
      console.warn(`  ⚠️  Skipping: No skills, experience, or technical_projects data`);
      return;
    }

    // Build embedding text from candidate data
    const embeddingText = buildEmbeddingText(candidate);
    
    if (!embeddingText || embeddingText.trim().length === 0) {
      console.warn(`  ⚠️  Skipping: Empty embedding text`);
      return;
    }

    console.log(`  Generating embedding...`);
    
    // Generate new embedding
    const embedding = await generateEmbedding(embeddingText);
    
    if (embedding.length === 0) {
      console.warn(`  ⚠️  Failed to generate embedding`);
      return;
    }

    console.log(`  ✓ Generated embedding (${embedding.length} dimensions)`);

    // Upsert to Pinecone with updated metadata
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

    console.log(`  ✓ Successfully re-embedded to Pinecone`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error re-embedding candidate: ${errorMessage}`);
    throw error; // Re-throw to count errors
  }
}

/**
 * Main function to re-embed all candidates
 */
async function main() {
  console.log('🚀 Starting re-embedding for all candidates...\n');

  try {
    // Fetch all candidates from Supabase with all fields needed for embedding
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
    console.log('📝 Re-embedding candidates...\n');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process candidates with a delay to avoid rate limits
    const delayBetweenRequests = 500; // 500ms delay to be safe with Gemini API

    for (let i = 0; i < candidates.length; i++) {
      try {
        const candidate = candidates[i];
        
        // Check if we should skip this candidate
        if (!candidate.skills && !candidate.experience && !candidate.technical_projects) {
          skippedCount++;
          continue;
        }

        await reEmbedCandidate(candidate, i, candidates.length);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to re-embed candidate ${i + 1}: ${errorMessage}`);
      }

      // Add delay between requests to avoid rate limits
      if (i < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Re-embedding complete!');
    console.log(`   Successfully re-embedded: ${successCount}/${candidates.length}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    if (skippedCount > 0) {
      console.log(`   Skipped: ${skippedCount}`);
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

