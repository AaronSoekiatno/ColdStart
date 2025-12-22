# Sync Ashby Job URLs to Supabase

This script automatically finds Ashby job board URLs and updates your Supabase `jobs` table with direct application links.

## What It Does

1. **Pulls all jobs** from your Supabase `jobs` table
2. **Groups by company** (startup)
3. **Searches for Ashby job board** using DuckDuckGo
4. **Matches job titles** using fuzzy matching (handles truncation)
5. **Updates Supabase** with Ashby application URLs

## How Title Matching Works

The script uses intelligent fuzzy matching to handle title variations:

**Examples:**
- ✅ "Software Engineer" matches "Software Engineer at Candid Health (W20)"
- ✅ "Member of Technical Staff" matches "Member of Technical Staff, AI Engineer"
- ✅ "Product Manager" matches "Product Manager (Remote)"

**Matching Logic:**
1. Removes company name suffixes (e.g., "at Company (W20)")
2. Removes parentheses and normalizes whitespace
3. Checks for exact match after normalization
4. Checks if one title is a prefix of the other (truncation)
5. Compares first 20 characters if both titles are long
6. Compares first 3 words if both have at least 3 words

## Usage

### Dry Run (No Changes)

Test the script without making any changes:

```bash
npx tsx scripts/sync-ashby-jobs-to-supabase.ts --dry-run
```

### Sync All Companies

Update all jobs in the database:

```bash
npx tsx scripts/sync-ashby-jobs-to-supabase.ts
```

### Sync Single Company

Update jobs for a specific company:

```bash
npx tsx scripts/sync-ashby-jobs-to-supabase.ts --company "Harper"
npx tsx scripts/sync-ashby-jobs-to-supabase.ts --company "Candid Health"
```

### Dry Run for Single Company

Test matching for one company:

```bash
npx tsx scripts/sync-ashby-jobs-to-supabase.ts --company "Harper" --dry-run
```

## Example Output

```
🚀 Ashby Job URL Sync to Supabase
============================================================

📥 Fetching jobs from Supabase...
✓ Found 143 total jobs
✓ Found 12 companies

🎯 Processing 12 companies...

============================================================
📍 Company: Harper
   Supabase jobs: 8
   🔍 Searching for Ashby job board...
   ✓ Found slug: "harperinsure"
   📡 Fetching Ashby jobs...
   ✓ Found 8 Ashby jobs

   🔄 Matching: "Go-to-Market Growth Lead at Harper"
      ✓ Matched with: "Go-to-Market Growth Lead"
      URL: https://jobs.ashbyhq.com/harperinsure/f8a472a3-1a20-4360-814a-eb1e441ad86f
      ✅ Updated in Supabase

   🔄 Matching: "Member of Technical Staff, AI Engineer"
      ✓ Matched with: "Member of Technical Staff, AI Engineer"
      URL: https://jobs.ashbyhq.com/harperinsure/cdcf6335-0010-492c-b114-24028d79ad31
      ✅ Updated in Supabase

   📊 Results: 8 matched, 8 updated

   ⏳ Waiting 3 seconds before next company...

============================================================
📍 Company: Candid Health
   Supabase jobs: 15
   🔍 Searching for Ashby job board...
   ✓ Found slug: "candidhealth"
   📡 Fetching Ashby jobs...
   ✓ Found 12 Ashby jobs

   🔄 Matching: "Software Engineer at Candid Health (W20)"
      ✓ Matched with: "Software Engineer"
      URL: https://jobs.ashbyhq.com/candidhealth/abc123...
      ✅ Updated in Supabase

   ...

============================================================
✅ SYNC COMPLETE
============================================================
Companies processed: 12
Jobs matched: 89
Jobs updated: 89
============================================================
```

## Database Schema

The script updates these columns in the `jobs` table:

```sql
-- Updated columns
job_url          TEXT        -- Ashby application URL
ashby_job_id     TEXT        -- Ashby job UUID for reference
```

## Rate Limiting

The script automatically:
- Waits 3 seconds between companies
- Uses proper User-Agent headers
- Handles DuckDuckGo rate limits gracefully

## Error Handling

If a company's Ashby board isn't found:
- ❌ Logged to console
- ⏭️ Script continues with next company
- 📊 Final summary shows which companies succeeded

If a job title doesn't match:
- ❌ Logged for that specific job
- ⏭️ Script continues with other jobs
- 📊 Match rate shown in summary

## Best Practices

1. **Always run dry-run first:**
   ```bash
   npx tsx scripts/sync-ashby-jobs-to-supabase.ts --dry-run
   ```

2. **Test on single company:**
   ```bash
   npx tsx scripts/sync-ashby-jobs-to-supabase.ts --company "Harper" --dry-run
   ```

3. **Review output carefully** before running without --dry-run

4. **Run during off-hours** to avoid disrupting users (it's slow due to rate limits)

## Troubleshooting

### No matches found

If jobs aren't matching, check:
- Job titles in Supabase vs Ashby
- Company name spelling
- Try adding company to filter: `--company "Exact Name"`

### Ashby board not found

If search doesn't find the board:
1. Manually find the Ashby slug
2. Add to startups table: `UPDATE startups SET ashby_slug = 'slug' WHERE name = 'Company';`
3. Modify script to use saved slugs (coming soon)

### Rate limiting

If you hit rate limits:
- Increase delay between companies (edit line 262: `setTimeout(resolve, 3000)` → `5000`)
- Process companies in smaller batches using `--company` filter
- Run script overnight

## Future Enhancements

- [ ] Use saved `ashby_slug` from startups table (faster, no search needed)
- [ ] Batch processing with resume capability
- [ ] Confidence scores for matches
- [ ] Manual review mode for low-confidence matches
- [ ] Slack notifications when done

## Related Scripts

- `find-ashby-slug-with-search.ts` - Find Ashby slugs manually
- `scrape-ashby-jobs.ts` - Quick Ashby job scraper
