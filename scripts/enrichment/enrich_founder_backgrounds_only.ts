/**
 * Focused Enrichment Script - Founder Backgrounds Only
 * 
 * This script ONLY populates the founder_backgrounds field for startups.
 * It's optimized for speed by:
 * - Only searching for founder/team information (not funding, jobs, etc.)
 * - Only updating the founder_backgrounds field
 * - Skipping all other enrichment logic
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  searchWeb,
  extractFounderBackgrounds,
  extractFounderDescriptionsWithLLM,
  isGeminiQuotaExceeded,
} from './web_search_agent';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface StartupRecord {
  id: string;
  name: string;
  founder_backgrounds?: string | null;
  founder_names?: string | null;
  [key: string]: any;
}

/**
 * Check if a field is null, undefined, or empty string
 */
function isEmptyOrNull(value: any): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Search for founder backgrounds only
 */
async function searchForFounderBackgrounds(startup: StartupRecord): Promise<string> {
  const companyName = startup.name;
  const founderNames = startup.founder_names || '';
  
  console.log(`  🔍 Searching for founder backgrounds: ${companyName}`);
  
  // Build search query - focus on biographical information
  let searchQuery = `${companyName} founder`;
  if (founderNames && founderNames.trim()) {
    // Use first founder name if available for more targeted search
    const firstFounder = founderNames.split(',')[0].trim();
    if (firstFounder && firstFounder !== 'Team' && firstFounder.length > 3) {
      // Search for biographical information about specific founder
      searchQuery = `${companyName} ${firstFounder} biography background experience education previous work`;
    } else {
      searchQuery = `${companyName} founder biography background experience education previous work`;
    }
  } else {
    searchQuery = `${companyName} founder biography background experience education previous work`;
  }
  
    console.log(`    Query: ${searchQuery}`);
  
  try {
    // Single focused search for founder/team information
    const results = await searchWeb(searchQuery);
    
    if (results.length === 0) {
      console.log(`    ⚠️  No search results found`);
      return '';
    }
    
    // Try LLM extraction first for full descriptions (better quality)
    const shouldUseLLM = process.env.GEMINI_API_KEY && !isGeminiQuotaExceeded();
    
    let backgrounds = '';
    if (shouldUseLLM) {
      try {
        console.log(`    🤖 Using LLM for full founder descriptions...`);
        backgrounds = await extractFounderDescriptionsWithLLM(results, companyName, founderNames);
        if (backgrounds && backgrounds.trim().length > 20) {
          console.log(`    ✅ Found full descriptions (${backgrounds.length} chars)`);
          return backgrounds.trim();
        }
      } catch (error) {
        console.warn(`    ⚠️  LLM extraction failed, using regex fallback: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Fallback to regex extraction if LLM not available or failed
    if (!backgrounds || backgrounds.trim().length <= 20) {
      console.log(`    📝 Using regex extraction...`);
      backgrounds = extractFounderBackgrounds(results, companyName);
    }
    
    if (backgrounds && backgrounds.trim()) {
      console.log(`    ✅ Found backgrounds: ${backgrounds.substring(0, 150)}${backgrounds.length > 150 ? '...' : ''}`);
      return backgrounds.trim();
    } else {
      console.log(`    ⚠️  No backgrounds extracted from results`);
      return '';
    }
  } catch (error) {
    console.warn(`    ⚠️  Search error: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

/**
 * Enrich a single startup's founder backgrounds
 */
async function enrichFounderBackgrounds(startup: StartupRecord): Promise<boolean> {
  try {
    console.log(`\n📊 Enriching founder backgrounds: ${startup.name}`);
    
    // Skip if already has backgrounds
    if (!isEmptyOrNull(startup.founder_backgrounds)) {
      console.log(`  ⏭️  Already has founder_backgrounds, skipping`);
      return true;
    }
    
    // Search for founder backgrounds
    const backgrounds = await searchForFounderBackgrounds(startup);
    
    if (!backgrounds || !backgrounds.trim()) {
      console.log(`  ⚠️  No founder backgrounds found`);
      return false;
    }
    
    // Update only founder_backgrounds field
    const { error } = await supabase
      .from('startups3')
      .update({ 
        founder_backgrounds: backgrounds.trim()
      })
      .eq('id', startup.id);
    
    if (error) {
      throw error;
    }
    
    console.log(`  ✅ Updated founder_backgrounds`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Get startups missing founder backgrounds
 */
async function getStartupsMissingBackgrounds(limit?: number): Promise<StartupRecord[]> {
  let query = supabase
    .from('startups3')
    .select('id, name, founder_backgrounds, founder_names')
    .or('founder_backgrounds.is.null,founder_backgrounds.eq.')
    .order('created_at', { ascending: true }); // Process oldest first
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw error;
  }
  
  // Filter out any that actually have backgrounds (Supabase OR doesn't handle empty strings well)
  return (data || []).filter(s => isEmptyOrNull(s.founder_backgrounds));
}

/**
 * Main enrichment function
 */
async function enrichFounderBackgroundsBatch(limit?: number) {
  console.log('🚀 Starting founder backgrounds enrichment...\n');
  
  // Get startups missing founder backgrounds
  const startups = await getStartupsMissingBackgrounds(limit);
  
  if (startups.length === 0) {
    console.log('✅ No startups need founder backgrounds enrichment!');
    return;
  }
  
  console.log(`Found ${startups.length} startups missing founder backgrounds\n`);
  console.log(`Processing with 1 second delay between startups...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ name: string; error: string }> = [];
  
  for (let i = 0; i < startups.length; i++) {
    const startup = startups[i];
    const progress = `[${i + 1}/${startups.length}]`;
    
    console.log(`\n${progress} Processing: ${startup.name}`);
    
    try {
      const success = await enrichFounderBackgrounds(startup);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ name: startup.name, error: errorMsg });
      console.log(`  ❌ Error: ${errorMsg}`);
    }
    
    // Add delay to avoid rate limiting (except for last item)
    if (i < startups.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Enrichment Complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total processed: ${startups.length}`);
  console.log(`✅ Successfully enriched: ${successCount}`);
  console.log(`❌ Failed/No data: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    errors.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
  
  // Show remaining count if we processed a limited batch
  if (limit && startups.length >= limit) {
    const remaining = await getStartupsMissingBackgrounds(1);
    if (remaining.length > 0) {
      console.log(`\n💡 Note: There are more startups needing enrichment.`);
      console.log(`   Run again to process more: npm run enrich:backgrounds ${limit}`);
    }
  }
}

/**
 * Enrich a specific startup by ID
 */
async function enrichFounderBackgroundsById(startupId: string) {
  const { data, error } = await supabase
    .from('startups3')
    .select('id, name, founder_backgrounds, founder_names')
    .eq('id', startupId)
    .single();
  
  if (error || !data) {
    throw new Error(`Startup not found: ${startupId}`);
  }
  
  await enrichFounderBackgrounds(data);
}

// Run if called directly
if (require.main === module) {
  // Get all arguments
  const args = process.argv.slice(2);
  
  // Check for --id= parameter
  let startupId: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--id=')) {
      startupId = arg.replace('--id=', '').trim();
      break;
    }
    if (arg === '--id' && i + 1 < args.length) {
      startupId = args[i + 1].trim();
      break;
    }
  }
  
  if (startupId) {
    // Enrich specific startup by ID
    console.log(`🎯 Enriching founder backgrounds for startup ID: ${startupId}\n`);
    enrichFounderBackgroundsById(startupId)
      .then(() => {
        console.log('\n✅ Enrichment completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Enrichment failed:', error);
        process.exit(1);
      });
  } else {
    // Enrich all startups missing backgrounds
    const numericArgs = args.filter(arg => !arg.startsWith('--') && !isNaN(parseInt(arg)));
    const limit = numericArgs.length > 0 ? parseInt(numericArgs[0]) : undefined;
    enrichFounderBackgroundsBatch(limit)
      .then(() => {
        console.log('\n✅ Enrichment completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Enrichment failed:', error);
        process.exit(1);
      });
  }
}

export { enrichFounderBackgroundsBatch, enrichFounderBackgroundsById, enrichFounderBackgrounds };

