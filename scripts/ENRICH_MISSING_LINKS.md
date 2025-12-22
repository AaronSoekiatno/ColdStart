# Enrich Startups Missing YC Links

## Problem
You have 131 startups in Supabase's `startups3` table that have **names but are missing `yc_link`**. This script automatically:

1. Fetches all startups from Supabase where `name IS NOT NULL` and `yc_link IS NULL`
2. For each startup, searches YC directory using the company name
3. Scrapes the full YC company page (founders, logo, website, etc.)
4. Updates the Supabase record with all enriched data including the `yc_link`

## Quick Start

### Process all 131 startups
```bash
npm run enrich:missing-links
```

### Test with first 5 startups
```bash
npm run enrich:missing-links -- --limit=5
```

### Test with first 10 startups
```bash
npm run enrich:missing-links -- --limit=10
```

## What It Does

### 1. Finds Startups in Supabase
Queries for startups matching:
- `name IS NOT NULL` (has a company name)
- `yc_link IS NULL` (missing YC URL)

### 2. Enriches Each Startup
For each startup name (e.g., "Sapling AI"):
- 🔍 Searches YC directory: `ycombinator.com/companies?query=Sapling AI`
- 🎯 Finds best match and extracts YC URL
- 🖼️ Captures company logo
- 📄 Scrapes full YC company page
- 💾 Updates Supabase with:
  - `yc_link` - The YC company URL
  - `company_logo` - Company logo URL
  - `founder_names` - Founder names
  - `founder_linkedin` - Founder LinkedIn profiles
  - `founder_twitter_urls` - Founder Twitter profiles
  - `company_twitter_url` - Company Twitter
  - `website` - Company website
  - `team_size` - Team size
  - `founder_backgrounds` - Founder bios
  - `founders_pfp` - Founder profile pictures
  - `yc_description` - YC description
  - And more...

### 3. Shows Summary Report
At the end, you get:
- ✅ Successfully enriched count
- ❌ Failed (errors) count
- 🔍 Not found in YC count
- List of failed/not found companies

## Example Output

```bash
npm run enrich:missing-links -- --limit=3
```

```
🚀 Starting Enrichment for Startups Without YC Links...

✓ Connected to Supabase

📂 Fetching startups without YC links from Supabase...
   Found 131 startup(s) without YC links

   ⚠️  Limited to first 3 startups for testing

📋 Startups to enrich: 3
   1. Sapling AI (W19)
   2. Finch (S20)
   3. Vanta (W18)

🌐 Launching browser...
✓ Browser ready

[1/3] Processing: Sapling AI
   Batch: W19

================================================================================
📦 ENRICHING: Sapling AI
================================================================================

🔍 Step 1: Searching YC directory...
   Found 1 result(s)
   ✓ Found match: Sapling
✅ Found YC company: https://www.ycombinator.com/companies/sapling
   Logo: https://www.ycombinator.com/companies/small_logos/sapling.png

📄 Step 2: Scraping YC company page...
   Navigating to: https://www.ycombinator.com/companies/sapling
   Page title: Sapling - Y Combinator
   👤 Found 2 founder(s): Michael Shulman, Kiran Panesar
   🔗 Found 2 founder LinkedIn profile(s)
   🌐 Website: https://sapling.ai
   🖼️  Found company logo: https://www.ycombinator.com/companies/small_logos/sapling.png
✅ Successfully scraped company data

💾 Step 3: Storing in Supabase...
   ✅ Successfully updated: yc_link, company_logo, founder_names, founder_linkedin, website, team_size
✅ Successfully enriched and stored: Sapling AI

   ⏳ Waiting 3 seconds before next startup...

[2/3] Processing: Finch
   Batch: S20
...

================================================================================
📊 ENRICHMENT SUMMARY
================================================================================
Total startups processed: 3
✅ Successfully enriched: 3
❌ Failed (errors): 0
🔍 Not found in YC: 0
================================================================================

📝 Note: 128 more startup(s) still need to be processed (use --limit to control batch size)

✅ Enrichment process completed!
```

## Recommended Workflow

### Step 1: Test with Small Batch
Start with a small batch to verify everything works:

```bash
npm run enrich:missing-links -- --limit=5
```

Check Supabase to verify the data looks good.

### Step 2: Process in Batches
Process in batches of 20-30 to avoid long-running processes:

```bash
# First batch
npm run enrich:missing-links -- --limit=30

# After first batch completes, run again for next batch
npm run enrich:missing-links -- --limit=30

# Continue until all are processed
```

### Step 3: Process All Remaining
Once you're confident, process all remaining:

```bash
npm run enrich:missing-links
```

## Handling Failures

### Not Found in YC Directory
If startups aren't found, it could be:
- **Name mismatch**: YC has a slightly different name
- **Not a YC company**: The startup isn't actually in YC
- **Spelling variation**: Try manual search on YC to find the correct name

**Solution**: Manually update the name in Supabase to match YC, then re-run.

### Errors During Scraping
If scraping fails:
- Check your internet connection
- The YC page structure might have changed
- Rate limiting (add longer delays)

**Solution**: Wait and retry. Failed startups are listed in the summary.

## Monitoring Progress

The script automatically:
- ✅ Only processes startups that still need enrichment (missing `yc_link`)
- ⏭️ Skips startups that already have `yc_link`
- 🔄 Can be run multiple times safely

So you can:
1. Run the script
2. Stop it anytime (Ctrl+C)
3. Run it again - it will only process remaining startups

## Tips

1. **Use --limit for testing**: Always test with small batches first
2. **Monitor the output**: Watch for patterns in failures
3. **Check Supabase**: Verify data quality after each batch
4. **Rate limiting**: 3 second delays are built in, should be safe
5. **Browser headless mode**: Runs in background, won't interrupt your work

## Technical Details

- **Script**: [enrich_missing_yc_links.ts](enrich_missing_yc_links.ts)
- **Uses**: The enrichment pipeline from [scrape_yc_companies.ts](scrape_yc_companies.ts)
- **Database**: Queries and updates `startups3` table in Supabase
- **Browser**: Puppeteer in headless mode

## Troubleshooting

### "No startups found without YC links"
All your startups already have `yc_link` populated. Check Supabase manually.

### Script hangs/freezes
- Check your internet connection
- YC might be slow to respond
- Try with `--limit=1` to debug
- Check the console output for errors

### Wrong company matched
The script uses fuzzy matching. If it matches the wrong company:
1. Check the company name in your database
2. Make it more specific (add location, year, etc.)
3. Or manually set the `yc_link` for that company

## After Enrichment

Once enriched, you can:
- ✅ View all data in Supabase dashboard
- ✅ Use the data in your application
- ✅ Run further enrichment (emails, funding, etc.)
- ✅ Export for analysis
- ✅ Build outreach campaigns
