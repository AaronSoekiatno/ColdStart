import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file FIRST before any other imports
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { upsertCandidate } from '@/lib/pinecone';
import { normalizeUniversityName, normalizeName, normalizeMajor, normalizeEducationLevel } from '@/lib/normalize-candidate-data';

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
 * Build embedding text from candidate data
 */
function buildEmbeddingText(candidate: any): string {
  const skills = candidate.skills ? candidate.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const experience = candidate.experience ? candidate.experience.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
  const technical_projects = candidate.technical_projects ? candidate.technical_projects.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
  
  const roleTypes = Array.isArray(candidate.role_type) 
    ? candidate.role_type.filter(Boolean)
    : candidate.role_type 
      ? [candidate.role_type].filter(Boolean)
      : [];

  const majors = Array.isArray(candidate.major) ? candidate.major.join(', ') : (candidate.major || '');

  return `
Technical Skills: ${skills.join(', ')}
Location: ${candidate.location || 'Not specified'}
Education: ${candidate.education_level || 'Not specified'} in ${majors} from ${candidate.university || 'Not specified'}
Experience: ${experience.length > 0 ? experience.join('; ') : 'None listed'}
Technical Projects: ${technical_projects.length > 0 ? technical_projects.join('; ') : 'None listed'}
Role Types: ${roleTypes.length > 0 ? roleTypes.join(', ') : 'Not specified'}
Years of Experience: ${candidate.years_of_experience || 'Not specified'}
  `.trim();
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
 * Process a single candidate: Normalize data and update if changed
 */
async function processCandidate(candidate: any, indexNum: number, total: number): Promise<boolean> {
  const email = candidate.email;
  
  const normalizedName = normalizeName(candidate.name) || candidate.name;
  const normalizedUniversity = normalizeUniversityName(candidate.university) || candidate.university;
  const normalizedEduLevel = normalizeEducationLevel(candidate.education_level) || candidate.education_level;
  
  let currentMajors = Array.isArray(candidate.major) ? candidate.major : [candidate.major].filter(Boolean);
  const normalizedMajors = currentMajors.map((m: string) => normalizeMajor(m)).filter((m: string | null): m is string => !!m);

  const hasNameChanged = candidate.name !== normalizedName;
  const hasUniversityChanged = candidate.university !== normalizedUniversity;
  const hasEduLevelChanged = candidate.education_level !== normalizedEduLevel;
  const hasMajorsChanged = JSON.stringify(currentMajors) !== JSON.stringify(normalizedMajors);

  if (!hasNameChanged && !hasUniversityChanged && !hasEduLevelChanged && !hasMajorsChanged) {
    console.log(`[${indexNum + 1}/${total}] Skipping: ${email} (No changes needed)`);
    return false;
  }

  console.log(`[${indexNum + 1}/${total}] Normalizing candidate: ${email}`);
  if (hasNameChanged) console.log(`  Name: "${candidate.name}" -> "${normalizedName}"`);
  if (hasUniversityChanged) console.log(`  University: "${candidate.university}" -> "${normalizedUniversity}"`);
  if (hasEduLevelChanged) console.log(`  Edu Level: "${candidate.education_level}" -> "${normalizedEduLevel}"`);
  if (hasMajorsChanged) console.log(`  Majors: [${currentMajors}] -> [${normalizedMajors}]`);

  try {
    // 1. Update in Supabase
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ 
        name: normalizedName,
        university: normalizedUniversity,
        education_level: normalizedEduLevel,
        major: normalizedMajors
      })
      .eq('email', email);

    if (updateError) {
      throw new Error(`Failed to update Supabase: ${updateError.message}`);
    }

    // 2. Build new embedding text with normalized data
    const updatedCandidate = { 
      ...candidate, 
      name: normalizedName,
      university: normalizedUniversity,
      education_level: normalizedEduLevel,
      major: normalizedMajors
    };
    const embeddingText = buildEmbeddingText(updatedCandidate);
    
    // 3. Generate new embedding
    console.log(`  Generating new embedding...`);
    const embedding = await generateEmbedding(embeddingText);
    
    // 4. Update in Pinecone
    console.log(`  Updating Pinecone...`);
    await upsertCandidate(
      email,
      embedding,
      {
        name: normalizedName,
        email: email,
        skills: candidate.skills || '',
        location: candidate.location || '',
        education_level: normalizedEduLevel || '',
        university: normalizedUniversity || '',
        experience: candidate.experience || '',
        technical_projects: candidate.technical_projects || '',
      }
    );

    console.log(`  ✓ Successfully updated both databases`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error processing candidate ${email}: ${errorMessage}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting candidate data normalization...\n');

  try {
    let allCandidates: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('Fetching candidates from Supabase...');
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .range(from, from + batchSize - 1)
        .order('created_at', { ascending: true }); // Order to ensure consistent pagination

      if (error) {
        throw new Error(`Failed to fetch candidates at range ${from}-${from + batchSize - 1}: ${error.message}`);
      }

      if (data && data.length > 0) {
        allCandidates = [...allCandidates, ...data];
        console.log(`  Fetched ${allCandidates.length} candidates...`);
        from += batchSize;
        if (data.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const candidates = allCandidates;

    if (candidates.length === 0) {
      console.log('⚠️  No candidates found');
      return;
    }

    console.log(`✓ Found ${candidates.length} candidates\n`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const delayBetweenRequests = 300; 

    for (let i = 0; i < candidates.length; i++) {
      try {
        const wasUpdated = await processCandidate(candidates[i], i, candidates.length);
        if (wasUpdated) {
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
      }

      if (i < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Normalization complete!');
    console.log(`   Total Candidates: ${candidates.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
