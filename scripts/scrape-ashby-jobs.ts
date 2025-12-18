/**
 * Ashby Job Board Scraper
 *
 * This script:
 * 1. Tries to find the Ashby job board slug for a company
 * 2. Fetches job data from Ashby API: https://api.ashbyhq.com/posting-api/job-board/{slug}
 * 3. Generates direct application links: https://jobs.ashbyhq.com/{company-slug}/{job-uuid}
 *
 * Usage:
 *   npx tsx scripts/scrape-ashby-jobs.ts "Firecrawl"
 *   npx tsx scripts/scrape-ashby-jobs.ts "Stripe" "OpenAI" "Anthropic"
 *   npx tsx scripts/scrape-ashby-jobs.ts --slug firecrawl
 */

import https from 'https';

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employmentType?: string;
  isListed: boolean;
}

interface AshbyAPIResponse {
  jobs: Array<{
    id: string;
    title: string;
    departmentName?: string;
    locationName?: string;
    employmentType?: string;
    isListed: boolean;
  }>;
}

interface JobResult {
  companyName: string;
  companySlug: string;
  jobs: Array<{
    id: string;
    title: string;
    department?: string;
    location?: string;
    employmentType?: string;
    applicationLink: string;
  }>;
}

/**
 * Fetch job data from Ashby API
 */
async function fetchAshbyJobs(slug: string): Promise<AshbyAPIResponse | null> {
  return new Promise((resolve) => {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Generate possible slug variations from company name
 */
function generateSlugVariations(companyName: string): string[] {
  const base = companyName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim();

  const variations = [
    base,
    base.replace(/-/g, ''), // No hyphens
    companyName.toLowerCase().replace(/\s+/g, ''), // No spaces, no hyphens
    companyName.toLowerCase().split(/\s+/)[0], // First word only
  ];

  // Remove duplicates
  return [...new Set(variations)];
}

/**
 * Try to find the correct Ashby slug for a company
 */
async function findAshbySlug(companyName: string, providedSlug?: string): Promise<string | null> {
  if (providedSlug) {
    console.log(`   Trying provided slug: "${providedSlug}"`);
    const data = await fetchAshbyJobs(providedSlug);
    if (data && data.jobs) {
      console.log(`   ✓ Found valid Ashby job board: "${providedSlug}"`);
      return providedSlug;
    }
    console.log(`   ✗ Slug "${providedSlug}" not found`);
    return null;
  }

  console.log(`   Generating slug variations...`);
  const variations = generateSlugVariations(companyName);
  console.log(`   Trying ${variations.length} variations: ${variations.join(', ')}`);

  for (const slug of variations) {
    const data = await fetchAshbyJobs(slug);
    if (data && data.jobs) {
      console.log(`   ✓ Found valid Ashby job board: "${slug}"`);
      return slug;
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`   ✗ No valid slug found for "${companyName}"`);
  return null;
}

/**
 * Main function to scrape jobs for a company
 */
async function scrapeCompanyJobs(companyName: string, providedSlug?: string): Promise<JobResult | null> {
  console.log(`\n🔍 Processing: "${companyName}"`);

  // Step 1: Find the Ashby slug
  const slug = await findAshbySlug(companyName, providedSlug);

  if (!slug) {
    console.log(`   ❌ No Ashby job board found for "${companyName}"`);
    console.log(`   💡 Tip: If you know the slug, use: --slug your-company-slug`);
    return null;
  }

  // Step 2: Fetch job data from Ashby API
  console.log(`   📡 Fetching jobs from Ashby API...`);
  const apiData = await fetchAshbyJobs(slug);

  if (!apiData || !apiData.jobs) {
    console.log(`   ❌ No job data found for slug "${slug}"`);
    return null;
  }

  // Step 3: Process and generate application links
  const jobs = apiData.jobs
    .filter(job => job.isListed) // Only include listed jobs
    .map(job => ({
      id: job.id,
      title: job.title,
      department: job.departmentName,
      location: job.locationName,
      employmentType: job.employmentType,
      applicationLink: `https://jobs.ashbyhq.com/${slug}/${job.id}`
    }));

  console.log(`   ✅ Found ${jobs.length} active job postings`);

  return {
    companyName,
    companySlug: slug,
    jobs
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Check for --slug flag
  let providedSlug: string | undefined;
  const slugIndex = args.indexOf('--slug');
  if (slugIndex !== -1 && args[slugIndex + 1]) {
    providedSlug = args[slugIndex + 1];
    args.splice(slugIndex, 2); // Remove --slug and its value
  }

  if (args.length === 0 && !providedSlug) {
    console.log('Usage: npx tsx scripts/scrape-ashby-jobs.ts [options] "Company Name" ["Company 2" ...]');
    console.log('\nOptions:');
    console.log('  --slug <slug>    Provide the Ashby slug directly (skips slug detection)');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/scrape-ashby-jobs.ts "Firecrawl"');
    console.log('  npx tsx scripts/scrape-ashby-jobs.ts --slug firecrawl "Firecrawl"');
    console.log('  npx tsx scripts/scrape-ashby-jobs.ts "Stripe" "OpenAI" "Anthropic"');
    process.exit(1);
  }

  console.log('🚀 Ashby Job Board Scraper');
  console.log('='.repeat(50));

  const results: JobResult[] = [];

  if (providedSlug && args.length === 0) {
    // If only slug provided, use it as company name too
    const result = await scrapeCompanyJobs(providedSlug, providedSlug);
    if (result) results.push(result);
  } else {
    for (const companyName of args) {
      const result = await scrapeCompanyJobs(companyName, providedSlug);
      if (result) {
        results.push(result);
      }
      // Add delay between companies to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(50));

  if (results.length === 0) {
    console.log('No jobs found for any company.');
  } else {
    for (const result of results) {
      console.log(`\n${result.companyName} (${result.companySlug}):`);
      console.log(`  ${result.jobs.length} job(s) found`);

      result.jobs.forEach((job, index) => {
        console.log(`\n  ${index + 1}. ${job.title}`);
        if (job.department) console.log(`     Department: ${job.department}`);
        if (job.location) console.log(`     Location: ${job.location}`);
        if (job.employmentType) console.log(`     Type: ${job.employmentType}`);
        console.log(`     Apply: ${job.applicationLink}`);
      });
    }

    // Export as JSON
    console.log('\n' + '='.repeat(50));
    console.log('📄 JSON OUTPUT');
    console.log('='.repeat(50));
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);
