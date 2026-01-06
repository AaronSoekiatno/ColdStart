# Update Mode for Work at a Startup Scraper

This document explains how to use the update mode feature to keep your job postings database fresh and current.

## Overview

The scraper now supports **Update Mode**, which allows you to:
- ✅ **Update existing job postings** with the latest information
- ➕ **Add new job postings** that appear on the website
- ❌ **Mark old job postings as inactive** when they're no longer posted

## Database Changes

Before using update mode, you need to add the `is_active` field to your database:

```bash
# Run this SQL migration (in Supabase SQL editor or psql)
psql -h your-db-host -U your-user -d your-db -f add_is_active_field.sql
```

Or run the SQL directly in Supabase:
```sql
-- See add_is_active_field.sql for the full migration
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_job_url ON jobs(job_url);
```

## Usage

### Basic Update Mode

Refresh job postings for companies that don't have any jobs yet:
```bash
python scrape_workatastartup_directory.py --update-mode
```

### Full Refresh

Update **all** companies (even those that already have jobs):
```bash
python scrape_workatastartup_directory.py --update-mode --no-skip-existing
```

### Dry Run (Preview Changes)

See what would be updated without actually modifying the database:
```bash
python scrape_workatastartup_directory.py --update-mode --dry-run --test
```

### Test with One Company

Test the update mode on a single company:
```bash
python scrape_workatastartup_directory.py --update-mode --test
```

### Batch Processing

Process companies in larger batches for faster updates:
```bash
python scrape_workatastartup_directory.py --update-mode --no-skip-existing --batch-size 10 --workers 16
```

## How It Works

### Normal Mode (Default)
- **New jobs**: Inserted into database
- **Existing jobs** (same job_url): Skipped
- **Missing jobs**: Remain in database forever

### Update Mode (`--update-mode`)
- **New jobs**: Inserted into database with `is_active=true`
- **Existing jobs**: Updated with latest data, `is_active=true`
- **Missing jobs**: Marked with `is_active=false` (soft delete)

### Dry Run Mode (`--dry-run`)
- Shows exactly what would happen
- No database changes made
- Useful for testing before running a full update

## Command Line Options

| Flag | Description |
|------|-------------|
| `--update-mode` | Enable update mode (update existing jobs, mark missing as inactive) |
| `--dry-run` | Show what would change without modifying database |
| `--no-skip-existing` | Process all companies even if they already have jobs |
| `--test` | Test mode: process only 1 company |
| `--limit N` | Process only N companies |
| `--batch-size N` | Process N companies per batch (default: 5) |
| `--workers N` | Use N parallel workers (default: 8) |
| `--skip-directory` | Get companies from database instead of scraping directory |

## Example Workflows

### Daily/Weekly Refresh
Update all jobs to keep your database current:
```bash
python scrape_workatastartup_directory.py --update-mode --no-skip-existing
```

### Test Before Running
Always test on one company first:
```bash
# 1. Dry run to preview changes
python scrape_workatastartup_directory.py --update-mode --dry-run --test

# 2. Run on one company to verify
python scrape_workatastartup_directory.py --update-mode --test

# 3. Full run if everything looks good
python scrape_workatastartup_directory.py --update-mode --no-skip-existing
```

### Query Active Jobs Only
After running update mode, you can filter your queries to show only active jobs:

```sql
-- Get all active jobs
SELECT * FROM jobs WHERE is_active = true;

-- Get active jobs for a specific company
SELECT * FROM jobs WHERE company_name = 'Example Inc' AND is_active = true;

-- Get inactive jobs (removed postings)
SELECT * FROM jobs WHERE is_active = false ORDER BY updated_at DESC;
```

## Scheduled Updates

You can set up a cron job or scheduled task to keep your database fresh:

### Linux/Mac (crontab)
```bash
# Run every day at 3 AM
0 3 * * * cd /path/to/ColdStart/yc_companies && python scrape_workatastartup_directory.py --update-mode --no-skip-existing >> /var/log/yc_scraper.log 2>&1
```

### Windows (Task Scheduler)
Create a scheduled task that runs:
```batch
python C:\path\to\ColdStart\yc_companies\scrape_workatastartup_directory.py --update-mode --no-skip-existing
```

## Troubleshooting

### Issue: "Column is_active does not exist"
**Solution**: Run the database migration first (see Database Changes section above)

### Issue: Jobs not being marked as inactive
**Possible causes**:
1. Not using `--update-mode` flag
2. Job URLs changed (old URL doesn't match new URL)
3. Company name changed (jobs are company-specific)

### Issue: All jobs show as new inserts
**Possible cause**: Job URL format changed. The system uses `job_url` to identify duplicate jobs.

## Notes

- **Job identification**: Jobs are identified by their `job_url` field
- **Soft delete**: Inactive jobs remain in database with `is_active=false`
- **Updated timestamp**: The `updated_at` field tracks when a job was last modified
- **Company-specific**: Inactive job detection is done per company
- **Safe operation**: Dry run mode lets you preview changes before committing

## Support

For issues or questions, check the main script help:
```bash
python scrape_workatastartup_directory.py --help
```
