# Founder Profile Picture Rescraping Guide

## Overview

This solution permanently stores founder profile pictures in Supabase Storage instead of using temporary signed URLs that expire after 1 hour.

## Setup

### 1. Create Supabase Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **New Bucket**
4. Name: `founder-pfps`
5. Make it **Public** (so images can be accessed via public URLs)
6. Click **Create**

### 2. Set Permissions (Optional but Recommended)

If you want to restrict access, you can set up RLS policies, but for public images, making the bucket public is sufficient.

## Usage

### Step 1: Test with One Company First (Recommended)

Before running the full batch, test with a single company to make sure everything works:

```bash
cd yc_companies
npx tsx test-single-pfp.ts
```

**What it does:**
- Picks one company from your database
- Scrapes the YC page to get **fresh** (non-expired) URLs
- Downloads and stores images immediately while URLs are valid
- Updates the database with permanent URLs

**Why test first:**
- Verifies your Supabase Storage bucket is set up correctly
- Confirms the scraping and storage process works
- Catches any configuration issues before processing hundreds of companies

### Option 2: Scrape Founder Profile Pictures Only (Fastest - Recommended)

This script focuses ONLY on founder profile pictures and processes 5 companies in parallel:

```bash
cd yc_companies
npx tsx scrape-pfps-only.ts
```

**What it does:**
- Gets fresh URLs by scraping YC pages
- Processes 5 companies simultaneously (parallel)
- Downloads and stores images immediately while URLs are valid
- Updates database with permanent URLs
- Much faster than full scraping (only does profile pictures)

**Efficiency:**
- 5 companies processed in parallel
- 3 images per company processed in parallel
- Estimated time: ~30-60 seconds per 100 companies

### Option 3: Rescrape All Existing Images

Run the batch rescraping script to process all existing companies:

```bash
cd yc_companies
npx tsx rescrape-pfps.ts
```

**What it does:**
- Fetches all companies with founder profile pictures
- Processes them in batches of 10 companies (parallel)
- Downloads and stores images in Supabase Storage
- Updates database with permanent URLs
- Skips companies that already have permanent URLs

**Efficiency:**
- Processes 10 companies in parallel
- Processes 5 images per company in parallel
- Automatically skips already-permanent URLs
- Includes retry logic for failed downloads

### Option 2: New Scrapes Will Auto-Store

The main scraping script (`scrape_yc_companies.ts`) has been updated to automatically download and store images when scraping new companies. No additional action needed!

## Performance

**Batch Rescraping:**
- ~10 companies processed simultaneously
- ~5 images per company processed simultaneously
- Estimated time: ~1-2 minutes per 100 companies (depending on image sizes and network speed)

**New Scrapes:**
- Images are downloaded and stored during the scraping process
- No additional time needed - happens automatically

## Troubleshooting

### "Bucket not found" Error

Make sure you've created the `founder-pfps` bucket in Supabase Storage and made it public.

### Images Not Downloading

- Check if the original URLs are still valid (not expired)
- Check network connectivity
- Check Supabase Storage quota/limits

### Slow Performance

- Reduce `BATCH_SIZE` in `rescrape-pfps.ts` (default: 10)
- Reduce `IMAGE_CONCURRENCY` in `rescrape-pfps.ts` (default: 5)
- Check your Supabase Storage upload limits

## File Structure

- `utils/image-storage.ts` - Core image download/upload functions
- `rescrape-pfps.ts` - Batch rescraping script
- `scrape_yc_companies.ts` - Updated main scraping script (auto-stores images)

## Benefits

✅ **No Expiration** - Images stored permanently  
✅ **Fast** - Parallel processing for efficiency  
✅ **Automatic** - New scrapes auto-store images  
✅ **Resumable** - Skips already-processed images  
✅ **Reliable** - Retry logic for failed downloads  

