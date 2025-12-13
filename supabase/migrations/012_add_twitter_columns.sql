-- Add Twitter/X columns to startups table
ALTER TABLE startups ADD COLUMN IF NOT EXISTS company_twitter_url TEXT;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS founder_twitter_urls TEXT;

-- Create index on company_twitter_url for faster queries
CREATE INDEX IF NOT EXISTS idx_startups_company_twitter_url ON startups(company_twitter_url) WHERE company_twitter_url IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN startups.company_twitter_url IS 'Full Twitter/X URL for the company (e.g., https://twitter.com/company or https://x.com/company)';
COMMENT ON COLUMN startups.founder_twitter_urls IS 'Comma-separated Twitter/X URLs for founders (similar to founder_linkedin pattern)';

