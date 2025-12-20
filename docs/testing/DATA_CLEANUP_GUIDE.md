# Data Cleanup Guide: Company Size Filtering

## Problem

Your `jobs` table contains positions from companies that are too large (≥50 employees) because:
1. The `startups` table is missing `team_size` data for some companies
2. Jobs were scraped without validating company size
3. You deleted some bad entries manually but need a systematic cleanup

## Solution Strategy

Follow these steps in order:

---

## Step 1: Analyze the Problem

Run the analysis script to see the current state:

```bash
npx tsx scripts/analyze-startup-data-quality.ts
```

This will show you:
- How many startups are missing `team_size` data
- How many jobs are from large companies (≥50 employees)
- Which companies need to be removed
- Which startups need enrichment

---

## Step 2: Clean Up Existing Bad Data

### Option A: Remove Jobs from Large Companies (Recommended)

```bash
# Dry run first (see what will be deleted)
npx tsx scripts/cleanup-large-company-jobs.ts --dry-run

# If it looks good, run for real
npx tsx scripts/cleanup-large-company-jobs.ts
```

This will:
- Find all startups with `team_size ≥ 50`
- Delete their jobs from the `jobs` table
- Keep the startup in `startups` table (in case you want it for other purposes)

### Option B: Remove Large Companies from Startups Table

If you want to remove the startups entirely:

```sql
-- Run in Supabase SQL Editor
DELETE FROM startups
WHERE team_size IS NOT NULL
  AND (
    team_size LIKE '%50-%'
    OR team_size LIKE '%100-%'
    OR team_size LIKE '%200%'
    OR team_size LIKE '%500%'
    OR team_size LIKE '%1000%'
    OR team_size ~ '^\d{3,}'  -- 3+ digit numbers (100+)
  );
```

This will CASCADE delete all associated jobs due to foreign key constraints.

---

## Step 3: Enrich Missing Team Size Data

For startups without `team_size`, you need to enrich them. Here are your options:

### Option A: Manual Enrichment (Most Accurate)

1. Export startups without team_size:
```sql
SELECT id, name, website
FROM startups
WHERE team_size IS NULL
ORDER BY name;
```

2. Look up each company on:
   - Their website (About/Team page)
   - LinkedIn (Company page shows employee count)
   - Crunchbase
   - Work at a Startup page

3. Update manually:
```sql
UPDATE startups
SET team_size = '10-50'  -- or appropriate size
WHERE id = 'startup-uuid';
```

### Option B: Use LinkedIn/Clearbit API (Automated)

Create an enrichment script that calls:
- **LinkedIn Company API** (requires LinkedIn API access)
- **Clearbit Enrichment API** (costs money but has employee count)
- **PeopleDataLabs** (employee count data)

Example with Clearbit:

```typescript
// scripts/enrich-team-size-clearbit.ts
import { createClient } from '@supabase/supabase-js';

const CLEARBIT_API_KEY = process.env.CLEARBIT_API_KEY;

async function enrichWithClearbit(domain: string) {
  const response = await fetch(
    `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
    {
      headers: { Authorization: `Bearer ${CLEARBIT_API_KEY}` }
    }
  );

  const data = await response.json();
  const employees = data.metrics?.employees;

  if (employees < 10) return '1-10';
  if (employees < 50) return '10-50';
  if (employees < 200) return '50-200';
  return '200+';
}
```

### Option C: Scrape from Work at a Startup (Free)

The YC scraper library might already have this data. Check if it includes employee count:

```python
# In scrape_workatastartup_python.py
# The library may expose team_size in job listings
job.company.team_size  # Check if this exists
```

---

## Step 4: Prevent Future Issues

### Add Validation to Your Scrapers

Update `scrape_workatastartup_python.py` to check team size before scraping jobs:

```python
def should_scrape_company(company_name: str) -> bool:
    """Check if company is small enough to scrape"""
    # Get startup from database
    result = supabase.table("startups") \\
        .select("team_size") \\
        .eq("name", company_name) \\
        .single() \\
        .execute()

    if not result.data:
        print(f"   ⚠️  Company not in database: {company_name}")
        return False  # Don't scrape unknowns

    team_size = result.data.get("team_size")

    if not team_size:
        print(f"   ⚠️  Missing team_size for: {company_name}")
        return False  # Don't scrape without size data

    # Parse team size
    max_size = parse_team_size(team_size)

    if max_size and max_size >= 50:
        print(f"   ❌ Company too large ({team_size}): {company_name}")
        return False

    return True
