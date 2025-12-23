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

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string | number; // Can be UUID string or number
  name: string;
  industry?: string | null;
  description?: string | null;
  location?: string | null;
  batch?: string | null;
  yc_link?: string | null;
  website?: string | null;
  founder_linkedin?: string | null;
  [key: string]: any;
}

/**
 * Normalize company name for duplicate detection
 * Removes accents, spaces, punctuation, parentheses, and common suffixes
 * Examples: 
 *   "Santé" → "sante"
 *   "Swif.ai" → "swifai"
 *   "Swif Ai" → "swifai"
 *   "Shape (ShapeScale)" → "shape"
 *   "Reframe (Glucobit)" → "reframe"
 *   "Conduit" → "conduit"
 *   "Conduit Ai" → "conduitai" (but will match by partial match logic)
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove content in parentheses (e.g., "Shape (ShapeScale)" → "Shape")
    .replace(/\s*\([^)]*\)/g, '')
    // Remove common suffixes first (before removing spaces)
    .replace(/\s+(inc\.?|llc|corp\.?|corporation|ltd\.?|limited|co\.?|company)$/i, '')
    // Normalize Unicode characters (remove accents/diacritics)
    // é → e, à → a, etc.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    // Remove all punctuation and special characters (including dots, dashes, etc.)
    .replace(/[^\w\s]/g, '')
    // Remove all spaces (so "Swif Ai" becomes "swifai", "Conduit Ai" becomes "conduitai")
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Check if two normalized names are similar (one contains the other)
 * This catches cases like "Conduit" vs "Conduit Ai"
 * Balanced to catch real duplicates while avoiding false positives
 */
function areNamesSimilar(name1: string, name2: string): boolean {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length >= norm2.length ? norm1 : norm2;
  
  // Require at least 4 characters to avoid very short matches
  if (shorter.length < 4) return false;
  
  // Check if shorter name appears at start of longer name
  // This catches "Conduit" vs "Conduit Ai" or "Conduitai"
  const startsWith = longer.startsWith(shorter);
  
  // Check if longer name is shorter + common suffix
  const commonSuffixes = ['ai', 'tech', 'labs', 'inc', 'io', 'app', 'hq', 'co', 'hq', 'robotics', 'systems'];
  const hasCommonSuffix = commonSuffixes.some(suffix => {
    const withSuffix = shorter + suffix;
    const withSuffixPlural = shorter + suffix + 's';
    return longer === withSuffix || longer === withSuffixPlural || longer.startsWith(withSuffix);
  });
  
  // Also check if one is contained in the other, but require:
  // - Shorter name is at least 50% of longer name's length (more lenient)
  // - Or it's a clear prefix match
  const isSubstringMatch = longer.includes(shorter) && shorter.length >= longer.length * 0.5;
  
  // Allow if it starts with the shorter name OR has a common suffix pattern
  return startsWith || hasCommonSuffix || isSubstringMatch;
}

/**
 * Check if a startup record is "bad" (missing critical fields)
 * A record is "bad" if it's missing description AND industry AND location (all three)
 */
function isBadRecord(startup: Startup): boolean {
  const hasIndustry = startup.industry && startup.industry.trim() !== '';
  const hasDescription = startup.description && startup.description.trim() !== '';
  const hasLocation = startup.location && startup.location.trim() !== '';
  
  // A record is "bad" if it's missing ALL THREE: description, industry, AND location
  // If it has at least one of these fields, it's considered "good"
  return !hasIndustry && !hasDescription && !hasLocation;
}

/**
 * Score a startup record - higher score = better record (more complete data)
 */
function scoreRecord(startup: Startup): number {
  let score = 0;
  
  if (startup.industry && startup.industry.trim() !== '') score += 2;
  if (startup.description && startup.description.trim() !== '') score += 3; // Description is most important
  if (startup.location && startup.location.trim() !== '') score += 1;
  if (startup.batch && startup.batch.trim() !== '') score += 1;
  if (startup.yc_link && startup.yc_link.trim() !== '') score += 1;
  if (startup.website && startup.website.trim() !== '') score += 1;
  
  return score;
}

/**
 * Normalize URL for comparison (remove trailing slashes, www, etc.)
 */
function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') return null;
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '') // Remove www
    .replace(/\/$/, '') // Remove trailing slash
    .trim();
}

/**
 * Normalize LinkedIn URL for comparison
 */
function normalizeLinkedIn(linkedin: string | null | undefined): string | null {
  if (!linkedin || linkedin.trim() === '') return null;
  
  // Handle comma-separated LinkedIn URLs (take first one)
  const firstLinkedIn = linkedin.split(',')[0].trim();
  if (!firstLinkedIn) return null;
  
  // Normalize LinkedIn URL
  return firstLinkedIn
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '') // Remove www
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/\/in\//, '/in/') // Normalize /in/ path
    .trim();
}

/**
 * Find duplicate groups in the startups array
 * Groups by: same YC link AND same LinkedIn
 */
