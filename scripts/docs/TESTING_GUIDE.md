# Testing Guide for Update Mode

This guide walks you through testing the scraper's update mode to verify:
1. ✅ Startup enrichment (adding description, batch, etc.)
2. ✅ New jobs being added
3. ✅ Existing jobs being updated
4. ✅ Old jobs being marked inactive
5. ✅ Fuzzy matching preventing duplicates

## Step 1: Analyze Current State

First, let's see what data we currently have and what will be enriched:

```bash
cd yc_companies
python test_update_mode.py
```

This will:
- Test fuzzy matching logic
- Show you a sample company's current data
- Show what fields will be enriched
- Show current jobs and what will happen to them

**Example output:**
```
STARTUP ANALYSIS: OpenAI
📊 Current Data:
   Name: OpenAI
   Batch: ❌ MISSING
   Description: ❌ MISSING

🔄 What Will Be Enriched:
   ✅ Description (from company_description)
   ✅ Batch (from company_tags)

JOB ANALYSIS: OpenAI
📊 Current Jobs: 5
   1. 🟢 Active - Software Engineer
   2. 🟢 Active - Product Manager
   3. 🔴 Inactive - Old Role (removed)
```

## Step 2: Take a Snapshot

Before running the scraper, take a snapshot of the current database state:

```bash
python compare_scrape_results.py snapshot
```

**Output:**
```
✅ Snapshot saved to scrape_snapshot.json

📊 Current State:
   Startups: 1234
     - With description: 450
     - With batch: 890
     - Needs enrichment: 300
   Jobs: 5678
     - Active: 5200
     - Inactive: 478
```

## Step 3: Dry Run Test

Now run a dry run to see what WOULD happen without actually changing anything:

```bash
python scrape_workatastartup_directory.py --update-mode --dry-run --test
```

**What to look for:**
```
Loading startup cache for fuzzy matching...
Loaded 1234 startups into cache

Fuzzy match found: 'OpenAI' matches existing 'openai'
Fuzzy match found (core): 'Hera Video' matches existing 'Hera'
[DRY RUN] Would create new startup: 'SomeNewCompany'

[DRY RUN] Would insert new job: Software Engineer
[DRY RUN] Would update job: Product Manager
[DRY RUN] Would deactivate: Old Job Title
```

**Good signs:**
- ✅ Many "Fuzzy match found" messages
- ✅ Few "Would create new startup" messages for companies you know exist
- ✅ Jobs being updated/inserted/deactivated as expected

**Bad signs:**
- ❌ "Would create new startup" for companies you know are in the database
  - This means fuzzy matching isn't working well enough
- ❌ All jobs showing as "Would insert" (should be "Would update")
  - This means job URL matching isn't working

## Step 4: Run on One Company

If dry run looks good, test on ONE real company:

```bash
python scrape_workatastartup_directory.py --update-mode --test
```

**What happens:**
- Scrapes 1 company from Work at a Startup
- Updates or inserts startup data
- Scrapes all jobs for that company
- Updates existing jobs or inserts new ones
- Marks missing jobs as inactive

**Monitor the output:**
```
Processing: Example Company
   Fuzzy match found: 'Example Company' matches existing 'ExampleCompany'
   Scraping company data...

   Processing 5 jobs...
   🔄 Updated job #1: Software Engineer
   ✅ Saved job #2: New Position

   Checking for jobs to mark as inactive...
   ❌ Deactivated: Old Job Posting

   ✅ Total: 2 jobs saved, 1 deactivated
```

## Step 5: Compare Results

After the scraper runs, compare the before/after state:

```bash
python compare_scrape_results.py compare
```

**Example output:**
```
COMPARISON RESULTS

📊 STARTUPS:
   Before: 1234
   After:  1235
   Change: +1

   Enrichment:
     With description:
       Before: 450
       After:  451
       Change: +1

📋 JOBS:
   Total:
     Before: 5678
     After:  5682
     Change: +4

   Active:
     Before: 5200
     After:  5203
     Change: +3

   Inactive:
     Before: 478
     After:  479
     Change: +1

🔍 DETAILED CHANGES:

   ✅ New Startups (1):
      - SomeNewCompany

   🔄 Enriched Startups (1):
      - Example Company: added description
      - Example Company: added batch

   ✅ New Jobs (4):
      - Example Company: Software Engineer II
      - Example Company: Product Designer

   ❌ Deactivated Jobs (1):
      - Example Company: Old Position
```