```

Then in your scraping loop:

```python
if not should_scrape_company(company_name):
    continue  # Skip this company

# Proceed with scraping
```

### Add Database Constraint (Optional)

You could add a check constraint to prevent large companies from even being inserted:

```sql
-- Add a function to parse and validate team_size
CREATE OR REPLACE FUNCTION is_small_company(team_size TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF team_size IS NULL THEN
    RETURN TRUE;  -- Allow NULL (will be enriched later)
  END IF;

  -- Extract max number from team_size
  -- This is a simplified check, adjust as needed
  IF team_size ~ '^[0-9]+-([0-9]+)' THEN
    RETURN (regexp_replace(team_size, '^[0-9]+-([0-9]+).*', '\\1')::INTEGER) < 50;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint (commented out by default, use with caution)
-- ALTER TABLE startups
-- ADD CONSTRAINT check_small_company
-- CHECK (is_small_company(team_size));
```

---

## Step 5: Ongoing Maintenance

### Weekly Data Quality Check

Add to your cron/scheduled tasks:

```bash
# Every Monday at 9 AM
0 9 * * 1 npx tsx scripts/analyze-startup-data-quality.ts
```

### Before Each Scrape Run

```bash
# 1. Check data quality
npx tsx scripts/analyze-startup-data-quality.ts

# 2. Clean up any issues
npx tsx scripts/cleanup-large-company-jobs.ts --dry-run
npx tsx scripts/cleanup-large-company-jobs.ts

# 3. Run your scraper
python3 yc_companies/scrape_workatastartup_python.py
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Analyze current state | `npx tsx scripts/analyze-startup-data-quality.ts` |
| Clean up (dry run) | `npx tsx scripts/cleanup-large-company-jobs.ts --dry-run` |
| Clean up (real) | `npx tsx scripts/cleanup-large-company-jobs.ts` |
| Enrich team size | Manual or API-based (see Step 3) |
| Prevent future issues | Add validation to scrapers (see Step 4) |

---

## Team Size Format

Your `team_size` column should use these formats:

- `"1-10"` - 1 to 10 employees
- `"10-50"` - 10 to 50 employees (✓ Include these)
- `"50-200"` - 50 to 200 employees (❌ Exclude these)
- `"200+"` - 200 or more employees (❌ Exclude these)

The scripts parse these automatically using the maximum value of the range.

---

## Troubleshooting

### "No large companies found but I know there are some"

- Check if `team_size` values are formatted correctly
- Run: `SELECT DISTINCT team_size FROM startups ORDER BY team_size;`
- You might have values like "50" (without range) or "Medium" (text)

### "Too many companies missing team_size"

- Prioritize enriching the ones with the most jobs
- Run analysis script to see which companies to enrich first
- Consider using an API service for bulk enrichment

### "Script deleted jobs but they came back"

- Your scraper is running again without validation
- Add the validation from Step 4
- Consider disabling auto-scraping until validation is in place

---

## Next Steps

1. **Now**: Run `analyze-startup-data-quality.ts` to see the damage
2. **Today**: Clean up existing bad data with `cleanup-large-company-jobs.ts`
3. **This Week**: Enrich missing team_size data (prioritize companies with most jobs)
4. **Before Next Scrape**: Add validation to prevent future issues

**Need help?** Check the output of the analysis script for specific recommendations.
