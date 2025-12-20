-- Migration: Update jobs.startup_id foreign key to reference startups3 instead of startups
-- This allows jobs to properly link to the startups3 table used by the scraper

-- Step 1: Drop the existing foreign key constraint
-- Note: The constraint name might be auto-generated, so we try both common patterns
ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_startup_id_fkey;

-- Also try to drop any constraint that might have been auto-generated
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find any foreign key constraint on startup_id column
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass
      AND contype = 'f'
      AND EXISTS (
          SELECT 1 FROM pg_attribute 
          WHERE attrelid = conrelid 
          AND attname = 'startup_id'
          AND attnum = ANY(conkey)
      );
    
    -- Drop the constraint if found and not already dropped
    IF constraint_name IS NOT NULL AND constraint_name != 'jobs_startup_id_fkey' THEN
        EXECUTE format('ALTER TABLE jobs DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped additional constraint: %', constraint_name;
    END IF;
END $$;

-- Step 2: Clean up invalid startup_id values that don't exist in startups3
-- Set startup_id to NULL for any jobs where the startup_id doesn't exist in startups3
UPDATE jobs
SET startup_id = NULL
WHERE startup_id IS NOT NULL
  AND startup_id NOT IN (SELECT id FROM startups3);

-- Log how many rows were cleaned up
DO $$
DECLARE
    cleaned_count integer;
BEGIN
    SELECT COUNT(*) INTO cleaned_count
    FROM jobs
    WHERE startup_id IS NOT NULL
      AND startup_id NOT IN (SELECT id FROM startups3);
    
    IF cleaned_count > 0 THEN
        RAISE NOTICE 'Cleaned up % invalid startup_id references', cleaned_count;
    ELSE
        RAISE NOTICE 'No invalid startup_id references found';
    END IF;
END $$;

-- Step 3: Add new foreign key constraint referencing startups3 table
ALTER TABLE jobs
ADD CONSTRAINT jobs_startup_id_fkey
FOREIGN KEY (startup_id)
REFERENCES startups3(id)
ON DELETE SET NULL;

-- Update the comment to reflect the change
COMMENT ON COLUMN jobs.startup_id IS 'Foreign key to startups3 table if company is found in our database';

