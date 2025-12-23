/**
 * Script to scrape location, description, and industry for startups
 * that only have a name (missing these three fields)
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
  industry?: string | null;
  description?: string | null;
  location?: string | null;
  yc_link?: string | null;
  [key: string]: any;
}

/**
 * Check if a startup is missing description, industry, and location
 */
function isMissingFields(startup: Startup): boolean {
  const hasIndustry = startup.industry && startup.industry.trim() !== '';
  const hasDescription = startup.description && startup.description.trim() !== '';
  const hasLocation = startup.location && startup.location.trim() !== '';
  
  // Missing if ALL THREE are empty
  return !hasIndustry && !hasDescription && !hasLocation;
}

/**
 * Main function to scrape missing fields
 */
async function scrapeMissingFields(dryRun: boolean = false) {
  console.log('🔍 Starting scrape for startups missing location, description, and industry...\n');
  
  // Fetch startups missing all three fields
  console.log('📂 Fetching startups from startups3 table...');
  let startups: Startup[] = [];
  let pageNum = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: fetchError } = await supabase
      .from('startups3')
      .select('id, name, industry, description, location, yc_link')
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
    
    if (fetchError) {
      throw new Error(`Failed to fetch startups: ${fetchError.message}`);
    }
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      // Filter to only those missing all three fields
      const missingFields = pageData.filter(isMissingFields);
      startups = startups.concat(missingFields);
      hasMore = pageData.length === pageSize;
      pageNum++;
      console.log(`   Fetched ${startups.length} startups missing fields so far...`);
    }
  }
  
  if (startups.length === 0) {
    console.log('✅ No startups found missing location, description, and industry!');
    return;
  }
  
  console.log(`   Found ${startups.length} startups missing all three fields\n`);
  
  // Filter to only those with YC links (we can scrape from YC pages)
  const startupsWithYcLink = startups.filter(s => s.yc_link && s.yc_link.trim() !== '');
  console.log(`   ${startupsWithYcLink.length} have YC links (can be scraped)\n`);
  
  if (startupsWithYcLink.length === 0) {
    console.log('❌ No startups with YC links found. Cannot scrape without YC links.');
    return;
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN MODE - No data will be scraped or updated`);
    console.log(`   Would scrape ${startupsWithYcLink.length} startup(s)`);
    console.log(`\n   First 10 startups to process:`);
    startupsWithYcLink.slice(0, 10).forEach((startup, idx) => {
      console.log(`   ${idx + 1}. ${startup.name} (${startup.yc_link})`);
    });
    return;
  }
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let successCount = 0;
  let errorCount = 0;
  
  try {
    for (let i = 0; i < startupsWithYcLink.length; i++) {
      const startup = startupsWithYcLink[i];
      console.log(`\n[${i + 1}/${startupsWithYcLink.length}] Processing: ${startup.name}`);
      console.log(`   YC Link: ${startup.yc_link}`);
      
      try {
        // Scrape YC page
        const pageData = await scrapeYCCompanyPage(page, startup.yc_link!);
        
        if (!pageData) {
          console.log(`   ⚠️  Could not scrape page data`);
          errorCount++;
          continue;
        }
        
        // Extract the fields we need
        const updates: any = {};
        
        // Location - clean it to remove footer text
        if (pageData.location && pageData.location.trim() !== '') {
          let location = pageData.location.trim();
          
          // Stop at common footer/navigation patterns
          const footerPatterns = [
            /Footer/i,
            /Y Combinator/i,
            /Programs/i,
            /YC Program/i,
            /Startup School/i,
            /Work at a Startup/i,
            /Co$/i,
            /Company$/i,
          ];
          
          for (const footerPattern of footerPatterns) {
            const footerMatch = location.match(footerPattern);
            if (footerMatch && footerMatch.index !== undefined && footerMatch.index > 0) {
              // Take only the part before the footer text
              location = location.substring(0, footerMatch.index).trim();
              break;
            }
          }
          
          // Clean up: remove extra whitespace
          location = location.replace(/\s{2,}/g, ' ').trim();
          
          // Stop at common navigation words
          const stopWords = ['Footer', 'Y Combinator', 'Programs', 'YC Program', 'Startup School', 'Work at a Startup'];
          for (const stopWord of stopWords) {
            const stopIndex = location.indexOf(stopWord);
            if (stopIndex > 0) {
              location = location.substring(0, stopIndex).trim();
              break;
            }
          }
          
          if (location.length > 0 && location.length < 100) {
            updates.location = location;
          }
        }
        
        // Description
        if (pageData.oneLineSummary && pageData.oneLineSummary.trim() !== '') {
          updates.description = pageData.oneLineSummary.trim();
        } else if (pageData.ycDescription && pageData.ycDescription.trim() !== '') {
          updates.description = pageData.ycDescription.trim();
        }
        
        // Industry - use first tag if available
        if (pageData.tags && pageData.tags.length > 0) {
          updates.industry = pageData.tags[0];
        }
        
        // Keywords - join all tags
        if (pageData.tags && pageData.tags.length > 0) {
          updates.keywords = pageData.tags.join(', ');
        }
        
        // Update in Supabase
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('startups3')
            .update(updates)
            .eq('id', startup.id);
          
          if (updateError) {
            console.error(`   ❌ Error updating: ${updateError.message}`);
            errorCount++;
          } else {
            console.log(`   ✅ Updated: ${Object.keys(updates).join(', ')}`);
            successCount++;
          }
        } else {
          console.log(`   ⚠️  No data extracted`);
          errorCount++;
        }
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }
    }
  } finally {
    await browser.close();
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`   Total processed: ${startupsWithYcLink.length}`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
}

// Check for dry-run flag
const dryRun = process.argv.includes('--dry-run');

// Run the scraping
scrapeMissingFields(dryRun)
  .then(() => {
    console.log('\n✨ Scraping completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during scraping:', error);
    process.exit(1);
  });

