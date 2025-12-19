import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
// Try current directory first, then parent directory
const currentDir = process.cwd();
const parentDir = resolve(currentDir, '..');
const envPath = resolve(currentDir, '.env.local');
const parentEnvPath = resolve(parentDir, '.env.local');

// Try parent directory first (if running from yc_companies folder)
const result = config({ path: parentEnvPath }) || config({ path: envPath });
if (!result.parsed || Object.keys(result.parsed).length === 0) {
  console.warn('⚠️  No environment variables loaded. Make sure .env.local exists in project root.');
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processImagesInParallel } from './utils/image-storage';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in .env.local');
}

if (!supabaseKey) {
  throw new Error('Missing Supabase Service Role Key. Set SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Efficiently rescrapes and stores founder profile pictures for all companies
 * Processes companies in parallel batches for maximum efficiency
 */
async function rescrapeAllPfps() {
  console.log('🚀 Starting batch rescraping of founder profile pictures...\n');

  // Get all companies that have founder profile pictures
  const { data: startups, error } = await supabase
    .from('startups3')
    .select('id, name, founders_pfp, founder_names, yc_link')
    .not('founders_pfp', 'is', null);

  if (error) {
    console.error('❌ Error fetching startups:', error);
    return;
  }

  if (!startups || startups.length === 0) {
    console.log('⚠️  No startups with founder profile pictures found.');
    return;
  }

  console.log(`📊 Found ${startups.length} startups with founder profile pictures\n`);

  const BATCH_SIZE = 10; // Process 10 companies in parallel
  const IMAGE_CONCURRENCY = 5; // Process 5 images in parallel per company
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process in batches
  for (let i = 0; i < startups.length; i += BATCH_SIZE) {
    const batch = startups.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(startups.length / BATCH_SIZE)} (${batch.length} companies)`);

    // Process batch in parallel
    const batchPromises = batch.map(async (startup) => {
      try {
        // Parse founder profile pictures (could be array or string)
        let pfpUrls: string[] = [];
        if (Array.isArray(startup.founders_pfp)) {
          pfpUrls = startup.founders_pfp.map(url => String(url).trim());
        } else if (typeof startup.founders_pfp === 'string') {
          pfpUrls = startup.founders_pfp.split(',').map(url => url.trim());
        }

        if (pfpUrls.length === 0) {
          skippedCount++;
          return;
        }

        // Check if URLs are already permanent (Supabase Storage URLs)
        const allPermanent = pfpUrls.every(url => 
          url.includes('supabase.co/storage') || url.includes('/api/image-proxy')
        );

        if (allPermanent) {
          console.log(`   ⏭️  ${startup.name}: All images already permanent, skipping...`);
          skippedCount++;
          return;
        }

        console.log(`   🔄 ${startup.name}: Processing ${pfpUrls.length} image(s)...`);

        // Parse founder names for better file naming
        const founderNames = startup.founder_names
          ? (Array.isArray(startup.founder_names) 
              ? startup.founder_names.map(n => String(n))
              : String(startup.founder_names).split(',').map(n => n.trim()))
          : [];

        // Download and store images
        const permanentUrls = await processImagesInParallel(
          pfpUrls,
          supabase,
          startup.name,
          founderNames,
          IMAGE_CONCURRENCY
        );

        if (permanentUrls.length === 0) {
          console.log(`   ⚠️  ${startup.name}: No images could be stored`);
          errorCount++;
          return;
        }

        // Update database with permanent URLs
        const { error: updateError } = await supabase
          .from('startups3')
          .update({ founders_pfp: permanentUrls })
          .eq('id', startup.id);

        if (updateError) {
          console.error(`   ❌ ${startup.name}: Failed to update database: ${updateError.message}`);
          errorCount++;
          return;
        }

        console.log(`   ✅ ${startup.name}: Stored ${permanentUrls.length}/${pfpUrls.length} images`);
        successCount++;
      } catch (error: any) {
        console.error(`   ❌ ${startup.name}: Error: ${error.message}`);
        errorCount++;
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < startups.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Rescraping Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⚠️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total: ${startups.length}`);
  console.log('='.repeat(60));
}

// Run the rescraping
rescrapeAllPfps()
  .then(() => {
    console.log('\n✨ Rescraping complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

