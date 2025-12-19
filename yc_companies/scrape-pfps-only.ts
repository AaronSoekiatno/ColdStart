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

interface FounderPfpData {
  profilePicture: string;
  firstName: string;
  lastName: string;
}

/**
 * Scrapes founder profile pictures from a YC company page
 * Uses the proven logic from scrape_yc_companies.ts
 */
async function scrapeFounderPfps(page: Page, ycUrl: string, companyName: string): Promise<FounderPfpData[]> {
  try {
    console.log(`   📥 Loading page...`);
    
    // Navigate to page
    await page.goto(ycUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract founder profile pictures using proven logic
    const foundersData = await page.evaluate(() => {
      const founders: FounderPfpData[] = [];
      
      // Find the "Active Founders" section
      const foundersSection = Array.from(document.querySelectorAll('section')).find(section => {
        const classes = section.className || '';
        const text = section.textContent?.toLowerCase() || '';
        return (classes.includes('border-retro-sectionBorder') || 
                (classes.includes('relative') && classes.includes('isolate'))) &&
               text.includes('active founders');
      }) as HTMLElement | undefined;
      
      if (!foundersSection) {
        return founders;
      }

      // Get all images within founders section
      const allImages = Array.from(foundersSection.querySelectorAll('img[src*="bookface-images"]')) as HTMLImageElement[];
      
      // Filter out logos - keep only avatar images
      const avatarImages = allImages.filter(img => {
        const src = img.src || '';
        const altText = (img.alt || '').toLowerCase();
        
        // Skip logos
        if (src.includes('small_logos') || src.includes('/logos/') || altText.includes('logo')) {
          return false;
        }
        
        // Keep avatars
        const isAvatar = src.includes('/avatars/');
        const hasNameLikeAlt = altText.length >= 2 && 
                              altText.length <= 50 && 
                              !altText.includes('http') &&
                              /^[A-Za-z\s\.\-\']+$/.test(img.alt || '');
        
        return isAvatar || hasNameLikeAlt;
      });
      
      // Track assigned images to avoid duplicates
      const assignedImages = new Set<string>();
      
      // Find founder name elements and match with images
      const nameElements = Array.from(foundersSection.querySelectorAll('a[href*="linkedin"], h3, h4, strong, div[class*="text-xl"]'));
      
      for (const nameEl of nameElements) {
        const nameText = nameEl.textContent?.trim() || '';
        if (!nameText || nameText.length < 2) continue;
        
        // Skip if it's not a name (too long, contains URLs, etc.)
        if (nameText.length > 50 || nameText.includes('http') || nameText.includes('@')) continue;
        
        // Parse name
        const nameParts = nameText.split(/\s+/);
        if (nameParts.length < 1) continue;
        
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        const fullNameLower = nameText.toLowerCase();
        
        // Find matching image by alt text or proximity
        for (const img of avatarImages) {
          const src = img.src || '';
          if (!src || assignedImages.has(src)) continue;
          
          const altText = (img.alt || '').trim().toLowerCase();
          
          // Match by alt text
          const exactMatch = altText === fullNameLower;
          const containsBothNames = firstName && lastName && 
                                    altText.includes(firstName.toLowerCase()) && 
                                    altText.includes(lastName.toLowerCase());
          const firstNameMatch = altText === firstName.toLowerCase() && altText.length < 20;
          
          if (exactMatch || containsBothNames || firstNameMatch) {
            founders.push({
              profilePicture: src,
              firstName,
              lastName,
            });
            assignedImages.add(src);
            break;
          }
        }
        
        // If no match by alt, try proximity
        if (!founders.some(f => f.firstName === firstName && f.lastName === lastName)) {
          const container = nameEl.closest('div, section, article') || nameEl.parentElement;
          if (container && foundersSection.contains(container)) {
            const nearbyImages = container.querySelectorAll('img[src*="bookface-images"]') as NodeListOf<HTMLImageElement>;
            for (const img of Array.from(nearbyImages)) {
              const src = img.src || '';
              if (src.includes('small_logos') || src.includes('/logos/')) continue;
              if (assignedImages.has(src)) continue;
              if (!foundersSection.contains(img)) continue;
              
              founders.push({
                profilePicture: src,
                firstName,
                lastName,
              });
              assignedImages.add(src);
              break;
            }
          }
        }
      }
      
      return founders;
    });

    return foundersData;
  } catch (error: any) {
    console.error(`   ❌ Error scraping: ${error.message}`);
    return [];
  }
}

/**
 * Process a single company: scrape and store founder profile pictures
 */
async function processCompany(
  browser: Browser,
  startup: { id: string; name: string; yc_link: string }
): Promise<{ success: boolean; stored: number; found: number }> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log(`\n🏢 ${startup.name}`);
    console.log(`   URL: ${startup.yc_link}`);

    // Scrape founder profile pictures
    const foundersData = await scrapeFounderPfps(page, startup.yc_link, startup.name);

    if (foundersData.length === 0) {
      console.log(`   ⚠️  No founder profile pictures found`);
      return { success: true, stored: 0, found: 0 };
    }

    console.log(`   ✅ Found ${foundersData.length} founder profile picture(s)`);

    // Extract URLs and names
    const pfpUrls = foundersData.map(f => f.profilePicture);
    const founderNames = foundersData.map(f => `${f.firstName} ${f.lastName}`.trim());

    // Download and store images immediately
    console.log(`   📥 Downloading and storing...`);
    const permanentUrls = await processImagesInParallel(
      pfpUrls,
      supabase,
      startup.name,
      founderNames,
      3 // Process 3 images at a time
    );

    if (permanentUrls.length === 0) {
      console.log(`   ⚠️  Failed to store any images`);
      return { success: false, stored: 0, found: foundersData.length };
    }

    // Update database
    const { error: updateError } = await supabase
      .from('startups3')
      .update({ founders_pfp: permanentUrls })
      .eq('id', startup.id);

    if (updateError) {
      console.error(`   ❌ Database update failed: ${updateError.message}`);
      return { success: false, stored: permanentUrls.length, found: foundersData.length };
    }

    console.log(`   ✅ Stored ${permanentUrls.length}/${foundersData.length} images`);
    return { success: true, stored: permanentUrls.length, found: foundersData.length };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, stored: 0, found: 0 };
  } finally {
    await page.close();
  }
}

