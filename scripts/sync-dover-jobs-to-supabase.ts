/**
 * Sync Dover Job Board URLs to Supabase Startups Table
 *
 * This script:
 * 1. Pulls all startups from Supabase startups table
 * 2. For each startup, searches for their Dover job board
 * 3. Tests if the Dover job board exists (returns 200 status)
 * 4. Updates the job_listing field in Supabase startups table with the Dover jobs page link
 *
 * NOTE: Dover only provides company-level job boards, not individual job URLs
 *
 * Usage:
 *   npx tsx scripts/sync-dover-jobs-to-supabase.ts
 *   npx tsx scripts/sync-dover-jobs-to-supabase.ts --company "Harper"
 *   npx tsx scripts/sync-dover-jobs-to-supabase.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

interface SupabaseStartup {
  id: string;
  name: string;
  job_listing: string | null;
}

/**
 * Generate possible slug variations from company name
 */
function generateSlugVariations(companyName: string): string[] {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim();

  const words = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  const variations = [
    base, // e.g., "candid-health"
    base.replace(/-/g, ''), // e.g., "candidhealth"
    companyName.toLowerCase().replace(/\s+/g, ''), // No spaces, no hyphens
    words[0], // First word only, e.g., "candid"
    words.join(''), // All words concatenated, e.g., "candidhealth"
    words.join('-'), // All words with hyphens
    // Common patterns for multi-word companies
    ...(words.length >= 2
      ? [
          words[0] + words[1], // First two words, e.g., "candidhealth"
          words[0] + '-' + words[1], // First two words with hyphen
          words.slice(0, 2).join(''), // First two words
        ]
      : []),
    // Handle "Inc", "Corp", "LLC" suffix removal
    ...words
      .filter((w) => !['inc', 'llc', 'corp', 'corporation', 'limited'].includes(w))
      .reduce((acc: string[], _, idx, arr) => {
        if (arr.length !== words.length) {
          // Something was filtered out
          acc.push(arr.join(''));
          acc.push(arr.join('-'));
        }
        return acc;
      }, []),
  ];

  // Remove duplicates and empty strings
  return [...new Set(variations)].filter((v) => v.length > 0);
}

/**
 * Check if Dover job board exists and has active jobs for a given slug
 */
async function checkDoverJobBoard(slug: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `https://app.dover.com/jobs/${slug}`;

    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          // Check for redirects or non-200 status
          if (res.statusCode === 301 || res.statusCode === 302) {
            // Page redirects - likely doesn't exist
            resolve(false);
            res.resume();
            return;
          }

          if (res.statusCode !== 200) {
            resolve(false);
            res.resume();
            return;
          }

          // Read the response body to check if there are actual jobs
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            // Check for negative indicators first (more reliable)
            const noJobs =
              data.includes('No open positions') ||
              data.includes('no openings') ||
              data.includes('not currently hiring') ||
              data.includes('No jobs found') ||
              data.includes('404') ||
              data.includes('Page not found') ||
              data.includes('Page Not Found') ||
              data.includes('does not exist') ||
              data.includes('not found') ||
              data.length < 500; // Very short response likely means error page

            // If we have negative indicators, immediately return false
            if (noJobs) {
              resolve(false);
              return;
            }

            // Check for positive indicators - Dover job pages should have these
            const hasApplyButton = data.includes('Apply') || data.includes('apply');
            const hasJobIndicators =
              data.includes('Open position') ||
              data.includes('open role') ||
              data.includes('Job opening') ||
              data.includes('career');

            // Only resolve true if we have strong positive indicators
            resolve(hasApplyButton || hasJobIndicators);
          });
        }
      )
      .on('error', () => {
        resolve(false);
      });
  });
}

/**
 * Find Dover slug by trying variations
 */
