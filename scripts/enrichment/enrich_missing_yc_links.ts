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

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { enrichCompanyFromName } from '../scrapers/scrape_yc_companies';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Enrich startups from Supabase that have names but are missing yc_link
 */
async function enrichStartupsWithoutYCLinks() {
  console.log('🚀 Starting Enrichment for Startups Without YC Links...\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('startups3').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Fetch startups that have names but are missing yc_link
  console.log('📂 Fetching startups without YC links from Supabase...');

  let query = supabase
    .from('startups3')
    .select('id, name, batch')
    .not('name', 'is', null)  // Must have a name
    .is('yc_link', null);      // Must NOT have yc_link

  const { data: startups, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch startups: ${fetchError.message}`);
  }

  if (!startups || startups.length === 0) {
    console.log('❌ No startups found without YC links');
    return;
  }

  console.log(`   Found ${startups.length} startup(s) without YC links\n`);

  // Apply limit if specified
  let startupsToProcess = startups;
  if (limit && limit > 0) {
    startupsToProcess = startups.slice(0, limit);
    console.log(`   ⚠️  Limited to first ${limit} startups for testing\n`);
  }

  console.log(`📋 Startups to enrich: ${startupsToProcess.length}`);
  startupsToProcess.forEach((startup: any, i: number) => {
    console.log(`   ${i + 1}. ${startup.name}${startup.batch ? ` (${startup.batch})` : ''}`);
  });
  console.log('');

  // Launch Puppeteer browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('✓ Browser ready\n');

  // Track results
  const results = {
    success: 0,
    failed: 0,
    notFound: 0,
  };

  const failedStartups: Array<{ name: string; reason: string }> = [];
  const notFoundStartups: string[] = [];

  // Enrich each startup
  for (let i = 0; i < startupsToProcess.length; i++) {
    const startup = startupsToProcess[i];
    console.log(`\n[${ i + 1}/${startupsToProcess.length}] Processing: ${startup.name}`);
    if (startup.batch) {
      console.log(`   Batch: ${startup.batch}`);
    }

    try {
      const success = await enrichCompanyFromName(page, startup.name, startup.batch);

      if (success) {
        results.success++;
        console.log(`   ✅ Successfully enriched: ${startup.name}`);
      } else {
        results.notFound++;
        notFoundStartups.push(startup.name);
        console.log(`   ⚠️  Not found in YC directory: ${startup.name}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error: ${errorMsg}`);
      results.failed++;
      failedStartups.push({ name: startup.name, reason: errorMsg });
    }

    // Add delay between companies to avoid rate limiting
    if (i < startupsToProcess.length - 1) {
      const delay = 3000; // 3 seconds
      console.log(`   ⏳ Waiting ${delay / 1000} seconds before next startup...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Close browser
  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total startups processed: ${startupsToProcess.length}`);
  console.log(`✅ Successfully enriched: ${results.success}`);
  console.log(`❌ Failed (errors): ${results.failed}`);
  console.log(`🔍 Not found in YC: ${results.notFound}`);
  console.log('='.repeat(80));

  // Show failed startups
  if (failedStartups.length > 0) {
    console.log('\n❌ Failed Startups:');
    failedStartups.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.name}`);
      console.log(`      Reason: ${item.reason}`);
    });
  }

  // Show not found startups
  if (notFoundStartups.length > 0) {
    console.log('\n🔍 Not Found in YC Directory:');
    notFoundStartups.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });
    console.log('\n💡 Tip: These companies might not be YC companies, or the name might need adjustment.');
  }

  // Show remaining count
  const remaining = startups.length - startupsToProcess.length;
  if (remaining > 0) {
    console.log(`\n📝 Note: ${remaining} more startup(s) still need to be processed (use --limit to control batch size)`);
  }
}

// Run the enrichment
if (require.main === module) {
  enrichStartupsWithoutYCLinks()
    .then(() => {
      console.log('\n✅ Enrichment process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Enrichment process failed:', error);
      process.exit(1);
    });
}

export { enrichStartupsWithoutYCLinks };
