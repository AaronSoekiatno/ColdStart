/**
 * Script to retry filling keywords and batch for companies that failed previously
 * This will only process companies that still have missing keywords or batch
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';

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
  console.warn('⚠️  No environment variables loaded.');
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { scrapeYCCompanyPage } from './scrape_yc_companies';
import puppeteer, { Browser, Page } from 'puppeteer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string | number;
  name: string;
  yc_link?: string | null;
  batch?: string | null;
  keywords?: string | null;
  [key: string]: any;
}

/**
 * Find companies that still have missing keywords or batch
 */
async function findStillMissing() {
  console.log('🔍 Finding companies that still need keywords or batch...\n');
  
  let allStartups: Startup[] = [];
  let pageNum = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('startups3')
      .select('id, name, yc_link, batch, keywords')
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
    
    if (error) throw new Error(`Failed to fetch: ${error.message}`);
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      allStartups = allStartups.concat(pageData);
      hasMore = pageData.length === pageSize;
      pageNum++;
      console.log(`   Fetched ${allStartups.length} companies...`);
    }
  }
  
  console.log(`\n   Found ${allStartups.length} total companies\n`);
  
  // Find companies that still need data
  const stillNeedData = allStartups.filter(s => {
    const hasKeywords = s.keywords && typeof s.keywords === 'string' && s.keywords.trim() !== '';
    const hasBatch = s.batch && typeof s.batch === 'string' && s.batch.trim() !== '';
    const hasYcLink = s.yc_link && s.yc_link.trim() !== '';
    
    return hasYcLink && (!hasKeywords || !hasBatch);
  });
  
  const missingKeywords = stillNeedData.filter(s => {
    return !s.keywords || (typeof s.keywords === 'string' && s.keywords.trim() === '');
  });
  
  const missingBatch = stillNeedData.filter(s => {
    return !s.batch || (typeof s.batch === 'string' && s.batch.trim() === '');
  });
  
  console.log('📊 Still Missing Data:\n');
  console.log(`   Missing keywords: ${missingKeywords.length}`);
  console.log(`   Missing batch: ${missingBatch.length}`);
  console.log(`   Total to retry: ${stillNeedData.length}\n`);
  
  return stillNeedData;
}

/**
 * Retry filling missing keywords and batch
 */
