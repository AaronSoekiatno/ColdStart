-- Add YC link column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS yc_link TEXT;

-- Create index on yc_link for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_yc_link ON jobs(yc_link);

-- Add comment explaining the column
COMMENT ON COLUMN jobs.yc_link IS 'Y Combinator company page URL (e.g., https://www.ycombinator.com/companies/company-name)';

