/**
 * Sync Greenhouse Job URLs to Supabase
 *
 * This script:
 * 1. Pulls all jobs from Supabase jobs table WHERE job_url IS NULL
 * 2. Groups them by company (startup)
 * 3. For each company, searches for their Greenhouse job board
 * 4. Matches Supabase job titles with Greenhouse job titles (handles truncation)
 * 5. Updates the job_url in Supabase with the Greenhouse application link
 *
 * NOTE: Only processes jobs with NULL job_url - skips jobs that already have URLs
 *
 * Usage:
 *   npx tsx scripts/sync-greenhouse-jobs-to-supabase.ts
 *   npx tsx scripts/sync-greenhouse-jobs-to-supabase.ts --company "Harper"
 *   npx tsx scripts/sync-greenhouse-jobs-to-supabase.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

interface SupabaseJob {
  id: string;
  startup_id: string | null;
  company_name: string;
  job_title: string;
  job_url: string | null;
  greenhouse_job_id: string | null;
}

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: {
    name: string;
  };
  absolute_url: string;
  internal_job_id: number;
  metadata: any[];
}

interface GreenhouseAPIResponse {
  jobs: GreenhouseJob[];
}

/**
 * Generate possible slug variations from company name
 * More comprehensive to reduce need for web search
 */
function generateSlugVariations(companyName: string): string[] {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim();

  const words = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  const variations = [
    base, // e.g., "candid-health"
    base.replace(/-/g, ''), // e.g., "candidhealth"
    companyName.toLowerCase().replace(/\s+/g, ''), // No spaces, no hyphens
    words[0], // First word only, e.g., "candid"
    words.join(''), // All words concatenated, e.g., "candidhealth"
    words.join('-'), // All words with hyphens
    // Common patterns for multi-word companies
    ...(words.length >= 2
      ? [
          words[0] + words[1], // First two words, e.g., "candidhealth"
          words[0] + '-' + words[1], // First two words with hyphen
          words.slice(0, 2).join(''), // First two words
        ]
      : []),
    // Handle "Inc", "Corp", "LLC" suffix removal
    ...words
      .filter((w) => !['inc', 'llc', 'corp', 'corporation', 'limited'].includes(w))
      .reduce((acc: string[], _, idx, arr) => {
        if (arr.length !== words.length) {
          // Something was filtered out
          acc.push(arr.join(''));
          acc.push(arr.join('-'));
        }
        return acc;
      }, []),
  ];

  // Remove duplicates and empty strings
  return [...new Set(variations)].filter((v) => v.length > 0);
}

/**
 * Find Greenhouse slug by trying variations
 */
async function findGreenhouseSlug(companyName: string): Promise<string | null> {
  // Try common slug variations
  const variations = generateSlugVariations(companyName);

  for (const slug of variations) {
    const jobs = await fetchGreenhouseJobs(slug);
    if (jobs.length > 0) {
      return slug;
    }
    // Small delay to avoid hammering API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // No slug found using variations
  console.log(`   ❌ No Greenhouse board found using slug variations`);
  console.log(`   💡 Tip: Try manually checking https://job-boards.greenhouse.io/`);
  return null;
}

/**
 * Fetch jobs from Greenhouse API
 */
async function fetchGreenhouseJobs(slug: string): Promise<GreenhouseJob[]> {
  return new Promise((resolve) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

    https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data) as GreenhouseAPIResponse;
              resolve(json.jobs || []);
            } catch (err) {
              resolve([]);
            }
          } else {
            resolve([]);
          }
        });
      }
    ).on('error', () => {
      resolve([]);
    });
  });
}

/**
 * Normalize job title for matching
 * Removes common suffixes and company names, normalizes common variations
 */
