-- Migration: Add is_active field to jobs table
-- This allows soft-deletion of jobs that are no longer posted

-- Add the is_active column with a default value of true
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update any existing rows to set is_active to true
UPDATE jobs
SET is_active = true
WHERE is_active IS NULL;

-- Add an index on is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);

-- Add a composite index for company queries with active status
CREATE INDEX IF NOT EXISTS idx_jobs_company_active ON jobs(company_name, is_active);

-- Add an index on job_url for upsert operations (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_jobs_job_url ON jobs(job_url);

-- Optional: Add updated_at timestamp to track when jobs were last modified
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create a trigger to automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
