-- Migration 050: Refactor candidate_id to UUID in assessment_scores
-- Changes candidate_id from TEXT to UUID for proper foreign key relationship

DO $$ 
BEGIN 
    -- Check if column is already UUID type (migration already applied)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'admin_audit' 
        AND table_name = 'assessment_scores' 
        AND column_name = 'candidate_id' 
        AND data_type = 'uuid'
    ) THEN
        RAISE NOTICE 'candidate_id is already UUID type, skipping migration';
        RETURN;
    END IF;

    -- Step 1: Alter the column type from TEXT to UUID
    -- This will fail if there are non-UUID TEXT values, which is expected behavior
    ALTER TABLE admin_audit.assessment_scores 
    ALTER COLUMN candidate_id TYPE UUID USING candidate_id::uuid;

    -- Step 2: Add foreign key constraint to candidates table
    -- First check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_assessment_scores_candidate_id'
    ) THEN
        ALTER TABLE admin_audit.assessment_scores
        ADD CONSTRAINT fk_assessment_scores_candidate_id
        FOREIGN KEY (candidate_id) REFERENCES public.candidates(id)
        ON DELETE CASCADE;
    END IF;

    -- Step 3: Add index on candidate_id for better query performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'admin_audit' 
        AND tablename = 'assessment_scores' 
        AND indexname = 'idx_assessment_scores_candidate_id'
    ) THEN
        CREATE INDEX idx_assessment_scores_candidate_id 
        ON admin_audit.assessment_scores(candidate_id);
    END IF;

    RAISE NOTICE 'Successfully migrated candidate_id to UUID type';

END $$;

-- Add comment to document the change
COMMENT ON COLUMN admin_audit.assessment_scores.candidate_id IS 'Foreign key reference to public.candidates(id). UUID type for data integrity.';