async function retryFailed(dryRun: boolean = false) {
  const stillNeedData = await findStillMissing();
  
  if (stillNeedData.length === 0) {
    console.log('✅ All companies have keywords and batch! No retries needed.');
    return;
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No data will be scraped or updated\n');
    console.log(`   Would retry ${stillNeedData.length} company(ies)`);
    console.log('\n   First 10 companies to retry:');
    stillNeedData.slice(0, 10).forEach((s, idx) => {
      const needsKeywords = !s.keywords || (typeof s.keywords === 'string' && s.keywords.trim() === '');
      const needsBatch = !s.batch || (typeof s.batch === 'string' && s.batch.trim() === '');
      console.log(`   ${idx + 1}. ${s.name}`);
      console.log(`      YC Link: ${s.yc_link}`);
      console.log(`      Missing: ${needsKeywords ? 'keywords' : ''} ${needsBatch ? 'batch' : ''}`);
    });
    return;
  }
  
  // Process in parallel batches of 5
  const BATCH_SIZE = 5;
  let successCount = 0;
  let errorCount = 0;
  let keywordsFilled = 0;
  let batchFilled = 0;
  
  console.log(`\n🚀 Retrying ${stillNeedData.length} companies in parallel batches of ${BATCH_SIZE}...\n`);
  
  // Process companies in batches
  for (let batchStart = 0; batchStart < stillNeedData.length; batchStart += BATCH_SIZE) {
    const batch = stillNeedData.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(stillNeedData.length / BATCH_SIZE);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} companies)`);
    
    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (startup) => {
        const needsKeywords = !startup.keywords || (typeof startup.keywords === 'string' && startup.keywords.trim() === '');
        const needsBatch = !startup.batch || (typeof startup.batch === 'string' && startup.batch.trim() === '');
        
        // Launch browser for this request
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        try {
          console.log(`   [${startup.name}] Processing...`);
          
          // Scrape YC page
          const pageData = await scrapeYCCompanyPage(page, startup.yc_link!);
          
          if (!pageData) {
            console.log(`   [${startup.name}] ⚠️  Could not scrape page data`);
            return { success: false, startup: startup.name };
          }
          
          const updates: any = {};
          
          // Fill keywords if missing
          if (needsKeywords && pageData.tags && pageData.tags.length > 0) {
            updates.keywords = pageData.tags.join(', ');
            console.log(`   [${startup.name}] ✅ Found keywords: ${pageData.tags.join(', ')}`);
          }
          
          // Fill batch if missing
          if (needsBatch) {
            try {
              // Extract batch from page - look for patterns like "Summer 2025", "W24", "S25", etc.
              const batchPatterns = [
                /(Summer|Winter|Fall|Spring)\s+(\d{4})/i,
                /(W|S)(\d{2})/i, // W24, S25 format
                /Batch[:\s]+(Summer|Winter|Fall|Spring)\s+(\d{4})/i,
                /Batch[:\s]+(W|S)(\d{2})/i,
              ];
              
              const pageText = await page.evaluate(() => document.body.innerText || '');
              
              for (const pattern of batchPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                  let batch = '';
                  if (match[1] && match[2]) {
                    // Format: "Summer 2025" or "W24"
                    if (match[1].match(/^(Summer|Winter|Fall|Spring)$/i)) {
                      batch = `${match[1]} ${match[2]}`;
                    } else {
                      // W24 or S25 format
                      const season = match[1].toUpperCase() === 'W' ? 'Winter' : 'Summer';
                      const year = '20' + match[2];
                      batch = `${season} ${year}`;
                    }
                  } else if (match[0]) {
                    batch = match[0].replace(/Batch[:\s]+/i, '').trim();
                  }
                  
                  if (batch) {
                    updates.batch = batch;
                    console.log(`   [${startup.name}] ✅ Found batch: ${batch}`);
                    break;
                  }
                }
              }
            } catch (batchError) {
              console.log(`   [${startup.name}] ⚠️  Could not extract batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
            }
          }
          
          // Update in Supabase
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('startups3')
              .update(updates)
              .eq('id', startup.id);
            
            if (updateError) {
              console.error(`   [${startup.name}] ❌ Error updating: ${updateError.message}`);
              return { success: false, startup: startup.name, error: updateError.message };
            } else {
              console.log(`   [${startup.name}] ✅ Updated: ${Object.keys(updates).join(', ')}`);
              return { 
                success: true, 
                startup: startup.name,
                keywords: updates.keywords ? true : false,
                batch: updates.batch ? true : false
              };
            }
          } else {
            console.log(`   [${startup.name}] ⚠️  No data extracted`);
            return { success: false, startup: startup.name };
          }
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`   [${startup.name}] ❌ Error: ${errorMsg}`);
          if (errorStack && (errorMsg.includes('timeout') || errorMsg.includes('Navigation'))) {
            console.error(`   [${startup.name}]    Stack: ${errorStack.split('\n').slice(0, 3).join('\n')}`);
          }
          return { success: false, startup: startup.name, error: errorMsg };
        } finally {
          try {
            await browser.close();
          } catch (closeError) {
            // Ignore browser close errors
          }
        }
      })
    );
    
    // Process results
    const batchErrors: Array<{ name: string; error?: string }> = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
          if (result.value.keywords) keywordsFilled++;
          if (result.value.batch) batchFilled++;
        } else {
          errorCount++;
          batchErrors.push({ name: result.value.startup, error: result.value.error });
        }
      } else {
        errorCount++;
        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`   ❌ Promise rejected: ${errorMsg}`);
        batchErrors.push({ name: 'Unknown', error: errorMsg });
      }
    }
    
    // Log batch errors summary
    if (batchErrors.length > 0) {
      console.log(`   ⚠️  ${batchErrors.length} error(s) in this batch:`);
      batchErrors.forEach(err => {
        console.log(`      - ${err.name}: ${err.error || 'Unknown error'}`);
      });
    }
    
    // Delay between batches (increased delay for retries)
    if (batchStart + BATCH_SIZE < stillNeedData.length) {
      console.log(`   ⏳ Waiting 7 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 7000));
    }
  }
  
  console.log(`\n\n📊 Retry Summary:`);
  console.log(`   Total retried: ${stillNeedData.length}`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Keywords filled: ${keywordsFilled}`);
  console.log(`   Batch filled: ${batchFilled}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Success rate: ${((successCount / stillNeedData.length) * 100).toFixed(1)}%`);
  
  if (errorCount > 0) {
    console.log(`\n⚠️  ${errorCount} companies still have errors. You can run this script again to retry.`);
  } else {
    console.log(`\n✅ All companies successfully updated!`);
  }
}

const dryRun = process.argv.includes('--dry-run');

retryFailed(dryRun)
  .then(() => {
    console.log('\n✨ Retry completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });



