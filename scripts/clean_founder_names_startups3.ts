/**
 * Script to clean false positive founder names from startups3 table
 * 
 * This script removes section headings, legal/document information, and other
 * non-name phrases that were mistakenly extracted as founder names.
 * 
 * Usage:
 *   npx tsx yc_companies/clean_founder_names_startups3.ts [--dry-run]
 * 
 * Options:
 *   --dry-run: Preview what will be changed without updating the database
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { cleanFounderNames } from '../lib/clean-founder-names';

// Load .env.local file from project root
const currentDir = process.cwd();
const possiblePaths = [
  join(currentDir, '.env.local'),
  join(currentDir, '..', '.env.local'),
  join(__dirname, '..', '.env.local'),
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  const result = config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No environment variables loaded. Make sure .env.local exists in project root.');
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing'}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing'}`);
  throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string;
  name: string;
  yc_link?: string;
  founder_names: string | null;
  founder_backgrounds?: string | null;
}

async function cleanFounderNamesInDatabase(dryRun: boolean = false): Promise<void> {
  console.log('='.repeat(70));
  console.log('CLEANING FALSE POSITIVE FOUNDER NAMES FROM startups3 TABLE');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Preview Only)' : '✏️  LIVE UPDATE'}\n`);

  // Fetch all startups with founder_names (using pagination to get all rows)
  console.log('📂 Fetching startups with founder_names from startups3 table...');
  const pageSize = 1000;
  let allStartups: Startup[] = [];
  let pageNum = 0;
  let hasMore = true;

  while (hasMore) {
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;
    
    const { data: startups, error: fetchError } = await supabase
      .from('startups3')
      .select('id, name, yc_link, founder_names, founder_backgrounds')
      .not('founder_names', 'is', null)
      .neq('founder_names', '')
      .range(from, to);

    if (fetchError) {
      console.error(`❌ Error fetching startups (page ${pageNum + 1}):`, fetchError);
      throw fetchError;
    }

    if (!startups || startups.length === 0) {
      hasMore = false;
    } else {
      allStartups = allStartups.concat(startups as Startup[]);
      console.log(`   Fetched page ${pageNum + 1}: ${startups.length} startups (total so far: ${allStartups.length})`);
      
      // If we got less than pageSize, we've reached the end
      if (startups.length < pageSize) {
        hasMore = false;
      } else {
        pageNum++;
      }
    }
  }

  if (allStartups.length === 0) {
    console.log('✅ No startups with founder_names found.');
    return;
  }

  console.log(`\n   ✅ Found ${allStartups.length} total startups with founder_names\n`);

  // Process each startup
  let updatedCount = 0;
  let unchangedCount = 0;
  const changes: Array<{ id: string; name: string; before: string; after: string }> = [];

  for (const startup of allStartups) {
    const originalNames = startup.founder_names;
    // Pass company name and founder_backgrounds to validate and clean names
    // Backgrounds can help identify real names even if they don't pass strict validation
    const cleanedNames = cleanFounderNames(
      originalNames, 
      startup.name,
      startup.founder_backgrounds || null
    );

    if (cleanedNames === null) {
      // Only null if original was already null/empty
      unchangedCount++;
    } else if (cleanedNames !== originalNames) {
      // Some names were filtered out, but we kept at least the original
      updatedCount++;
      changes.push({
        id: startup.id,
        name: startup.name,
        before: originalNames || '',
        after: cleanedNames,
      });
    } else {
      // No changes needed
      unchangedCount++;
    }
  }

  // Display summary
  console.log('📊 SUMMARY:');
  console.log(`   Total startups with founder_names: ${allStartups.length}`);
  console.log(`   Will be updated (some names removed): ${updatedCount}`);
  console.log(`   No changes needed: ${unchangedCount}`);
  console.log(`   Note: Founder names are never nulled - if all names are filtered, original is preserved for manual review\n`);

  // Show all changes (or sample if too many)
  if (changes.length > 0) {
    const showAll = dryRun || changes.length <= 50;
    const displayChanges = showAll ? changes : changes.slice(0, 50);
    
    console.log(showAll 
      ? `📋 ALL CHANGES (${changes.length} total):`
      : `📋 SAMPLE CHANGES (first 50 of ${changes.length} total):`);
    console.log('-'.repeat(70));
    
    for (const change of displayChanges) {
      console.log(`\n   Company: ${change.name}`);
      console.log(`   Before: "${change.before}"`);
      console.log(`   After:  "${change.after}"`);
    }
    
    if (!showAll) {
      console.log(`\n   ... and ${changes.length - 50} more changes`);
      console.log(`   Run without --dry-run to see all changes, or modify the script to show more`);
    }
    
    console.log('-'.repeat(70));
    
    // In dry-run mode, also offer to save to file
    if (dryRun && changes.length > 50) {
      console.log(`\n💡 Tip: There are ${changes.length} changes. Consider saving to a file for review.`);
    }
  }

  // Apply updates if not dry run
  if (!dryRun && changes.length > 0) {
    console.log('\n💾 Applying updates to database...');

    // Update entries with cleaned names (we never null entries)
    if (changes.length > 0) {
      // Update in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        
        for (const change of batch) {
          const { error: updateError } = await supabase
            .from('startups3')
            .update({ founder_names: change.after })
            .eq('id', change.id);

          if (updateError) {
            console.error(`❌ Error updating ${change.name}:`, updateError);
            throw updateError;
          }
        }
        
        console.log(`   ✅ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(changes.length / batchSize)}`);
      }
    }

    console.log('\n✅ Cleanup complete!');
  } else if (dryRun) {
    console.log('\n💡 This was a dry run. To apply changes, run without --dry-run flag.');
  } else {
    console.log('\n✅ No changes needed!');
  }

  console.log('='.repeat(70));
}

// Main execution
const isDryRun = process.argv.includes('--dry-run');

cleanFounderNamesInDatabase(isDryRun)
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