function normalizeJobTitle(title: string, companyName: string): string {
  let normalized = title
    .toLowerCase()
    .replace(new RegExp(`\\s*at\\s+${companyName}.*$`, 'i'), '') // Remove "at Company (W20)"
    .replace(/\s*\(w\d+\)\s*/gi, '') // Remove (W20) batch notation specifically
    .replace(/\([^)]*?(senior|junior|staff|new grad)[^)]*?\)/gi, '') // Remove seniority in parens
    .replace(/\s*-\s*/g, ' ') // Replace hyphens with spaces
    .replace(/[()]/g, ' ') // Convert remaining parentheses to spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Normalize common variations
  normalized = normalized
    .replace(/\bfrontend\b/g, 'front end')
    .replace(/\bbackend\b/g, 'back end')
    .replace(/\bfullstack\b/g, 'full stack')
    .replace(/\bai\/ml\b/g, 'ai ml')
    .replace(/\bml\/ai\b/g, 'ai ml')
    .replace(/\bdevops\b/g, 'dev ops')
    .replace(/\bsr\.\s*/g, 'senior ')
    .replace(/\bjr\.\s*/g, 'junior ')
    .replace(/\bpre sales\b/g, 'presales')
    .replace(/\bpre-sales\b/g, 'presales')
    .replace(/\bgtm\b/g, 'business') // GTM = Go-To-Market ≈ Business
    .replace(/\bgo to market\b/g, 'business')
    .replace(/\brevenue cycle\b/g, 'billing'); // Revenue Cycle ≈ Billing

  return normalized;
}

/**
 * Extract key words from job title (removes common filler words and seniority levels)
 */
function extractKeyWords(title: string): string[] {
  const fillerWords = new Set([
    'the',
    'a',
    'an',
    'of',
    'for',
    'and',
    'or',
    'in',
    'on',
    'at',
    'to',
    'with',
    'level',
    'staff',
  ]);

  const seniority = new Set([
    'senior',
    'junior',
    'lead',
    'principal',
    'staff',
    'new',
    'grad',
    'head',
    'chief',
    'director',
    'manager',
    'associate',
    'entry',
    'mid',
    'experienced',
  ]);

  return title
    .split(' ')
    .filter((w) => w.length > 0)
    .filter((w) => !fillerWords.has(w))
    .map((w) => (seniority.has(w) ? `[${w}]` : w)); // Mark seniority words
}

/**
 * Calculate similarity score between two job titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = extractKeyWords(title1);
  const words2 = extractKeyWords(title2);

  // Extract core words (non-seniority)
  const core1 = words1.filter((w) => !w.startsWith('['));
  const core2 = words2.filter((w) => !w.startsWith('['));

  // Calculate core word overlap
  const core1Set = new Set(core1);
  const core2Set = new Set(core2);
  const coreIntersection = core1.filter((w) => core2Set.has(w)).length;
  const coreUnion = new Set([...core1, ...core2]).size;

  if (coreUnion === 0) return 0;

  // Jaccard similarity for core words
  const coreSimilarity = coreIntersection / coreUnion;

  // Bonus for seniority match
  const seniority1 = words1.filter((w) => w.startsWith('[')).map((w) => w.slice(1, -1));
  const seniority2 = words2.filter((w) => w.startsWith('[')).map((w) => w.slice(1, -1));
  const seniorityMatch = seniority1.some((s) => seniority2.includes(s)) ? 0.1 : 0;

  return coreSimilarity + seniorityMatch;
}

/**
 * Check if two job titles match (fuzzy matching with multiple strategies)
 */
