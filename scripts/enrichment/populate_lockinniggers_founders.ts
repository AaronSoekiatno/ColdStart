/**
 * Populate Founder Names and Emails in lockinniggers Table
 * 
 * This script populates founder_name and founder_email columns in the lockinniggers table by:
 * 1. Finding YC company URLs from company names using YC directory search
 * 2. Scraping YC pages to extract founder information
 * 3. Using email pattern matching to discover founder emails
 * 
 * Usage:
 *   npx tsx scripts/enrichment/populate_lockinniggers_founders.ts
 *   npx tsx scripts/enrichment/populate_lockinniggers_founders.ts --limit=10  # Process only 10 rows
 *   npx tsx scripts/enrichment/populate_lockinniggers_founders.ts --batch=5   # Process 5 at a time
 *   npx tsx scripts/enrichment/populate_lockinniggers_founders.ts --dry-run   # Preview changes without updating
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { findYCCompanyUrl, scrapeYCCompanyPage } from '../scrapers/scrape_yc_companies';
import { findFounderEmailByPattern } from '../email/email_pattern_matcher';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface LockinniggersRecord {
  website: string | null;
  'company-name': string | null;  // Note: column name has hyphen
  twitter: string | null;
  job_listing: string | null;
  founder_name: string | null;
  founder_email: string | null;
  last_contacted: string | null;
}

/**
 * Get rows from lockinniggers table that need founder enrichment
 */
async function getRowsNeedingEnrichment(limit?: number): Promise<any[]> {
  // Query for rows where founder_name OR founder_email is null or empty array
  // For array columns, we check for null or empty arrays (length 0)
  // Also need to have website (not null)
  let query = supabase
    .from('lockinniggers')
    .select('*')
    .or('founder_name.is.null,founder_email.is.null')
    .not('website', 'is', null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching rows:', error);
    throw error;
  }

  // Filter out rows without website or company name, and those that already have both founder_name and founder_email
  return (data || []).filter(row => {
    const hasWebsite = row.website && row.website.trim();
    const hasCompanyName = row['company-name'] && row['company-name'].trim();
    
    // Check if arrays are null or empty (for array columns)
    const hasFounderNames = row.founder_name && Array.isArray(row.founder_name) && row.founder_name.length > 0;
    const hasFounderEmails = row.founder_email && Array.isArray(row.founder_email) && row.founder_email.length > 0;
    
    // Include if has website and company name, and is missing founder_name OR founder_email
    return hasWebsite && hasCompanyName && (!hasFounderNames || !hasFounderEmails);
  });
}

/**
 * Extract domain from website URL
 */
