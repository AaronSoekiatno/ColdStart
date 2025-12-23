/**
 * Script to remove startups with team size over 50 from startups3 table
 * 
 * This script identifies and removes all rows where team_size indicates
 * more than 50 employees (e.g., "50-200", "200+", "500+", etc.)
 * 
 * Usage:
 *   npx tsx yc_companies/remove_large_teams.ts [--dry-run]
 * 
 * Options:
 *   --dry-run: Preview what will be deleted without actually deleting
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

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
  team_size: string | null;
  yc_link?: string | null;
  batch?: string | null;
}

/**
 * Parse team_size string and determine if it represents more than 50 employees
 * Handles formats like:
 * - "1-10" -> false (range is entirely <= 50)
 * - "10-50" -> false (range is entirely <= 50)
 * - "50-200" -> true (range includes values > 50)
 * - "51-200" -> true
 * - "200+" -> true
 * - "500+" -> true
 * - "50" -> false (exactly 50, not > 50)
 * - "51" -> true
 */
function isTeamSizeOver50(teamSize: string | null): boolean {
  if (!teamSize || teamSize.trim() === '') {
    return false;
  }

  const cleaned = teamSize.trim();

  // Handle ranges like "10-50", "50-200", etc.
  const rangeMatch = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const lower = parseInt(rangeMatch[1], 10);
    const upper = parseInt(rangeMatch[2], 10);
    // If the range includes any value > 50, delete it
    // This means upper bound must be > 50
    return upper > 50;
  }

  // Handle "+" suffix like "200+", "500+"
  const plusMatch = cleaned.match(/^(\d+)\+$/);
  if (plusMatch) {
    const number = parseInt(plusMatch[1], 10);
    // If it's "50+", that means >= 50, but we want > 50, so check if number > 50
    return number > 50;
  }

  // Handle single numbers like "50", "51", "200"
  const singleMatch = cleaned.match(/^(\d+)$/);
  if (singleMatch) {
    const number = parseInt(singleMatch[1], 10);
    return number > 50;
  }

  // If format doesn't match expected patterns, return false to be safe
  console.warn(`⚠️  Unexpected team_size format: "${teamSize}" - treating as not over 50`);
  return false;
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function removeLargeTeams(dryRun: boolean = false): Promise<void> {
  console.log('='.repeat(70));
  console.log('REMOVING STARTUPS WITH TEAM SIZE OVER 50 FROM startups3 TABLE');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Preview Only)' : '✏️  LIVE DELETE'}\n`);

  // Fetch all startups with team_size (using pagination to get all rows)
  console.log('📂 Fetching all startups from startups3 table...');
  const pageSize = 1000;
  let allStartups: Startup[] = [];
  let pageNum = 0;
  let hasMore = true;

  while (hasMore) {
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;
    
    const { data: startups, error: fetchError } = await supabase
      .from('startups3')
      .select('id, name, team_size, yc_link, batch')
      .not('team_size', 'is', null)
      .neq('team_size', '')
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
    console.log('✅ No startups with team_size found.');
    return;
  }

  console.log(`\n   ✅ Found ${allStartups.length} total startups with team_size\n`);

  // Filter startups with team size over 50
  const startupsToDelete = allStartups.filter(startup => isTeamSizeOver50(startup.team_size));

  // Display summary
  console.log('📊 SUMMARY:');
  console.log(`   Total startups with team_size: ${allStartups.length}`);
  console.log(`   Startups with team size > 50: ${startupsToDelete.length}`);
  console.log(`   Startups to keep: ${allStartups.length - startupsToDelete.length}\n`);

  if (startupsToDelete.length === 0) {
    console.log('✅ No startups found with team size over 50. Nothing to delete.');
    return;
  }

  // Show preview of startups to be deleted
  console.log(`📋 STARTUPS TO BE DELETED (${startupsToDelete.length} total):`);
  console.log('-'.repeat(70));
  
  const showAll = dryRun || startupsToDelete.length <= 50;
  const displayStartups = showAll ? startupsToDelete : startupsToDelete.slice(0, 50);
  
  for (const startup of displayStartups) {
    console.log(`   • ${startup.name}`);
    console.log(`     ID: ${startup.id}`);
    console.log(`     Team Size: ${startup.team_size || 'N/A'}`);
    if (startup.yc_link) console.log(`     YC Link: ${startup.yc_link}`);
    if (startup.batch) console.log(`     Batch: ${startup.batch}`);
    console.log('');
  }
  
  if (!showAll) {
    console.log(`   ... and ${startupsToDelete.length - 50} more startups`);
    console.log(`   Run without --dry-run to see all startups, or modify the script to show more`);
  }
  
  console.log('-'.repeat(70));

  // Apply deletion if not dry run
  if (!dryRun && startupsToDelete.length > 0) {
    console.log(`\n⚠️  WARNING: You are about to DELETE ${startupsToDelete.length} rows from startups3 table!`);
    console.log('   This action cannot be undone.\n');
    
    const confirmed = await askConfirmation('   Type "yes" to confirm deletion: ');
    
    if (!confirmed) {
      console.log('\n❌ Deletion cancelled by user.');
      return;
    }

    console.log('\n💾 Deleting startups from database...');

    // Delete in batches to avoid overwhelming the database
    const batchSize = 100;
    let deletedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < startupsToDelete.length; i += batchSize) {
      const batch = startupsToDelete.slice(i, i + batchSize);
      const idsToDelete = batch.map(s => s.id);
      
      const { error: deleteError } = await supabase
        .from('startups3')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, deleteError);
        errorCount += batch.length;
      } else {
        deletedCount += batch.length;
        console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(startupsToDelete.length / batchSize)} (${deletedCount} total)`);
      }
    }

    console.log('\n📊 FINAL RESULTS:');
    console.log(`   Successfully deleted: ${deletedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('\n✅ Deletion complete!');
  } else if (dryRun) {
    console.log('\n💡 This was a dry run. To actually delete these startups, run without --dry-run flag.');
  }

  console.log('='.repeat(70));
}

// Main execution
const isDryRun = process.argv.includes('--dry-run');

removeLargeTeams(isDryRun)
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

