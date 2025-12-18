/**
 * Find Ashby Slug Using Web Search
 *
 * This script uses web search to find a company's Ashby job board URL,
 * then extracts the slug and fetches job postings.
 *
 * For companies like "Harper" where the slug is "harperinsure",
 * simple variations won't work - you need web search.
 *
 * Usage:
 *   npx tsx scripts/find-ashby-slug-with-search.ts "Harper"
 *   npx tsx scripts/find-ashby-slug-with-search.ts "Company Name"
 */

import https from 'https';

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

/**
 * Extract Ashby slug from a URL
 */
function extractAshbySlug(url: string): string | null {
  // Pattern 1: jobs.ashbyhq.com/{slug}
  const jobsMatch = url.match(/jobs\.ashbyhq\.com\/([^\/\?#]+)/);
  if (jobsMatch) return jobsMatch[1];

  // Pattern 2: ashbyhq.com/customers/{slug}
  const customersMatch = url.match(/ashbyhq\.com\/customers\/([^\/\?#]+)/);
  if (customersMatch) return customersMatch[1];

  return null;
}

/**
 * Search using Google Custom Search JSON API (free, no API key needed for basic scraping)
 */
async function searchGoogle(query: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    // Use Google search with site:ashbyhq.com to only get Ashby results
    const searchQuery = encodeURIComponent(`${query} site:ashbyhq.com`);
    const url = `https://www.google.com/search?q=${searchQuery}&num=10`;

    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1',
          },
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            // Extract URLs from Google search results
            // Look for ashbyhq.com URLs in the HTML
            const urlMatches = [
              ...data.matchAll(/https?:\/\/[^"\s<>]*ashbyhq\.com[^"\s<>]*/g),
            ];

            const urls = urlMatches
              .map((match) => {
                let url = match[0];

                // Clean up URL
                url = url
                  .replace(/&amp;/g, '&')
                  .replace(/&#x2F;/g, '/')
                  .replace(/&#x3D;/g, '=')
                  .replace(/&quot;/g, '"')
                  .replace(/[<>]/g, ''); // Remove any trailing HTML chars

                return url;
              })
              .filter((url) => url.includes('ashbyhq.com') && !url.includes('google.com'));

            // Remove duplicates
            const uniqueUrls = [...new Set(urls)];
            resolve(uniqueUrls);
          });
        }
      )
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Search DuckDuckGo Lite (simpler, more bot-friendly)
 */
async function searchDuckDuckGoLite(query: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query + ' site:ashbyhq.com');
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            // Extract URLs from DuckDuckGo Lite results
            const urlMatches = [
              ...data.matchAll(/https?:\/\/[^"\s<>]*ashbyhq\.com[^"\s<>]*/g),
            ];

            const urls = urlMatches
              .map((match) => {
                let url = match[0];

                // Clean up URL
                url = url
                  .replace(/&amp;/g, '&')
                  .replace(/&#x2F;/g, '/')
                  .replace(/&#x3D;/g, '=')
                  .replace(/&quot;/g, '"')
                  .replace(/[<>]/g, '');

                return url;
              })
              .filter((url) => url.includes('ashbyhq.com'));

            // Remove duplicates
            const uniqueUrls = [...new Set(urls)];
            resolve(uniqueUrls);
          });
        }
      )
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Search for Ashby job board URL using multiple search engines
 */
async function searchForAshbySlug(companyName: string): Promise<string | null> {
  try {
    const query = `${companyName} careers`;
    console.log(`   🔍 Searching for: "${companyName}"`);

    // Strategy 1: Try DuckDuckGo Lite first (fastest)
    console.log(`   📡 Trying DuckDuckGo Lite...`);
    let urls = await searchDuckDuckGoLite(query);

    // Strategy 2: If DDG fails, try Google
    if (urls.length === 0) {
      console.log(`   📡 Trying Google Search...`);
      urls = await searchGoogle(query);
    }

    if (urls.length === 0) {
      console.log(`   ❌ No ashbyhq URLs found in search results`);
      return null;
    }

    console.log(`   ✓ Found ${urls.length} ashbyhq URL(s)`);

    // Try to extract slug from URLs
    for (const url of urls) {
      console.log(`   🔗 Checking: ${url.substring(0, 80)}...`);
      const slug = extractAshbySlug(url);
      if (slug) {
        console.log(`   ✓ Extracted slug: "${slug}"`);

        // Verify the slug works by trying to fetch jobs
        console.log(`   🔍 Verifying slug works...`);
        const testData = await fetchAshbyJobs(slug);
        if (testData && testData.jobs && testData.jobs.length > 0) {
          console.log(`   ✅ Slug verified! Found ${testData.jobs.length} jobs`);
          return slug;
        } else {
          console.log(`   ⚠️  Slug "${slug}" found but no jobs returned, trying next URL...`);
        }
      }
    }

    console.log(`   ❌ Could not extract working slug from URLs`);
    return null;
  } catch (error) {
    console.error(`   ❌ Search error:`, error);
    return null;
  }
}

/**
 * Fetch job data from Ashby API
 */
async function fetchAshbyJobs(slug: string): Promise<AshbyAPIResponse | null> {
  return new Promise((resolve) => {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

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
              const json = JSON.parse(data);
              resolve(json);
            } catch (err) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      }
    ).on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/find-ashby-slug-with-search.ts "Company Name"');
    console.log('\nExample:');
    console.log('  npx tsx scripts/find-ashby-slug-with-search.ts "Harper"');
    console.log('  npx tsx scripts/find-ashby-slug-with-search.ts "Anthropic"');
    console.log('\nNote: This uses web search to find the Ashby slug.');
    console.log('For faster results with known companies, use the regular scraper.');
    process.exit(1);
  }

  console.log('🚀 Ashby Slug Finder (Web Search)');
  console.log('='.repeat(50));

  for (const companyName of args) {
    console.log(`\n📍 Company: "${companyName}"`);

    // Step 1: Search for Ashby slug
    const slug = await searchForAshbySlug(companyName);

    if (!slug) {
      console.log(`   ❌ Could not find Ashby job board for "${companyName}"\n`);
      // Add delay before next search
      if (args.indexOf(companyName) < args.length - 1) {
        console.log('   ⏳ Waiting 3 seconds before next search...\n');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      continue;
    }

    // Step 2: Verify slug and fetch jobs
    console.log(`   📡 Fetching jobs from Ashby API...`);
    const apiData = await fetchAshbyJobs(slug);

    if (!apiData || !apiData.jobs) {
      console.log(`   ❌ No job data found for slug "${slug}"\n`);
      continue;
    }

    // Step 3: Display results
    const jobs = apiData.jobs.filter((job) => job.isListed);
    console.log(`   ✅ Found ${jobs.length} active job postings\n`);

    if (jobs.length > 0) {
      console.log('   📋 Jobs:');
      jobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.title}`);
        if (job.departmentName) console.log(`      Department: ${job.departmentName}`);
        if (job.locationName) console.log(`      Location: ${job.locationName}`);
        console.log(`      Apply: https://jobs.ashbyhq.com/${slug}/${job.id}`);
      });
    }

    console.log('\n   💡 Save this slug:');
    console.log(`   Company: ${companyName}`);
    console.log(`   Ashby Slug: ${slug}`);
    console.log(`   SQL: UPDATE startups SET ashby_slug = '${slug}' WHERE name = '${companyName}';\n`);

    // Delay between companies to avoid rate limiting
    if (args.indexOf(companyName) < args.length - 1) {
      console.log('   ⏳ Waiting 3 seconds before next search...\n');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log('='.repeat(50));
  console.log('✅ Done!');
}

main().catch(console.error);
