# YC Company Enrichment Guide

## Overview

This guide explains how to enrich company data when you only have company names. The enrichment pipeline automatically:

1. 🔍 **Searches YC directory** to find the company's YC page URL
2. 🖼️ **Extracts company logo** from YC search results or company page
3. 📄 **Scrapes full company data** from the YC company page
4. 💾 **Stores everything in Supabase** (founders, LinkedIn, Twitter, website, team size, etc.)

## Quick Start

### Enrich companies from names only

```bash
npm run enrich:names -- --names="Company1,Company2,Company3"
```

### Examples

```bash
# Single company
npm run enrich:names -- --names="OpenAI"

# Multiple companies (comma-separated)
npm run enrich:names -- --names="OpenAI,Stripe,Airbnb"

# Many companies
npm run enrich:names -- --names="Anthropic,Databricks,Instacart,DoorDash,Cruise"
```

## What Gets Enriched

From just a company name, the scraper finds and extracts:

### Company Information
- ✅ Company logo (YC company page logo)
- ✅ YC URL and slug
- ✅ Company website
- ✅ Company description (one-line summary)
- ✅ Company Twitter/X URL
- ✅ Location
- ✅ Team size
- ✅ Batch (YC batch)
- ✅ Tags (technologies/skills)
- ✅ Launch date
- ✅ Job postings

### Founder Information
- ✅ Founder names (first & last)
- ✅ LinkedIn profiles
- ✅ Twitter/X profiles
- ✅ Founder descriptions/bios
- ✅ Founder profile pictures

### Funding Information
- ✅ Funding amount
- ✅ Round type (Pre-seed, Seed, Series A, etc.)
- ✅ Funding date

## How It Works

### Step 1: Search YC Directory
The scraper navigates to `https://www.ycombinator.com/companies?query={company_name}` and:
- Extracts search results with company names and YC URLs
- Finds the best match (exact match or fuzzy match)
- Captures the company logo if available in search results

### Step 2: Scrape YC Company Page
Once the YC URL is found, the scraper visits the company page and extracts:
- Company logo (multiple strategies: logo selectors, images near h1, etc.)
- All founder information (names, LinkedIn, Twitter, bios, profile pictures)
- Company details (website, description, location, team size)
- Job postings
- Funding information
- Social media links

### Step 3: Store in Supabase
All extracted data is stored in your `startups3` table with fields:
- `yc_link` - YC company URL
- `company_logo` - Logo URL
- `founder_names` - Comma-separated founder names
- `founder_linkedin` - Comma-separated LinkedIn URLs
- `founder_twitter_urls` - Comma-separated Twitter URLs
- `founder_backgrounds` - Founder bios/descriptions
- `founders_pfp` - Array of founder profile picture URLs
- `website` - Company website
- `company_twitter_url` - Company Twitter/X URL
- `team_size` - Number of employees
- `yc_description` - Company description from YC

## Advanced Usage

### Use in Your Code

You can import and use the enrichment functions in your own scripts:

```typescript
import {
  enrichCompanyFromName,
  findYCCompanyUrl,
  scrapeYCCompanyPage
} from './yc_companies/scrape_yc_companies';
import puppeteer from 'puppeteer';

// Example: Enrich a single company
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Option 1: Full enrichment (search + scrape + store)
await enrichCompanyFromName(page, 'OpenAI');

// Option 2: Just find the YC URL
const searchResult = await findYCCompanyUrl(page, 'Stripe');
console.log(searchResult.ycUrl); // https://www.ycombinator.com/companies/stripe
console.log(searchResult.logo);  // Logo URL if found

// Option 3: Scrape an existing YC URL
const pageData = await scrapeYCCompanyPage(page, 'https://www.ycombinator.com/companies/airbnb');
console.log(pageData.founders);
console.log(pageData.companyLogo);

await browser.close();
```

## Troubleshooting

### Company Not Found
If a company isn't found in the YC directory:
- Make sure the company name is spelled correctly
- Try variations (e.g., "OpenAI" vs "Open AI")
- Check if the company is actually in YC (not all companies are)

### Logo Not Found
The scraper tries multiple strategies to find logos:
1. Search results logo
2. Images with "logo" in src or alt
3. Images in header
4. Images near the h1 company name

If no logo is found, the `company_logo` field will be empty/undefined.

### Rate Limiting
The scraper includes automatic delays between companies (3 seconds) to avoid rate limiting. If you're enriching many companies, consider:
- Running smaller batches
- Increasing delays in the code
- Running during off-peak hours

## Database Schema

Make sure your `startups3` table has these columns:

```sql
-- Required for enrichment to work
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS company_logo TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS yc_link TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS founder_names TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS founder_linkedin TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS founder_twitter_urls TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS company_twitter_url TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS team_size TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS founder_backgrounds TEXT;
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS founders_pfp TEXT[];
ALTER TABLE startups3 ADD COLUMN IF NOT EXISTS yc_description TEXT;
```

## Tips

1. **Batch Processing**: Process companies in batches of 10-20 to avoid long-running processes
2. **Verify Names**: Double-check company names before running to avoid wasting API calls
3. **Monitor Results**: Watch the console output to see what's being found/missed
4. **Logo Quality**: YC logos are typically high quality and consistent in size
5. **Retry Failed**: The script shows which companies failed - you can retry them separately

## Example Output

```
🚀 Starting Name-Based Company Enrichment...

📋 Companies to enrich: 3
   1. OpenAI
   2. Stripe
   3. Airbnb

✓ Connected to Supabase
🌐 Launching browser...
✓ Browser ready

[1/3] Processing: OpenAI

================================================================================
📦 ENRICHING: OpenAI
================================================================================

🔍 Step 1: Searching YC directory...
   Found 1 result(s)
   ✓ Found match: OpenAI
✅ Found YC company: https://www.ycombinator.com/companies/openai
   Logo: https://www.ycombinator.com/companies/small_logos/openai.png

📄 Step 2: Scraping YC company page...
   Navigating to: https://www.ycombinator.com/companies/openai
   Page title: OpenAI - Y Combinator
   👤 Found 2 founder(s): Sam Altman, Greg Brockman
   🔗 Found 2 founder LinkedIn profile(s)
   🐦 Company Twitter: https://x.com/openai
   🌐 Website: https://openai.com
   🖼️  Found company logo: https://www.ycombinator.com/companies/small_logos/openai.png
✅ Successfully scraped company data

💾 Step 3: Storing in Supabase...
   ✅ Successfully updated: founder_names, founder_linkedin, company_twitter_url, website, company_logo
✅ Successfully enriched and stored: OpenAI

⏳ Waiting 3 seconds before next company...

[... continues for remaining companies ...]

================================================================================
📊 ENRICHMENT SUMMARY
================================================================================
Total companies: 3
✅ Successfully enriched: 3
❌ Failed: 0
🔍 Not found in YC: 0
================================================================================

✅ Name-based enrichment completed successfully!
```

## Next Steps

After enrichment, you can:
1. View enriched data in your Supabase dashboard
2. Use the data in your app/frontend
3. Further enrich with additional APIs (Clearbit, Apollo, etc.)
4. Export to CSV for analysis
5. Build email campaigns using founder LinkedIn profiles