async function findDoverSlug(companyName: string): Promise<string | null> {
  // Try common slug variations
  const variations = generateSlugVariations(companyName);

  console.log(`   🔍 Testing ${variations.length} slug variations...`);

  for (const slug of variations) {
    console.log(`      Testing: https://app.dover.com/jobs/${slug}`);
    const exists = await checkDoverJobBoard(slug);
    if (exists) {
      console.log(`      ✓ Found working Dover board!`);
      return slug;
    }
    // Small delay to avoid hammering server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // No slug found using variations
  console.log(`   ❌ No Dover board found using slug variations`);
  console.log(`   💡 Tip: Try manually checking https://app.dover.com/jobs/`);
  return null;
}

/**
 * Sync Dover job board URL for a specific startup
 */
async function syncStartupDoverURL(
  startup: SupabaseStartup,
  dryRun: boolean
): Promise<{ found: boolean; updated: boolean }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📍 Startup: ${startup.name}`);

  // Step 1: Find Dover slug
  console.log(`   🔍 Searching for Dover job board...`);
  const slug = await findDoverSlug(startup.name);

  if (!slug) {
    console.log(`   ❌ No Dover job board found`);
    return { found: false, updated: false };
  }

  const doverUrl = `https://app.dover.com/jobs/${slug}`;
  console.log(`   ✓ Found Dover board: ${doverUrl}`);

  // CRITICAL: Validate that we're ONLY adding Dover URLs
  if (!doverUrl.includes('dover.com')) {
    console.log(`   ❌ REJECTED: URL is not a Dover URL: ${doverUrl}`);
    console.log(`   ⚠️  This should never happen - please report this bug!`);
    return { found: false, updated: false };
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would update job_listing to: ${doverUrl}`);
    return { found: true, updated: false };
  } else {
    // Update Supabase startups table
    const { error } = await supabase
      .from('startups')
      .update({
        job_listing: doverUrl,
      })
      .eq('id', startup.id);

    if (error) {
      console.log(`   ❌ Failed to update: ${error.message}`);
      return { found: true, updated: false };
    } else {
      console.log(`   ✅ Updated job_listing in Supabase`);
      return { found: true, updated: true };
    }
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const companyFilter = args.includes('--company')
    ? args[args.indexOf('--company') + 1]
    : null;

  console.log('🚀 Dover Job Board URL Sync to Supabase Startups');
  console.log('='.repeat(60));
  if (dryRun) console.log('⚠️  DRY RUN MODE - No changes will be made');
  if (companyFilter) console.log(`🎯 Filtering to company: ${companyFilter}`);
  console.log('='.repeat(60));

  // Fetch all startups from Supabase
  console.log('\n📥 Fetching startups from Supabase...');

  let query = supabase.from('startups').select('id, name, job_listing');

  const { data, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch startups:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ No startups found in database');
    process.exit(0);
  }

  // Transform data
  const startups: SupabaseStartup[] = data.map((row: any) => ({
    id: row.id,
    name: row.name,
    job_listing: row.job_listing,
  }));

  console.log(`✓ Found ${startups.length} total startups`);

  // Filter if needed
  const startupsToProcess = companyFilter
    ? startups.filter((s) => s.name.toLowerCase().includes(companyFilter.toLowerCase()))
    : startups;

  if (startupsToProcess.length === 0) {
    console.log(`❌ No startups found matching filter: ${companyFilter}`);
    process.exit(0);
  }

  console.log(`\n🎯 Processing ${startupsToProcess.length} startups...\n`);

  // Process each startup
  let totalFound = 0;
  let totalUpdated = 0;

  for (let i = 0; i < startupsToProcess.length; i++) {
    const startup = startupsToProcess[i];

    const result = await syncStartupDoverURL(startup, dryRun);
    if (result.found) totalFound++;
    if (result.updated) totalUpdated++;

    // Delay between startups to avoid rate limiting
    if (i < startupsToProcess.length - 1) {
      console.log(`\n   ⏳ Waiting 2 seconds before next startup...\n`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Startups processed: ${startupsToProcess.length}`);
  console.log(`Dover boards found: ${totalFound}`);
  console.log(`Startups updated: ${totalUpdated}`);
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('Remove --dry-run flag to apply updates');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
