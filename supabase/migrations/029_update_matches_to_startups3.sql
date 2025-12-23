-- Migration: Update matches table to reference startups3 instead of startups
-- This changes matches.startup_id from UUID to TEXT to match startups3.id type
-- 
-- Issue: matches.startup_id is UUID referencing startups(id), but we're now using
-- startups3.id which is TEXT. This migration fixes the type mismatch and foreign key.

-- Step 1: Drop ALL existing foreign key constraints on startup_id
-- First, find and drop any foreign key constraints pointing to startups table
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name dynamically
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'matches'::regclass
      AND contype = 'f'
      AND confrelid = 'startups'::regclass;
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE matches DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
    
    -- Also try dropping common constraint names
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_startup_id_fkey;
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_startup_id_startups_id_fk;
EXCEPTION WHEN OTHERS THEN
    -- If constraint doesn't exist, continue
    NULL;
END $$;

-- Step 2: Change matches.startup_id from UUID to TEXT
-- Using USING clause to cast existing UUID values to TEXT strings
ALTER TABLE matches 
ALTER COLUMN startup_id TYPE TEXT USING startup_id::TEXT;

-- Step 3: Add new foreign key constraint pointing to startups3
ALTER TABLE matches 
ADD CONSTRAINT matches_startup_id_fkey 
FOREIGN KEY (startup_id) 
REFERENCES startups3(id) 
ON DELETE CASCADE;

-- Add comment explaining the change
COMMENT ON COLUMN matches.startup_id IS 'References startups3.id (TEXT) instead of startups.id (UUID)';