function titlesMatch(greenhouseTitle: string, supabaseTitle: string, companyName: string): boolean {
  const normalized1 = normalizeJobTitle(greenhouseTitle, companyName);
  const normalized2 = normalizeJobTitle(supabaseTitle, companyName);

  // Strategy 1: Exact match after normalization
  if (normalized1 === normalized2) return true;

  // Strategy 2: One is a prefix of the other (handles truncation)
  if (normalized1.startsWith(normalized2) || normalized2.startsWith(normalized1)) return true;

  // Strategy 3: Character-based substring matching (at least 15 chars)
  const minLength = Math.min(normalized1.length, normalized2.length);
  if (minLength >= 15) {
    const overlap = Math.min(minLength, 20);
    if (normalized1.substring(0, overlap) === normalized2.substring(0, overlap)) {
      return true;
    }
  }

  // Strategy 4: Word-based similarity (semantic matching)
  const similarity = calculateTitleSimilarity(normalized1, normalized2);

  // If similarity is high enough (>= 60% core word overlap), consider it a match
  if (similarity >= 0.6) return true;

  // Strategy 5: Special case - check if all core words from shorter title are in longer title
  const words1 = extractKeyWords(normalized1).filter((w) => !w.startsWith('['));
  const words2 = extractKeyWords(normalized2).filter((w) => !w.startsWith('['));

  const [shorter, longer] =
    words1.length <= words2.length ? [words1, words2] : [words2, words1];

  if (shorter.length >= 2) {
    const longerSet = new Set(longer);
    const allWordsPresent = shorter.every((w) => longerSet.has(w));
    if (allWordsPresent) return true;
  }

  return false;
}

/**
 * Sync jobs for a specific company
 */