function extractDomain(website: string): string | null {
  if (!website) return null;
  
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace('www.', '');
  } catch {
    // Already a domain, clean it up
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Format founder name from YCPageData founder object
 */
function formatFounderName(founder: { firstName: string; lastName: string }): string {
  const parts = [founder.firstName, founder.lastName].filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * Format multiple founder names from YCPageData founders array
 */
function formatFounderNames(founders: Array<{ firstName: string; lastName: string }>): string[] {
  return founders.map(founder => formatFounderName(founder)).filter(name => name.length > 0);
}

/**
 * Update a row in lockinniggers table with founder names and emails (arrays)
 */
async function updateRowWithFounderData(
  row: any,
  founderNames: string[],
  founderEmails: (string | null)[],
  dryRun: boolean = false
): Promise<boolean> {
  try {
    // Build update object - founder_name and founder_email are now arrays
    const updateData: any = {
      founder_name: founderNames,
    };

    // Filter out null emails and ensure arrays match in length
    const validEmails = founderEmails.filter(email => email !== null) as string[];
    if (validEmails.length > 0) {
      updateData.founder_email = validEmails;
    } else {
      updateData.founder_email = null;
    }

    if (dryRun) {
      console.log(`  🔍 [DRY RUN] Would update row with:`);
      console.log(`     founder_name: [${founderNames.join(', ')}]`);
      if (validEmails.length > 0) {
        console.log(`     founder_email: [${validEmails.join(', ')}]`);
      } else {
        console.log(`     founder_email: (null - no emails found)`);
      }
      return true;
    }

    // Build query to identify the row
    // Use ID if available (Supabase tables often have auto-generated id columns)
    // Otherwise, use website + company name combination as unique identifier
    let query = supabase
      .from('lockinniggers')
      .update(updateData);

    if (row.id) {
      query = query.eq('id', row.id);
    } else if (row.website && row['company-name']) {
      // Fallback: use website + company name combination
      // Note: Column name with hyphen should be handled by Supabase client
      query = query
        .eq('website', row.website)
        .eq('company-name', row['company-name']);
    } else {
      console.error('  ⚠️  Cannot identify row: missing id, website, or company name');
      return false;
    }

    const { error, data } = await query.select();

    if (error) {
      console.error(`  ⚠️  Error updating row: ${error.message}`);
      return false;
    }

    if (!data || data.length === 0) {
      console.error(`  ⚠️  No rows updated - row may not exist or matching failed`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error updating row: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main enrichment function
 */
async function populateFounderData() {
  console.log('🚀 Starting Founder Data Population for lockinniggers table...\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const batchSizeArg = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const batchSize = batchSizeArg ? parseInt(batchSizeArg, 10) : 5;

  if (dryRun) {
    console.log('🔍 DRY RUN MODE: No database updates will be made\n');
  }

  // Get rows needing enrichment
  console.log('📋 Fetching rows needing enrichment...');
  const rows = await getRowsNeedingEnrichment(limit);
  
  if (rows.length === 0) {
    console.log('✅ No rows need enrichment. All done!');
    return;
  }

  console.log(`Found ${rows.length} row(s) needing enrichment\n`);

  // Initialize Puppeteer browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)...`);

    for (const row of batch) {
      const companyName = row['company-name'];
      const website = row.website;

      if (!companyName || !website) {
        console.log(`\n⚠️  Skipping row: missing company name or website`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`\n🏢 Processing: ${companyName}`);
        console.log(`   Website: ${website}`);

        // Step 1: Find YC company URL
        console.log(`   🔍 Searching for YC company URL...`);
        const ycSearchResult = await findYCCompanyUrl(page, companyName);

        if (!ycSearchResult) {
          console.log(`   ⚠️  YC company not found, skipping...`);
          skippedCount++;
          continue;
        }

        console.log(`   ✅ Found YC URL: ${ycSearchResult.ycUrl}`);

        // Step 2: Scrape YC page for founder information
        console.log(`   📄 Scraping YC page for founder data...`);
        const pageData = await scrapeYCCompanyPage(page, ycSearchResult.ycUrl);

        if (!pageData || !pageData.founders || pageData.founders.length === 0) {
          console.log(`   ⚠️  No founders found on YC page, skipping...`);
          skippedCount++;
          continue;
        }

        console.log(`   ✅ Found ${pageData.founders.length} founder(s)`);

        // Step 3: Format all founder names
        const founderNames = formatFounderNames(pageData.founders);
        console.log(`   👤 Founders: ${founderNames.join(', ')}`);

        // Step 4: Extract domain and find emails for all founders
        const domain = extractDomain(website);
        if (!domain) {
          console.log(`   ⚠️  Could not extract domain from website, skipping email discovery...`);
          // Still update with founder names
          const updated = await updateRowWithFounderData(row, founderNames, [], dryRun);
          if (updated) {
            successCount++;
            if (dryRun) {
              console.log(`   ✅ [DRY RUN] Would update with founder names only`);
            } else {
              console.log(`   ✅ Updated with founder names only`);
            }
          } else {
            errorCount++;
          }
          continue;
        }

        console.log(`   🌐 Domain: ${domain}`);
        console.log(`   📧 Discovering emails for all founders...`);

        // Find email for each founder
        const founderEmails: (string | null)[] = [];
        for (let i = 0; i < founderNames.length; i++) {
          const founderName = founderNames[i];
          console.log(`   📧 ${i + 1}/${founderNames.length} Discovering email for ${founderName}...`);
          
          const emailResult = await findFounderEmailByPattern(founderName, domain, 4);
          
          if (emailResult && emailResult.isDeliverable) {
            founderEmails.push(emailResult.email);
            console.log(`      ✅ Found email: ${emailResult.email}`);
          } else {
            founderEmails.push(null);
            console.log(`      ⚠️  No deliverable email found`);
          }
          
          // Small delay between email discoveries
          if (i < founderNames.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        const emailsFound = founderEmails.filter(email => email !== null).length;
        console.log(`   ✅ Found ${emailsFound}/${founderNames.length} email(s)`);

        // Step 5: Update database
        const updated = await updateRowWithFounderData(row, founderNames, founderEmails, dryRun);
        if (updated) {
          successCount++;
          if (dryRun) {
            console.log(`   ✅ [DRY RUN] Would successfully update database`);
          } else {
            console.log(`   ✅ Successfully updated database`);
          }
        } else {
          errorCount++;
          console.log(`   ❌ Failed to update database`);
        }

        // Small delay between rows
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing ${companyName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Small delay between batches
    if (i + batchSize < rows.length) {
      console.log(`\n⏸️  Waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Close browser
  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  if (dryRun) {
    console.log('📊 Dry Run Complete (No database changes made)');
  } else {
    console.log('📊 Enrichment Complete');
  }
  console.log('='.repeat(60));
  console.log(`Total processed: ${rows.length}`);
  console.log(`${dryRun ? 'Would successfully enrich' : 'Successfully enriched'}: ${successCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  populateFounderData()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}
