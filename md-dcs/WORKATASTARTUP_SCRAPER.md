# Work at a Startup Scraper

This scraper collects job listings from workatastartup.com and stores them in the `jobs` table, while cross-referencing with the `startups` table.


## Using Python Library (Recommended)

We now use the `ycombinator-scraper` Python library for more reliable scraping.

### Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env.local`:
```env
WORKATASTARTUP_EMAIL=your_email@example.com
WORKATASTARTUP_PASSWORD=your_password
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note:** The `ycombinator-scraper` library requires `login_username` and `login_password` environment variables. Our script automatically maps `WORKATASTARTUP_EMAIL` and `WORKATASTARTUP_PASSWORD` to these variables.

### Usage

**Scrape directory and all companies (test mode - 1 company):**
```bash
python yc_companies/scrape_workatastartup_directory.py --test
```

**Scrape directory with limit:**
```bash
python yc_companies/scrape_workatastartup_directory.py --limit 5
```

**Scrape a specific company:**
```bash
python yc_companies/scrape_workatastartup_python.py https://www.workatastartup.com/companies/example-inc
```

## Setup

### Environment Variables

Add these to your `.env.local` file:

```bash
# Work at a Startup credentials (required for scraping)
WORKATASTARTUP_EMAIL=your-email@example.com
WORKATASTARTUP_PASSWORD=your-password

# Supabase credentials (already required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Migration

Run the migration to create the `jobs` table:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase dashboard
# File: supabase/migrations/012_create_jobs_table.sql
```

## Usage

### Command Line

```bash
# Scrape first 50 jobs (default)
npm run scrape:workatastartup

# Scrape specific number of jobs
npm run scrape:workatastartup 100
```

### API Endpoint

```bash
# GET request (with auth if CRON_SECRET is set)
curl "http://localhost:3000/api/scrape-workatastartup?force=true&limit=50" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# POST request
curl -X POST http://localhost:3000/api/scrape-workatastartup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -d '{"limit": 50}'
```

## How It Works

1. **Authentication**: Logs into workatastartup.com using provided credentials
2. **Navigation**: Navigates to the job listings page
3. **Interaction**: Performs two required clicks to reveal all job data:
   - First click: Usually a "Show more" or tab switch button
   - Second click: Usually an expand/toggle button to reveal details
4. **Scraping**: Extracts job listings with:
   - Company name
   - Job title
   - Job type (fulltime, contract, etc.)
   - Location
   - Job role (Full stack, Backend, etc.)
   - Posted date
   - Company batch (YC batch like S21, W22)
   - Company description
   - Job URL
5. **Cross-referencing**: 
   - Matches companies with existing startups in the database
   - Creates new startup entries for companies not found (marked for enrichment)
   - Links jobs to startups via `startup_id` foreign key

## Database Schema

### Jobs Table

- `id` (UUID, primary key)
- `company_name` (TEXT)
- `job_title` (TEXT)
- `job_type` (TEXT)
- `location` (TEXT)
- `job_role` (TEXT)
- `posted_date` (TEXT)
- `job_url` (TEXT)
- `company_batch` (TEXT) - YC batch (e.g., S21, W22)
- `company_description` (TEXT)
- `startup_id` (UUID, foreign key to startups table)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

Unique constraint on: `(company_name, job_title, job_url)`

## Troubleshooting

### Login Issues

If login fails:
1. Verify credentials are correct in `.env.local`
2. Check if workatastartup.com requires 2FA (not currently supported)
3. Check browser console for errors (run with `headless: false` for debugging)

### Click Detection Issues

If the required clicks aren't being detected:
1. The scraper tries multiple selectors and XPath expressions
2. Check the console output to see which elements were found
3. You may need to update the selectors if the page structure changes
4. Consider running with `headless: false` to see what's happening

### No Jobs Found

If no jobs are found:
1. Verify you're logged in (check console output)
2. Check if the page structure has changed
3. Try increasing wait times in the scraper
4. Run with `headless: false` to debug

## Future Improvements

- [ ] Support for 2FA authentication
- [ ] Better error handling for page structure changes
- [ ] Pagination support for large job lists
- [ ] Rate limiting to avoid being blocked
- [ ] Caching to avoid re-scraping recent jobs

