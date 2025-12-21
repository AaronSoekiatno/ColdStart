-- Migration: Backfill startup_id in jobs table by matching company_name to startups3.name
-- This connects existing jobs to the startups3 table

-- Step 1: Update jobs with exact company_name matches
UPDATE jobs
SET startup_id = (
    SELECT id 
    FROM startups3 
    WHERE startups3.name = jobs.company_name 
    LIMIT 1
)
WHERE jobs.startup_id IS NULL
  AND EXISTS (
      SELECT 1 
      FROM startups3 
      WHERE startups3.name = jobs.company_name
  );

-- Step 2: Update jobs with case-insensitive matches (for companies that didn't match exactly)
-- Only update jobs that still don't have a startup_id
UPDATE jobs
SET startup_id = (
    SELECT id 
    FROM startups3 
    WHERE LOWER(startups3.name) = LOWER(jobs.company_name)
    LIMIT 1
)
WHERE jobs.startup_id IS NULL
  AND EXISTS (
      SELECT 1 
      FROM startups3 
      WHERE LOWER(startups3.name) = LOWER(jobs.company_name)
  );

-- Log the results
DO $$
DECLARE
    total_jobs integer;
    jobs_with_startup_id integer;
    jobs_without_startup_id integer;
    matched_count integer;
BEGIN
    -- Count total jobs
    SELECT COUNT(*) INTO total_jobs FROM jobs;
    
    -- Count jobs with startup_id
    SELECT COUNT(*) INTO jobs_with_startup_id 
    FROM jobs 
    WHERE startup_id IS NOT NULL;
    
    -- Count jobs without startup_id
    SELECT COUNT(*) INTO jobs_without_startup_id 
    FROM jobs 
    WHERE startup_id IS NULL;
    
    -- Count how many were matched in this migration
    SELECT COUNT(*) INTO matched_count
    FROM jobs
    WHERE startup_id IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM startups3 
          WHERE startups3.id = jobs.startup_id
      );
    
    RAISE NOTICE 'Backfill Results:';
    RAISE NOTICE '  Total jobs: %', total_jobs;
    RAISE NOTICE '  Jobs with startup_id: %', jobs_with_startup_id;
    RAISE NOTICE '  Jobs without startup_id: %', jobs_without_startup_id;
    RAISE NOTICE '  Matched to startups3: %', matched_count;
END $$;



