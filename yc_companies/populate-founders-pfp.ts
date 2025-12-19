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

const BUCKET_NAME = 'founder_pfp';

/**
 * Sanitizes a company name to match the folder naming convention used in storage
 */
function sanitizeCompanyName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

/**
 * Normalizes company names for matching (removes common variations)
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim();
}

/**
 * Recursively lists all files in a bucket folder
 */
async function listFilesInFolder(
  supabase: SupabaseClient,
  bucketName: string,
  folderPath: string = ''
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error(`❌ Error listing folder ${folderPath}:`, error.message);
    return [];
  }

  if (!data) {
    return [];
  }

  const files: string[] = [];

  for (const item of data) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

    if (item.id === null) {
      // It's a folder, recurse into it
      const subFiles = await listFilesInFolder(supabase, bucketName, itemPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push(itemPath);
    }
  }

  return files;
}

/**
 * Groups files by company folder
 */
function groupFilesByCompany(files: string[]): Map<string, string[]> {
  const companyFiles = new Map<string, string[]>();

  for (const filePath of files) {
    // Files are stored as: company_folder/filename.ext
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      const companyFolder = parts[0];
      if (!companyFiles.has(companyFolder)) {
        companyFiles.set(companyFolder, []);
      }
      companyFiles.get(companyFolder)!.push(filePath);
    }
  }

  return companyFiles;
}

/**
 * Gets public URL for a file in the bucket
 */
function getPublicUrl(supabase: SupabaseClient, bucketName: string, filePath: string): string {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  return data?.publicUrl || '';
}

/**
 * Finds matching startup by company name (fuzzy matching)
 */
async function findStartupByName(
  supabase: SupabaseClient,
  companyFolderName: string
): Promise<{ id: string; name: string } | null> {
  // First try exact match with sanitized name
  const sanitized = sanitizeCompanyName(companyFolderName);
  const normalized = normalizeCompanyName(companyFolderName);

  // Try to find by matching normalized names
  const { data: startups, error } = await supabase
    .from('startups3')
    .select('id, name')
    .limit(1000);

  if (error) {
    console.error(`❌ Error fetching startups:`, error.message);
    return null;
  }

  if (!startups || startups.length === 0) {
    return null;
  }

  // Try exact match first
  for (const startup of startups) {
    const startupNormalized = normalizeCompanyName(startup.name);
    if (startupNormalized === normalized) {
      return startup;
    }
  }

  // Try partial match (folder name contains startup name or vice versa)
  for (const startup of startups) {
    const startupNormalized = normalizeCompanyName(startup.name);
    const startupSanitized = sanitizeCompanyName(startup.name);

    // Check if folder name matches sanitized startup name
    if (sanitized === startupSanitized) {
      return startup;
    }

    // Check if folder name contains startup name or vice versa
    if (
      startupNormalized.includes(normalized) ||
      normalized.includes(startupNormalized)
    ) {
      // Additional check: make sure it's not too generic
      if (normalized.length > 3 && startupNormalized.length > 3) {
        return startup;
      }
    }
  }

  return null;
}

/**
 * Ensures the founders_pfp column exists in the startups table
 */
async function ensureFoundersPfpColumn() {
  // Check if column exists by trying to query it
  const { error } = await supabase
    .from('startups3')
    .select('founders_pfp')
    .limit(1);

  if (error && error.message.includes('column') && error.message.includes('does not exist')) {
    console.log('📝 Creating founders_pfp column...');
    // Note: This requires direct SQL access. If you don't have it, create a migration instead.
    console.warn('⚠️  Column founders_pfp does not exist. Please create it with a migration:');
    console.warn('   ALTER TABLE startups ADD COLUMN founders_pfp TEXT[];');
    return false;
  }

  return true;
}

/**
 * Main function to populate founders_pfp from bucket
 */
async function populateFoundersPfp() {
  console.log('🚀 Starting population of founders_pfp from bucket...\n');

  // Ensure column exists
  const columnExists = await ensureFoundersPfpColumn();
  if (!columnExists) {
    console.error('❌ Please create the founders_pfp column first.');
    return;
  }

  // Check if bucket exists
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
    return;
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  if (!bucketExists) {
    console.error(`❌ Bucket '${BUCKET_NAME}' not found. Available buckets:`, buckets?.map(b => b.name).join(', '));
    return;
  }

  console.log(`✅ Found bucket: ${BUCKET_NAME}\n`);

  // List all files in the bucket
  console.log('📂 Listing all files in bucket...');
  const allFiles = await listFilesInFolder(supabase, BUCKET_NAME);
  console.log(`   Found ${allFiles.length} files\n`);

  if (allFiles.length === 0) {
    console.log('⚠️  No files found in bucket.');
    return;
  }

  // Group files by company folder
  const companyFiles = groupFilesByCompany(allFiles);
  console.log(`📊 Found ${companyFiles.size} company folders\n`);

  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;
  let skippedCount = 0;

  // Process each company
  for (const [companyFolder, files] of companyFiles.entries()) {
    try {
      console.log(`\n🔍 Processing: ${companyFolder} (${files.length} files)`);

      // Find matching startup
      const startup = await findStartupByName(supabase, companyFolder);

      if (!startup) {
        console.log(`   ⚠️  No matching startup found for folder: ${companyFolder}`);
        notFoundCount++;
        continue;
      }

      console.log(`   ✅ Matched to startup: ${startup.name}`);

      // Generate public URLs for all files
      const publicUrls = files
        .map(filePath => getPublicUrl(supabase, BUCKET_NAME, filePath))
        .filter(url => url); // Filter out any null/empty URLs

      if (publicUrls.length === 0) {
        console.log(`   ⚠️  No valid URLs generated`);
        errorCount++;
        continue;
      }

      // Check current founders_pfp value
      const { data: currentData } = await supabase
        .from('startups3')
        .select('founders_pfp')
        .eq('id', startup.id)
        .single();

      // Skip if already populated and matches
      if (currentData?.founders_pfp) {
        const currentUrls = Array.isArray(currentData.founders_pfp)
          ? currentData.founders_pfp
          : String(currentData.founders_pfp).split(',').map(u => u.trim());

        // Check if URLs are the same
        const currentUrlsSet = new Set(currentUrls.map(u => u.split('/').pop()));
        const newUrlsSet = new Set(publicUrls.map(u => u.split('/').pop()));

        if (
          currentUrlsSet.size === newUrlsSet.size &&
          [...currentUrlsSet].every(url => newUrlsSet.has(url))
        ) {
          console.log(`   ⏭️  Already populated with same URLs, skipping...`);
          skippedCount++;
          continue;
        }
      }

      // Update database
      const { error: updateError } = await supabase
        .from('startups3')
        .update({ founders_pfp: publicUrls })
        .eq('id', startup.id);

      if (updateError) {
        console.error(`   ❌ Failed to update database: ${updateError.message}`);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Updated with ${publicUrls.length} image URL(s)`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Error processing ${companyFolder}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Population Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ⚠️  Not Found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total Companies Processed: ${companyFiles.size}`);
  console.log('='.repeat(60));
}

// Run the population
populateFoundersPfp()
  .then(() => {
    console.log('\n✨ Population complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

