/**
 * Script to scrape yc_description for startups in startups3 table
 * that are missing this field
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
const currentDir = process.cwd();
const possiblePaths = [
  join(currentDir, '.env.local'),
  join(currentDir, '..', '.env.local'),
  join(__dirname, '..', '.env.local'),
  join(__dirname, '..', '..', '.env.local'),
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

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import puppeteer, { Browser, Page } from 'puppeteer';
import { scrapeYCCompanyPage } from './scrape_yc_companies';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string | number;
  name: string;
  yc_link?: string | null;
  yc_description?: string | null;
  batch?: string | null;
}

/**
 * Check if a startup is missing yc_description
 */
function isMissingYcDescription(startup: Startup): boolean {
  return !startup.yc_description || startup.yc_description.trim() === '';
}

/**
 * Main function to scrape yc_descriptions
 */
async function scrapeYcDescriptions(dryRun: boolean = false, limit?: number) {
  console.log('🔍 Starting scrape for startups missing yc_description...\n');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const batchFilter = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const finalLimit = limit || (limitArg ? parseInt(limitArg, 10) : undefined);
  
  // Fetch startups missing yc_description
  console.log('📂 Fetching startups from startups3 table...');
  let startups: Startup[] = [];
  let pageNum = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from('startups3')
      .select('id, name, yc_link, yc_description, batch')
      .not('yc_link', 'is', null) // Must have yc_link to scrape
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
    
    // Filter by batch if specified
    if (batchFilter) {
      query = query.eq('batch', batchFilter);
    }
    
    const { data: pageData, error: fetchError } = await query;
    
    if (fetchError) {
      throw new Error(`Failed to fetch startups: ${fetchError.message}`);
    }
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      // Filter to only those missing yc_description
      const missingDescriptions = pageData.filter(isMissingYcDescription);
      startups = startups.concat(missingDescriptions);
      hasMore = pageData.length === pageSize;
      pageNum++;
      console.log(`   Fetched ${startups.length} startups missing yc_description so far...`);
      
      // Apply limit early if specified
      if (finalLimit && startups.length >= finalLimit) {
        startups = startups.slice(0, finalLimit);
        hasMore = false;
      }
    }
  }
  
  if (startups.length === 0) {
    console.log('✅ No startups found missing yc_description!');
    return;
  }
  
  console.log(`   Found ${startups.length} startups missing yc_description\n`);
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN MODE - No data will be scraped or updated`);
    console.log(`   Would scrape ${startups.length} startup(s)`);
    console.log(`\n   First 10 startups to process:`);
    startups.slice(0, 10).forEach((startup, idx) => {
      console.log(`   ${idx + 1}. ${startup.name} (${startup.yc_link})`);
    });
    if (startups.length > 10) {
      console.log(`   ... and ${startups.length - 10} more`);
    }
    return;
  }
  
  // Launch browsers for parallel processing (5 concurrent workers)
  const CONCURRENT_WORKERS = 5;
  console.log(`🌐 Launching ${CONCURRENT_WORKERS} browsers for parallel processing...`);
  
  const browsers = await Promise.all(
    Array.from({ length: CONCURRENT_WORKERS }, () =>
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    )
  );
  
  // Create pages for each browser
  const pages = await Promise.all(
    browsers.map(async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      return page;
    })
  );
  
  // Process a single startup and return result
  async function processStartup(startup: Startup, page: Page, workerId: number, index: number): Promise<'success' | 'error' | 'skipped'> {
    console.log(`\n[${index}/${startups.length}] [Worker ${workerId}] Processing: ${startup.name}`);
    console.log(`   YC Link: ${startup.yc_link}`);
    
    try {
      // Scrape YC page using the function from scrape_yc_companies.ts
      const pageData = await scrapeYCCompanyPage(page, startup.yc_link!);
      
      if (!pageData) {
        console.log(`   [Worker ${workerId}] ⚠️  Could not scrape page data`);
        return 'error';
      }
      
      // Check if we got ycDescription
      if (!pageData.ycDescription || pageData.ycDescription.trim() === '') {
        console.log(`   [Worker ${workerId}] ⚠️  No yc_description found on page`);
        return 'skipped';
      }
      
      const ycDescription = pageData.ycDescription.trim();
      console.log(`   [Worker ${workerId}] 📝 Found yc_description (${ycDescription.length} characters)`);
      console.log(`   [Worker ${workerId}] Preview: ${ycDescription.substring(0, 100)}${ycDescription.length > 100 ? '...' : ''}`);
      
      // Update in Supabase
      const { error: updateError } = await supabase
        .from('startups3')
        .update({ yc_description: ycDescription })
        .eq('id', startup.id);
      
      if (updateError) {
        console.error(`   [Worker ${workerId}] ❌ Error updating: ${updateError.message}`);
        return 'error';
      } else {
        console.log(`   [Worker ${workerId}] ✅ Successfully updated yc_description`);
        return 'success';
      }
      
    } catch (error) {
      console.error(`   [Worker ${workerId}] ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      return 'error';
    }
  }
  
  // Process startups in parallel batches
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  try {
    for (let i = 0; i < startups.length; i += CONCURRENT_WORKERS) {
      const batch = startups.slice(i, i + CONCURRENT_WORKERS);
      
      // Process batch in parallel
      const results = await Promise.all(
        batch.map((startup, batchIndex) => {
          const workerId = batchIndex; // Each item in batch uses different worker
          const page = pages[workerId];
          const index = i + batchIndex + 1; // Calculate index for display
          return processStartup(startup, page, workerId + 1, index);
        })
      );
      
      // Aggregate results
      results.forEach(result => {
        if (result === 'success') successCount++;
        else if (result === 'error') errorCount++;
        else if (result === 'skipped') skippedCount++;
      });
      
      // Small delay between batches to avoid overwhelming the server
      if (i + CONCURRENT_WORKERS < startups.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    // Close all browsers
    await Promise.all(browsers.map(browser => browser.close()));
    console.log(`\n🌐 All ${CONCURRENT_WORKERS} browsers closed`);
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`   Total processed: ${startups.length}`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Skipped (no description found): ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Check for dry-run flag
const dryRun = process.argv.includes('--dry-run');

// Run the scraping
scrapeYcDescriptions(dryRun)
  .then(() => {
    console.log('\n✨ Scraping completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during scraping:', error);
    process.exit(1);
  });

