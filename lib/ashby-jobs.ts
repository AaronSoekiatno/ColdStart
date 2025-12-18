/**
 * Ashby Job Board Integration
 *
 * Library for fetching job postings from companies using Ashby ATS.
 * This can be used in API routes, server components, or background jobs.
 */

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

export interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employmentType?: string;
  applicationLink: string;
}

export interface AshbyJobBoardResult {
  companyName: string;
  companySlug: string;
  jobs: AshbyJob[];
  error?: string;
}

/**
 * Fetch job data from Ashby API
 */
async function fetchAshbyJobsAPI(slug: string): Promise<AshbyAPIResponse | null> {
  try {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      // Cache for 1 hour - job postings don't change that frequently
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data as AshbyAPIResponse;
  } catch (error) {
    console.error(`Error fetching Ashby jobs for slug "${slug}":`, error);
    return null;
  }
}

/**
 * Generate possible slug variations from company name
 */
function generateSlugVariations(companyName: string): string[] {
  const base = companyName
    .toLowerCase()
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
 * Extract Ashby slug from a URL
 * Examples:
 *   https://jobs.ashbyhq.com/firecrawl -> firecrawl
 *   https://jobs.ashbyhq.com/harperinsure/... -> harperinsure
 *   https://www.ashbyhq.com/customers/firecrawl -> firecrawl
 */
export function extractAshbySlugFromURL(url: string): string | null {
  // Pattern 1: jobs.ashbyhq.com/{slug}
  const jobsMatch = url.match(/jobs\.ashbyhq\.com\/([^\/\?#]+)/);
  if (jobsMatch) return jobsMatch[1];

  // Pattern 2: ashbyhq.com/customers/{slug}
  const customersMatch = url.match(/ashbyhq\.com\/customers\/([^\/\?#]+)/);
  if (customersMatch) return customersMatch[1];

  return null;
}

/**
 * Try to find the correct Ashby slug for a company by testing variations
 */
async function findAshbySlugByVariations(
  companyName: string
): Promise<string | null> {
  const variations = generateSlugVariations(companyName);

  for (const slug of variations) {
    const data = await fetchAshbyJobsAPI(slug);
    if (data && data.jobs) {
      return slug;
    }
    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

/**
 * Fetch jobs for a company from Ashby
 *
 * @param companyName - Name of the company
 * @param providedSlug - Optional: provide the Ashby slug if you know it (skips detection)
 * @returns Job board result with jobs array
 *
 * @example
 * ```ts
 * // Automatic slug detection
 * const result = await fetchAshbyJobs('Firecrawl');
 *
 * // With known slug
 * const result = await fetchAshbyJobs('Firecrawl', 'firecrawl');
 *
 * if (result.jobs.length > 0) {
 *   console.log(`Found ${result.jobs.length} jobs`);
 *   result.jobs.forEach(job => {
 *     console.log(`${job.title}: ${job.applicationLink}`);
 *   });
 * }
 * ```
 */
export async function fetchAshbyJobs(
  companyName: string,
  providedSlug?: string
): Promise<AshbyJobBoardResult> {
  // Step 1: Use provided slug or try variations
  let slug: string | null = null;

  if (providedSlug) {
    const data = await fetchAshbyJobsAPI(providedSlug);
    if (data && data.jobs) {
      slug = providedSlug;
    }
  } else {
    slug = await findAshbySlugByVariations(companyName);
  }

  if (!slug) {
    return {
      companyName,
      companySlug: '',
      jobs: [],
      error: `No Ashby job board found for "${companyName}". Try providing the slug manually or use web search.`,
    };
  }

  // Step 2: Fetch job data
  const apiData = await fetchAshbyJobsAPI(slug);

  if (!apiData || !apiData.jobs) {
    return {
      companyName,
      companySlug: slug,
      jobs: [],
      error: `No job data found for slug "${slug}"`,
    };
  }

  // Step 3: Process and generate application links
  const jobs = apiData.jobs
    .filter((job) => job.isListed) // Only include listed jobs
    .map((job) => ({
      id: job.id,
      title: job.title,
      department: job.departmentName,
      location: job.locationName,
      employmentType: job.employmentType,
      applicationLink: `https://jobs.ashbyhq.com/${slug}/${job.id}`,
    }));

  return {
    companyName,
    companySlug: slug,
    jobs,
  };
}

/**
 * Fetch jobs for multiple companies in parallel
 *
 * @param companies - Array of company names or {name, slug} objects
 * @returns Array of job board results
 *
 * @example
 * ```ts
 * const results = await fetchAshbyJobsForMultipleCompanies([
 *   'Firecrawl',
 *   { name: 'Anthropic', slug: 'anthropic' },
 *   'OpenAI'
 * ]);
 *
 * results.forEach(result => {
 *   if (result.jobs.length > 0) {
 *     console.log(`${result.companyName}: ${result.jobs.length} jobs`);
 *   }
 * });
 * ```
 */
export async function fetchAshbyJobsForMultipleCompanies(
  companies: Array<string | { name: string; slug?: string }>
): Promise<AshbyJobBoardResult[]> {
  const promises = companies.map((company) => {
    if (typeof company === 'string') {
      return fetchAshbyJobs(company);
    } else {
      return fetchAshbyJobs(company.name, company.slug);
    }
  });

  return Promise.all(promises);
}
