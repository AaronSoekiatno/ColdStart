import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
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
import puppeteer, { Browser, Page } from 'puppeteer';
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
 * Scrapes a single YC company page to get fresh founder profile picture URLs
 */
async function scrapeFounderPfps(ycLink: string): Promise<{ urls: string[]; founderNames: string[] }> {
  console.log(`🔍 Scraping YC page: ${ycLink}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('   📥 Loading page...');
    await page.goto(ycLink, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for founders section
    await page.waitForSelector('section', { timeout: 10000 });

    console.log('   🔍 Extracting founder data...');

    // Extract founder profile pictures and names
    const foundersData = await page.evaluate(() => {
      const founders: Array<{ name: string; pfp: string }> = [];
      
      // Find all founder cards/images
      const founderSections = Array.from(document.querySelectorAll('section, div')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Founder') || text.includes('Co-founder');
      });

      founderSections.forEach(section => {
        // Look for images with bookface-images in src
        const images = Array.from(section.querySelectorAll('img[src*="bookface-images"]')) as HTMLImageElement[];
        
        images.forEach(img => {
          const src = img.getAttribute('src');
          if (src && src.includes('avatars')) {
            // Try to find founder name nearby
            let name = 'Unknown';
            const parent = img.closest('div, section');
            if (parent) {
              const nameElement = parent.querySelector('a[href*="linkedin"], h3, h4, strong');
              if (nameElement) {
                name = nameElement.textContent?.trim() || 'Unknown';
              }
            }
            
            founders.push({ name, pfp: src });
          }
        });
      });

      return founders;
    });

    const urls = foundersData.map(f => f.pfp);
    const names = foundersData.map(f => f.name);

    console.log(`   ✅ Found ${urls.length} founder profile picture(s)`);
    foundersData.forEach((f, i) => {
      console.log(`      ${i + 1}. ${f.name}: ${f.pfp.substring(0, 80)}...`);
    });

    return { urls, founderNames: names };
  } finally {
    await browser.close();
  }
}

/**
 * Test script: Scrape one company and store images
 */
async function testSingleCompany() {
  // Get a single company from the database
  const { data: startup, error } = await supabase
    .from('startups3')
    .select('id, name, yc_link, founders_pfp')
    .not('yc_link', 'is', null)
    .limit(1)
    .single();

  if (error || !startup) {
    console.error('❌ Error fetching startup:', error);
    console.log('\n💡 Tip: Make sure you have at least one startup with a yc_link in your database.');
    return;
  }

  console.log(`\n🏢 Testing with company: ${startup.name}`);
  console.log(`   YC Link: ${startup.yc_link}\n`);

  if (!startup.yc_link) {
    console.error('❌ Company has no YC link');
    return;
  }

  try {
    // Scrape fresh URLs
    const { urls, founderNames } = await scrapeFounderPfps(startup.yc_link);

    if (urls.length === 0) {
      console.log('\n⚠️  No founder profile pictures found on the page.');
      return;
    }

    console.log(`\n📥 Downloading and storing ${urls.length} image(s)...\n`);

    // Download and store images immediately (while URLs are fresh)
    const permanentUrls = await processImagesInParallel(
      urls,
      supabase,
      startup.name,
      founderNames,
      3 // Process 3 images at a time
    );

    if (permanentUrls.length === 0) {
      console.log('\n❌ Failed to store any images. Check the errors above.');
      return;
    }

    console.log(`\n✅ Successfully stored ${permanentUrls.length}/${urls.length} images`);

    // Update database
    console.log('\n💾 Updating database...');
    const { error: updateError } = await supabase
      .from('startups3')
      .update({ founders_pfp: permanentUrls })
      .eq('id', startup.id);

    if (updateError) {
      console.error('❌ Failed to update database:', updateError.message);
      return;
    }

    console.log('✅ Database updated successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Company: ${startup.name}`);
    console.log(`   Images found: ${urls.length}`);
    console.log(`   Images stored: ${permanentUrls.length}`);
    console.log(`   Permanent URLs: ${permanentUrls.map(url => url.substring(0, 60) + '...').join('\n                  ')}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testSingleCompany()
  .then(() => {
    console.log('\n✨ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