async function syncCompanyJobs(
  companyName: string,
  supabaseJobs: SupabaseJob[],
  dryRun: boolean
): Promise<{ matched: number; updated: number }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📍 Company: ${companyName}`);
  console.log(`   Supabase jobs: ${supabaseJobs.length}`);

  // Step 1: Find Greenhouse slug
  console.log(`   🔍 Searching for Greenhouse job board...`);
  const slug = await findGreenhouseSlug(companyName);

  if (!slug) {
    console.log(`   ❌ No Greenhouse job board found`);
    return { matched: 0, updated: 0 };
  }

  console.log(`   ✓ Found slug: "${slug}"`);

  // Step 2: Fetch Greenhouse jobs
  console.log(`   📡 Fetching Greenhouse jobs...`);
  const greenhouseJobs = await fetchGreenhouseJobs(slug);

  if (greenhouseJobs.length === 0) {
    console.log(`   ❌ No jobs found on Greenhouse`);
    return { matched: 0, updated: 0 };
  }

  console.log(`   ✓ Found ${greenhouseJobs.length} Greenhouse jobs\n`);

  // Step 3: Match and update
  let matched = 0;
  let updated = 0;

  for (const supabaseJob of supabaseJobs) {
    console.log(`   🔄 Matching: "${supabaseJob.job_title}"`);

    // Find BEST matching Greenhouse job by scoring all candidates
    let bestMatch: GreenhouseJob | null = null;
    let bestScore = 0;

    for (const greenhouseJob of greenhouseJobs) {
      if (titlesMatch(greenhouseJob.title, supabaseJob.job_title, companyName)) {
        const normalized1 = normalizeJobTitle(greenhouseJob.title, companyName);
        const normalized2 = normalizeJobTitle(supabaseJob.job_title, companyName);
        const score = calculateTitleSimilarity(normalized1, normalized2);

        // Bonus for exact match
        if (normalized1 === normalized2) {
          bestMatch = greenhouseJob;
          bestScore = 2.0; // Guaranteed highest score
          break;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = greenhouseJob;
        }
      }
    }

    if (!bestMatch) {
      console.log(`      ❌ No match found`);
      continue;
    }

    matched++;
    const applicationUrl = bestMatch.absolute_url;

    // CRITICAL: Validate that we're ONLY adding Greenhouse URLs
    if (!applicationUrl.includes('greenhouse.io')) {
      console.log(`      ❌ REJECTED: URL is not a Greenhouse URL: ${applicationUrl}`);
      console.log(`      ⚠️  This should never happen - please report this bug!`);
      continue;
    }

    if (applicationUrl.includes('workatastartup.com') || applicationUrl.includes('ashbyhq.com')) {
      console.log(`      ❌ REJECTED: URL is not a Greenhouse URL: ${applicationUrl}`);
      console.log(`      ⚠️  This should never happen - please report this bug!`);
      continue;
    }

    console.log(`      ✓ Matched with: "${bestMatch.title}" (score: ${bestScore.toFixed(2)})`);
    console.log(`      URL: ${applicationUrl}`);

    if (dryRun) {
      console.log(`      [DRY RUN] Would update job_url`);
    } else {
      // Update Supabase - double check URL is Greenhouse before writing
      if (applicationUrl.includes('greenhouse.io')) {
        const { error } = await supabase
          .from('jobs')
          .update({
            job_url: applicationUrl,
          })
          .eq('id', supabaseJob.id);

        if (error) {
          console.log(`      ❌ Failed to update: ${error.message}`);
        } else {
          console.log(`      ✅ Updated in Supabase`);
          updated++;
        }
      } else {
        console.log(`      ❌ REJECTED: Invalid Greenhouse URL format: ${applicationUrl}`);
      }
    }
  }

  console.log(`\n   📊 Results: ${matched} matched, ${updated} updated`);
  return { matched, updated };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const companyFilter = args.includes('--company')
    ? args[args.indexOf('--company') + 1]
    : null;

  console.log('🚀 Greenhouse Job URL Sync to Supabase');
  console.log('='.repeat(60));
  if (dryRun) console.log('⚠️  DRY RUN MODE - No changes will be made');
  if (companyFilter) console.log(`🎯 Filtering to company: ${companyFilter}`);
  console.log('='.repeat(60));

  // Fetch all jobs from Supabase where job_url is NULL
  console.log('\n📥 Fetching jobs from Supabase (job_url = NULL only)...');

  let query = supabase
    .from('jobs')
    .select('id, startup_id, company_name, job_title, job_url')
    .is('job_url', null);

  const { data, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch jobs:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ No jobs found in database');
    process.exit(0);
  }

  // Transform data
  const jobs: SupabaseJob[] = data.map((row: any) => ({
    id: row.id,
    startup_id: row.startup_id,
    company_name: row.company_name,
    job_title: row.job_title,
    job_url: row.job_url,
    greenhouse_job_id: null,
  }));

  console.log(`✓ Found ${jobs.length} jobs with NULL job_url (skipping jobs that already have URLs)`);

  // Group by company
  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.company_name]) {
      acc[job.company_name] = [];
    }
    acc[job.company_name].push(job);
    return acc;
  }, {} as Record<string, SupabaseJob[]>);

  const companies = Object.keys(jobsByCompany);
  console.log(`✓ Found ${companies.length} companies`);

  // Filter if needed
  const companiesToProcess = companyFilter
    ? companies.filter((c) => c.toLowerCase().includes(companyFilter.toLowerCase()))
    : companies;

  if (companiesToProcess.length === 0) {
    console.log(`❌ No companies found matching filter: ${companyFilter}`);
    process.exit(0);
  }

  console.log(`\n🎯 Processing ${companiesToProcess.length} companies...\n`);

  // Process each company
  let totalMatched = 0;
  let totalUpdated = 0;

  for (let i = 0; i < companiesToProcess.length; i++) {
    const companyName = companiesToProcess[i];
    const companyJobs = jobsByCompany[companyName];

    const result = await syncCompanyJobs(companyName, companyJobs, dryRun);
    totalMatched += result.matched;
    totalUpdated += result.updated;

    // Delay between companies to avoid rate limiting
    if (i < companiesToProcess.length - 1) {
      console.log(`\n   ⏳ Waiting 3 seconds before next company...\n`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Companies processed: ${companiesToProcess.length}`);
  console.log(`Jobs matched: ${totalMatched}`);
  console.log(`Jobs updated: ${totalUpdated}`);
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('Remove --dry-run flag to apply updates');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
