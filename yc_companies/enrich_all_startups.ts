/**
 * Comprehensive Startup Enrichment Script
 *
 * This script enriches all startups in the startups3 table that are missing data.
 * It handles two cases:
 * 1. Startups missing yc_link: Searches YC directory by name and scrapes YC page
 * 2. Startups with yc_link but missing other data: Re-scrapes the YC page
 *
 * Usage:
 *   npm run enrich:all                    # Enrich all needing data
 *   npm run enrich:all -- --limit=10      # Limit to 10 startups
 *   npm run enrich:all -- --missing-link  # Only startups missing yc_link
 *   npm run enrich:all -- --has-link      # Only startups that have yc_link but missing other data
 *   npm run enrich:all -- --dry-run       # Show what would be enriched without doing it
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  enrichCompanyFromName,
  scrapeYCCompanyPage,
} from './scrape_yc_companies';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface StartupRecord {
  id: string;
  name: string;
  yc_link: string | null;
  website: string | null;
  founder_names: string | null;
  founder_linkedin: string | null;
  batch: string | null;
  company_logo: string | null;
}

/**
 * Get all startups that need enrichment
 */
async function getStartupsNeedingEnrichment(options: {
  limit?: number;
  missingLinkOnly?: boolean;
  hasLinkOnly?: boolean;
}): Promise<StartupRecord[]> {
  const { limit, missingLinkOnly, hasLinkOnly } = options;

  let query = supabase
    .from('startups3')
    .select('id, name, yc_link, website, founder_names, founder_linkedin, batch, company_logo');

  if (missingLinkOnly) {
    // Only get startups missing yc_link
    query = query.is('yc_link', null);
  } else if (hasLinkOnly) {
    // Only get startups that have yc_link but are missing other data
    query = query
      .not('yc_link', 'is', null)
      .or('founder_names.is.null,website.is.null,company_logo.is.null');
  } else {
    // Get all startups needing enrichment (missing yc_link OR missing other critical data)
    query = query.or('yc_link.is.null,founder_names.is.null,website.is.null');
  }

  query = query.order('name', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch startups: ${error.message}`);
  }

  return data || [];
}

/**
 * Update startup data from scraped YC page (for startups that already have yc_link)
 */
async function updateStartupFromYCPage(
  startup: StartupRecord,
  pageData: {
    founders: Array<{
      firstName: string;
      lastName: string;
      linkedIn: string;
      twitterUrl?: string;
      description?: string;
      profilePicture?: string;
    }>;
    website: string;
    teamSize: string;
    location: string;
    oneLineSummary: string;
    ycDescription?: string;
    companyTwitterUrl?: string;
    companyLogo?: string;
    tags?: string[];
  }
): Promise<boolean> {
  // Format founder data
  const founderNames = pageData.founders
    .map(f => `${f.firstName}${f.lastName ? ' ' + f.lastName : ''}`.trim())
    .filter(name => name && name.length > 0)
    .join(', ');

  const founderLinkedIn = pageData.founders
    .map(f => f.linkedIn)
    .filter(linkedin => linkedin && linkedin.trim().length > 0)
    .join(', ');

  const founderTwitterUrls = pageData.founders
    .map(f => f.twitterUrl)
    .filter(twitter => twitter && twitter.trim().length > 0)
    .join(', ');

  // Format founder descriptions
  let founderBackgrounds = '';
  if (pageData.founders && pageData.founders.length > 0) {
    const descriptions = pageData.founders
      .filter(f => f.description && f.description.trim().length > 0)
      .map(f => {
        if (!f.description) return '';
        const fullName = `${f.firstName}${f.lastName ? ' ' + f.lastName : ''}`.trim();
        if (fullName) {
          return `${fullName}: ${f.description.trim()}`;
        }
        return f.description.trim();
      })
      .filter(desc => desc.length > 0);

    if (descriptions.length > 0) {
      founderBackgrounds = descriptions.join('\n\n');
    }
  }

  // Build update data - only update fields that are currently null/empty
  const updateData: Record<string, any> = {};

  if (!startup.founder_names && founderNames) {
    updateData.founder_names = founderNames;
  }
  if (!startup.founder_linkedin && founderLinkedIn) {
    updateData.founder_linkedin = founderLinkedIn;
  }
  if (!startup.website && pageData.website) {
    updateData.website = pageData.website;
  }
  if (!startup.company_logo && pageData.companyLogo) {
    updateData.company_logo = pageData.companyLogo;
  }

  // Always try to update these if we have data and they're missing
  if (founderTwitterUrls) {
    updateData.founder_twitter_urls = founderTwitterUrls;
  }
  if (pageData.companyTwitterUrl) {
    updateData.company_twitter_url = pageData.companyTwitterUrl;
  }
  if (pageData.teamSize) {
    updateData.team_size = pageData.teamSize;
  }
  if (founderBackgrounds) {
    updateData.founder_backgrounds = founderBackgrounds;
  }
  if (pageData.ycDescription) {
    updateData.yc_description = pageData.ycDescription;
  }
  if (pageData.location) {
    updateData.location = pageData.location;
  }
  if (pageData.oneLineSummary) {
    updateData.description = pageData.oneLineSummary;
  }
  if (pageData.tags && pageData.tags.length > 0) {
    updateData.keywords = pageData.tags.join(', ');
    updateData.industry = pageData.tags[0];
  }

  if (Object.keys(updateData).length === 0) {
    console.log(`   No new data to update for ${startup.name}`);
    return false;
  }

  const { error } = await supabase
    .from('startups3')
    .update(updateData)
    .eq('id', startup.id);

  if (error) {
    console.error(`   Error updating ${startup.name}: ${error.message}`);
    return false;
  }

  const updatedFields = Object.keys(updateData);
  console.log(`   Updated: ${updatedFields.join(', ')}`);
  return true;
}

/**
 * Main enrichment function
 */
async function enrichAllStartups() {
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE STARTUP ENRICHMENT');
  console.log('='.repeat(70));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const missingLinkOnly = args.includes('--missing-link');
  const hasLinkOnly = args.includes('--has-link');
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('\n** DRY RUN MODE - No changes will be made **\n');
  }

  // Get startups needing enrichment
  console.log('\nFetching startups needing enrichment...');
  const startups = await getStartupsNeedingEnrichment({
    limit,
    missingLinkOnly,
    hasLinkOnly,
  });

  if (startups.length === 0) {
    console.log('\nNo startups need enrichment!');
    return;
  }

  // Categorize startups
  const missingLink = startups.filter(s => !s.yc_link);
  const hasLink = startups.filter(s => s.yc_link);

  console.log(`\nFound ${startups.length} startups needing enrichment:`);
  console.log(`  - ${missingLink.length} missing YC link (need YC search)`);
  console.log(`  - ${hasLink.length} have YC link but missing other data (need re-scrape)`);

  if (dryRun) {
    console.log('\n--- Startups Missing YC Link ---');
    missingLink.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}`);
    });
    console.log('\n--- Startups Needing Re-scrape ---');
    hasLink.forEach((s, i) => {
      const missing = [];
      if (!s.founder_names) missing.push('founders');
      if (!s.website) missing.push('website');
      if (!s.company_logo) missing.push('logo');
      console.log(`  ${i + 1}. ${s.name} (missing: ${missing.join(', ')})`);
    });
    console.log('\n** DRY RUN COMPLETE - Run without --dry-run to enrich **');
    return;
  }

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log('Browser ready\n');

  // Helper function to recreate page if needed
  const recreatePage = async (): Promise<Page> => {
    try {
      if (!page.isClosed()) {
        try {
          await page.close();
        } catch (e) {
          // Ignore errors when closing
        }
      }
    } catch (e) {
      // Ignore errors
    }
    const newPage = await browser.newPage();
    await newPage.setViewport({ width: 1920, height: 1080 });
    await newPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    return newPage;
  };

  // Track results
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Process startups missing YC link first (YC directory search)
    if (missingLink.length > 0) {
      console.log('='.repeat(70));
      console.log('PHASE 1: Enriching startups missing YC link');
      console.log('='.repeat(70));

      for (let i = 0; i < missingLink.length; i++) {
        const startup = missingLink[i];
        console.log(`\n[${i + 1}/${missingLink.length}] ${startup.name}`);

        try {
          // Check if page is still valid
          if (page.isClosed()) {
            console.log('   Page closed, recreating...');
            page = await recreatePage();
          }

          const success = await enrichCompanyFromName(page, startup.name, startup.batch || undefined);
          if (success) {
            results.success++;
          } else {
            results.skipped++;
            console.log(`   Could not find ${startup.name} in YC directory`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`   Error: ${errorMsg}`);
          results.failed++;

          // Recreate page if it crashed
          if (errorMsg.includes('detached') || errorMsg.includes('closed')) {
            try {
              page = await recreatePage();
            } catch (e) {
              // Ignore
            }
          }
        }

        // Delay between requests
        if (i < missingLink.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // Process startups that have YC link but missing other data (re-scrape)
    if (hasLink.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('PHASE 2: Re-scraping startups with YC link but missing data');
      console.log('='.repeat(70));

      for (let i = 0; i < hasLink.length; i++) {
        const startup = hasLink[i];
        console.log(`\n[${i + 1}/${hasLink.length}] ${startup.name}`);
        console.log(`   YC Link: ${startup.yc_link}`);

        try {
          // Check if page is still valid
          if (page.isClosed()) {
            console.log('   Page closed, recreating...');
            page = await recreatePage();
          }

          const pageData = await scrapeYCCompanyPage(page, startup.yc_link!);

          if (pageData) {
            const success = await updateStartupFromYCPage(startup, pageData);
            if (success) {
              results.success++;
            } else {
              results.skipped++;
            }
          } else {
            console.log(`   Failed to scrape ${startup.yc_link}`);
            results.failed++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`   Error: ${errorMsg}`);
          results.failed++;

          // Recreate page if it crashed
          if (errorMsg.includes('detached') || errorMsg.includes('closed')) {
            try {
              page = await recreatePage();
            } catch (e) {
              // Ignore
            }
          }
        }

        // Delay between requests
        if (i < hasLink.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  } finally {
    // Close browser
    try {
      await browser.close();
      console.log('\nBrowser closed');
    } catch (e) {
      // Ignore
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('ENRICHMENT SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total processed: ${startups.length}`);
  console.log(`Successfully enriched: ${results.success}`);
  console.log(`Skipped (no data found): ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);
  console.log('='.repeat(70));

  // Recommendations
  if (results.success > 0) {
    console.log('\nNext steps:');
    console.log('  1. Run email discovery: npm run enrich:emails');
    console.log('  2. Check enrichment quality: npm run list-poor-quality');
  }
}

// Run if called directly
if (require.main === module) {
  enrichAllStartups()
    .then(() => {
      console.log('\nEnrichment completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nEnrichment failed:', error);
      process.exit(1);
    });
}

export { enrichAllStartups, getStartupsNeedingEnrichment };
