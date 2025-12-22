# Ashby Job Board Scraper

A complete solution for fetching job postings from companies using Ashby ATS (Applicant Tracking System).

## Overview

This integration allows you to:
1. ✅ Automatically find a company's Ashby job board slug
2. ✅ Fetch all active job postings via Ashby's API
3. ✅ Generate direct application links for each job
4. ✅ Use in scripts, API routes, or server components

## Files

- **`scripts/scrape-ashby-jobs.ts`** - CLI script for testing and bulk scraping
- **`lib/ashby-jobs.ts`** - Reusable library functions for your app
- **`app/api/startups/[id]/jobs/route.ts`** - Example API route integration

## Quick Start

### 1. CLI Script Usage

Test job scraping from the command line:

```bash
# Automatic slug detection
npx tsx scripts/scrape-ashby-jobs.ts "Firecrawl"

# Multiple companies
npx tsx scripts/scrape-ashby-jobs.ts "Firecrawl" "Stripe" "OpenAI"

# Provide slug directly (faster, skips detection)
npx tsx scripts/scrape-ashby-jobs.ts --slug firecrawl "Firecrawl"
```

**Example Output:**
```
🚀 Ashby Job Board Scraper
==================================================

🔍 Processing: "Firecrawl"
   Generating slug variations...
   Trying 1 variations: firecrawl
   ✓ Found valid Ashby job board: "firecrawl"
   📡 Fetching jobs from Ashby API...
   ✅ Found 7 active job postings

==================================================
📊 RESULTS SUMMARY
==================================================

Firecrawl (firecrawl):
  7 job(s) found

  1. Success Engineer
     Type: FullTime
     Apply: https://jobs.ashbyhq.com/firecrawl/7a82c69d-89e3-4f0e-bf85-9bc56162dd9b

  2. Browser Systems Engineer
     Type: FullTime
     Apply: https://jobs.ashbyhq.com/firecrawl/74d64dd0-daef-437d-8eb5-f86e282fac27

  ... (5 more jobs)
```

### 2. Library Function Usage

Import and use in your Next.js app:

```typescript
import { fetchAshbyJobs } from '@/lib/ashby-jobs';

// Fetch jobs for a single company
const result = await fetchAshbyJobs('Firecrawl');

if (result.jobs.length > 0) {
  console.log(`Found ${result.jobs.length} jobs for ${result.companyName}`);

  result.jobs.forEach(job => {
    console.log(`- ${job.title}: ${job.applicationLink}`);
  });
} else {
  console.log(`No Ashby job board found: ${result.error}`);
}

// With known slug (faster)
const result = await fetchAshbyJobs('Firecrawl', 'firecrawl');

// Fetch for multiple companies
import { fetchAshbyJobsForMultipleCompanies } from '@/lib/ashby-jobs';

const results = await fetchAshbyJobsForMultipleCompanies([
  'Firecrawl',
  { name: 'Anthropic', slug: 'anthropic' },
  'OpenAI'
]);
```

### 3. API Route Usage

Access via HTTP:

```bash
# Fetch jobs for a startup
GET /api/startups/123/jobs

# With known slug (faster)
GET /api/startups/123/jobs?slug=firecrawl
```

**Example Response:**
```json
{
  "success": true,
  "companyName": "Firecrawl",
  "companySlug": "firecrawl",
  "jobCount": 7,
  "jobs": [
    {
      "id": "7a82c69d-89e3-4f0e-bf85-9bc56162dd9b",
      "title": "Success Engineer",
      "department": null,
      "location": null,
      "employmentType": "FullTime",
      "applicationLink": "https://jobs.ashbyhq.com/firecrawl/7a82c69d-89e3-4f0e-bf85-9bc56162dd9b"
    },
    ...
  ]
}
```

## How It Works

### 1. Slug Detection

The system tries multiple slug variations automatically:

```
Company: "Firecrawl"
Tries:
  - firecrawl
  - Firecrawl (lowercase)

Company: "Y Combinator"
Tries:
  - y-combinator
  - ycombinator
  - y
```

### 2. API Request

Once the slug is found, it fetches from:
```
https://api.ashbyhq.com/posting-api/job-board/{slug}
```

### 3. Link Generation

For each job, it generates a direct application link:
```
https://jobs.ashbyhq.com/{slug}/{job-uuid}
```

## Integration with Matches Page

### Option 1: Fetch on Demand

Fetch jobs when the user views a startup:

```typescript
// In your matches page component
'use client';

import { useState } from 'react';
import { AshbyJob } from '@/lib/ashby-jobs';

export function StartupCard({ startup }) {
  const [jobs, setJobs] = useState<AshbyJob[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    const res = await fetch(`/api/startups/${startup.id}/jobs`);
    const data = await res.json();
    if (data.success) {
      setJobs(data.jobs);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>{startup.name}</h2>
      <button onClick={fetchJobs}>View Open Positions</button>

      {loading && <p>Loading jobs...</p>}

      {jobs.length > 0 && (
        <ul>
          {jobs.map(job => (
            <li key={job.id}>
              <a href={job.applicationLink} target="_blank">
                {job.title}
                {job.department && ` - ${job.department}`}
                {job.location && ` (${job.location})`}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Option 2: Pre-fetch in Database

Store Ashby slugs in your startups table:

```sql
-- Add column to startups table
ALTER TABLE startups ADD COLUMN ashby_slug TEXT;

-- Update known slugs
UPDATE startups SET ashby_slug = 'firecrawl' WHERE name = 'Firecrawl';
```

Then create a background job to sync jobs periodically:

```typescript
// scripts/sync-ashby-jobs.ts
import { createClient } from '@supabase/supabase-js';
import { fetchAshbyJobs } from '@/lib/ashby-jobs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncJobs() {
  // Fetch all startups with Ashby slugs
  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, ashby_slug')
    .not('ashby_slug', 'is', null);

  for (const startup of startups || []) {
    const result = await fetchAshbyJobs(startup.name, startup.ashby_slug);

    if (result.jobs.length > 0) {
      // Store in job_openings column or separate table
      await supabase
        .from('startups')
        .update({
          job_openings: result.jobs.map(j => j.title).join(', '),
          // Or store full JSON
          ashby_jobs_data: result.jobs
        })
        .eq('id', startup.id);
    }
  }
}

syncJobs();
```

## Performance Considerations

1. **Caching**: The `fetchAshbyJobs` function uses Next.js cache with 1-hour revalidation
2. **Rate Limiting**: Built-in 500ms delay between slug variation attempts
3. **Parallel Requests**: Use `fetchAshbyJobsForMultipleCompanies` for bulk operations

## Limitations

- Only works for companies using Ashby ATS
- Requires knowing the company name or slug
- Some companies may have custom domains (harder to detect automatically)

## Troubleshooting

**No jobs found:**
```bash
# Try providing the slug manually
npx tsx scripts/scrape-ashby-jobs.ts --slug company-slug "Company Name"
```

**Find the slug manually:**
1. Go to the company's careers page
2. Look for links to `jobs.ashbyhq.com/[slug]`
3. Use that slug with `--slug` flag

## Next Steps

1. ✅ Test with your startup database
2. ✅ Add `ashby_slug` column to startups table
3. ✅ Integrate into matches page UI
4. ✅ Set up periodic background sync (optional)
5. ✅ Add analytics tracking for job clicks (optional)

## Examples

See the test output above or run:
```bash
npx tsx scripts/scrape-ashby-jobs.ts "Firecrawl"
```