function findDuplicateGroups(startups: Startup[]): Map<string, Startup[]> {
  // Create a composite key: yc_link + founder_linkedin
  const duplicateGroups = new Map<string, Startup[]>();
  
  for (const startup of startups) {
    const normalizedYcLink = normalizeUrl(startup.yc_link);
    const normalizedLinkedIn = normalizeLinkedIn(startup.founder_linkedin);
    
    // Only group if BOTH YC link and LinkedIn are present
    if (normalizedYcLink && normalizedLinkedIn) {
      const compositeKey = `${normalizedYcLink}|${normalizedLinkedIn}`;
      
      if (!duplicateGroups.has(compositeKey)) {
        duplicateGroups.set(compositeKey, []);
      }
      duplicateGroups.get(compositeKey)!.push(startup);
    }
  }
  
  // Filter to only groups with duplicates (more than 1 startup)
  const duplicates = new Map<string, Startup[]>();
  for (const [key, group] of duplicateGroups.entries()) {
    if (group.length > 1) {
      duplicates.set(key, group);
    }
  }
  
  return duplicates;
}

/**
 * Main function to clean duplicates
 */
async function cleanDuplicates(dryRun: boolean = false) {
  console.log('🔍 Starting duplicate cleanup for startups3 table...\n');
  
  // Fetch all startups (Supabase defaults to 1000 rows, so we need to paginate)
  console.log('📂 Fetching all companies from startups3 table...');
  let startups: Startup[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: fetchError } = await supabase
      .from('startups3')
      .select('id, name, industry, description, location, batch, yc_link, website, founder_linkedin')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (fetchError) {
      throw new Error(`Failed to fetch startups: ${fetchError.message}`);
    }
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      startups = startups.concat(pageData);
      hasMore = pageData.length === pageSize; // If we got a full page, there might be more
      page++;
      console.log(`   Fetched ${startups.length} companies so far...`);
    }
  }
  
  if (startups.length === 0) {
    console.log('❌ No companies found in database');
    return;
  }
  
  console.log(`   Found ${startups.length} total companies\n`);
  
  // Find duplicate groups
  const duplicateGroups = findDuplicateGroups(startups);
  console.log(`🔎 Found ${duplicateGroups.size} duplicate groups\n`);
  
  if (duplicateGroups.size === 0) {
    console.log('✅ No duplicates found!');
    return;
  }
  
  // Process each duplicate group
  const recordsToDelete: Array<string | number> = [];
  const recordsToKeep: Map<string, Startup> = new Map();
  
  for (const [groupKey, group] of duplicateGroups.entries()) {
    const names = group.map(s => s.name).join('", "');
    console.log(`\n📋 Processing duplicates: "${names}"`);
    
    // Extract YC link and LinkedIn from composite key
    const [ycLink, linkedIn] = groupKey.split('|');
    console.log(`   🔗 Grouped by: Same YC link (${ycLink})`);
    console.log(`   👤 And same LinkedIn (${linkedIn})`);
    
    // Sort by score (best first)
    const sorted = [...group].sort((a, b) => scoreRecord(b) - scoreRecord(a));
    
    // Identify bad records
    const badRecords = sorted.filter(isBadRecord);
    const goodRecords = sorted.filter(s => !isBadRecord(s));
    
    console.log(`   Total records: ${sorted.length}`);
    console.log(`   Good records: ${goodRecords.length}`);
    console.log(`   Bad records: ${badRecords.length}`);
    
    if (goodRecords.length === 0) {
      // All records are bad - keep the best one, delete the rest
      console.log(`   ⚠️  All records are incomplete. Keeping best one (ID: ${sorted[0].id})`);
      recordsToKeep.set(groupKey, sorted[0]);
      for (let i = 1; i < sorted.length; i++) {
        recordsToDelete.push(sorted[i].id);
        console.log(`   🗑️  Will delete: "${sorted[i].name}" (ID: ${sorted[i].id})`);
      }
    } else {
      // Keep all good records, delete all bad records
      for (const good of goodRecords) {
        recordsToKeep.set(`${groupKey}_${good.id}`, good);
        console.log(`   ✅ Keeping: "${good.name}" (ID: ${good.id})`);
      }
      for (const bad of badRecords) {
        recordsToDelete.push(bad.id);
        console.log(`   🗑️  Will delete: "${bad.name}" (ID: ${bad.id})`);
      }
    }
  }
  
  // Summary
  console.log(`\n\n📊 Summary:`);
  console.log(`   Total duplicate groups: ${duplicateGroups.size}`);
  console.log(`   Records to keep: ${recordsToKeep.size}`);
  console.log(`   Records to delete: ${recordsToDelete.length}`);
  
  if (recordsToDelete.length === 0) {
    console.log('\n✅ No records to delete!');
    return;
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN MODE - No records will be deleted`);
    console.log(`   Would delete ${recordsToDelete.length} record(s)`);
    console.log(`   Would keep ${recordsToKeep.size} record(s)`);
    return;
  }
  
  // Confirm deletion
  console.log(`\n⚠️  About to delete ${recordsToDelete.length} duplicate record(s).`);
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Delete bad records
  console.log('🗑️  Deleting duplicate records...');
  const { error: deleteError } = await supabase
    .from('startups3')
    .delete()
    .in('id', recordsToDelete);
  
  if (deleteError) {
    throw new Error(`Failed to delete records: ${deleteError.message}`);
  }
  
  console.log(`\n✅ Successfully deleted ${recordsToDelete.length} duplicate record(s)!`);
  console.log(`   Kept ${recordsToKeep.size} record(s) with complete data.`);
}

// Check for dry-run flag
const dryRun = process.argv.includes('--dry-run');

// Run the cleanup
cleanDuplicates(dryRun)
  .then(() => {
    console.log('\n✨ Duplicate cleanup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  });