## Step 6: Verify the Changes

Manually check a few things in your database:

### Check Startup Enrichment

```sql
-- Find startups that were enriched
SELECT name, batch,
       CASE WHEN description IS NOT NULL THEN 'Has description' ELSE 'Missing' END as description_status,
       needs_enrichment
FROM startups3
WHERE name = 'Example Company';
```

**Expected result:**
- `batch` should be filled in (e.g., "W24")
- `description` should have text
- `needs_enrichment` should be `false`

### Check Job Updates

```sql
-- Check active jobs for a company
SELECT job_title, is_active, job_url, updated_at
FROM jobs
WHERE company_name = 'Example Company'
ORDER BY is_active DESC, updated_at DESC;
```

**Expected result:**
- New jobs have recent `updated_at` timestamps
- Jobs still on website are `is_active = true`
- Jobs removed from website are `is_active = false`

### Check for Duplicates

```sql
-- Look for potential duplicates (same normalized name)
SELECT name, COUNT(*) as count
FROM startups3
GROUP BY LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'))
HAVING COUNT(*) > 1;
```

**Expected result:**
- Should return NO rows (no duplicates)

## Step 7: Full Run (When Ready)

If everything looks good from testing one company:

```bash
# Take a fresh snapshot
python compare_scrape_results.py snapshot

# Run full update
python scrape_workatastartup_directory.py --update-mode --no-skip-existing --batch-size 10
```

**Monitor for:**
- Many fuzzy matches being found
- Few new startups being created (most should match existing)
- Jobs being updated/inserted/deactivated appropriately
- No errors or crashes

## Troubleshooting

### Issue: Too many "Would create new startup" in dry run

**Cause:** Fuzzy matching not finding existing companies

**Fix:** Check the company names in your database. Run:
```sql
SELECT name FROM startups3 WHERE name ILIKE '%CompanyName%';
```

If the company exists but with a different name variation, you may need to add more suffix patterns to the fuzzy matcher.

### Issue: All jobs showing as new inserts

**Cause:** Job URLs don't match between database and website

**Fix:** Check job URLs:
```sql
SELECT job_url FROM jobs WHERE company_name = 'ExampleCo' LIMIT 5;
```

If URLs are null or different format, the update logic won't match them.

### Issue: No jobs being deactivated

**Cause:**
1. Maybe all jobs are still active on the website (good!)
2. OR update mode isn't enabled

**Fix:** Verify you're using `--update-mode` flag

### Issue: Script crashes or hangs

**Cause:**
- Network issues
- Selenium/Chrome driver issues
- Rate limiting from website

**Fix:**
- Run with `--test` flag first (processes only 1 company)
- Check Chrome driver is installed: `python -c "from webdriver_manager.chrome import ChromeDriverManager; ChromeDriverManager().install()"`
- Add delays between batches with `--batch-size 5`

## Success Criteria

Your update mode is working correctly if:

✅ **Fuzzy Matching:** 90%+ of companies match existing ones (few duplicates created)
✅ **Enrichment:** Startups get description and batch added
✅ **Job Updates:** Existing jobs are updated, not duplicated
✅ **Job Inserts:** New jobs from website are added
✅ **Job Deactivation:** Jobs removed from website are marked `is_active = false`
✅ **No Errors:** Script completes without crashes
✅ **Performance:** Processes companies reasonably fast (caching helps)

## Next Steps

Once testing is successful:

1. **Set up scheduled runs** (cron job or Task Scheduler)
2. **Monitor data quality** (check for duplicates periodically)
3. **Add monitoring/alerts** (notify if scraper fails)
4. **Consider incremental updates** (only update companies with recent job changes)