/**
 * Main function: Process companies in batches of 5
 */
async function scrapePfpsOnly() {
  console.log('🚀 Starting Founder Profile Picture Scraping (Batch Mode)\n');

  // Get all companies with YC links
  const { data: startups, error } = await supabase
    .from('startups3')
    .select('id, name, yc_link')
    .not('yc_link', 'is', null);

  if (error) {
    console.error('❌ Error fetching startups:', error);
    return;
  }

  if (!startups || startups.length === 0) {
    console.log('⚠️  No startups found.');
    return;
  }

  console.log(`📊 Found ${startups.length} startups to process\n`);

  const BATCH_SIZE = 5; // Process 5 companies in parallel
  let successCount = 0;
  let errorCount = 0;
  let totalStored = 0;
  let totalFound = 0;

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // Process in batches
    for (let i = 0; i < startups.length; i += BATCH_SIZE) {
      const batch = startups.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(startups.length / BATCH_SIZE);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} companies)`);
      console.log('='.repeat(60));

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(startup => processCompany(browser, startup))
      );

      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        totalStored += result.stored;
        totalFound += result.found;
      });

      // Small delay between batches
      if (i + BATCH_SIZE < startups.length) {
        console.log(`\n⏳ Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📸 Found: ${totalFound} images`);
  console.log(`   💾 Stored: ${totalStored} images`);
  console.log(`   📈 Total companies: ${startups.length}`);
  console.log('='.repeat(60));
}

// Run the scraper
scrapePfpsOnly()
  .then(() => {
    console.log('\n✨ Scraping complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

