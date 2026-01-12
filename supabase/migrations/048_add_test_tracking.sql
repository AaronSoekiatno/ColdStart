-- Migration: Add test tracking columns to existing admin_audit.assessment_scores
-- Adapts existing table for container test runs

DO $$ 
BEGIN 
    -- 1. Ensure admin_audit schema exists (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'admin_audit') THEN
        CREATE SCHEMA admin_audit;
    END IF;

    -- 2. Add session_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'session_id') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN session_id TEXT;
        COMMENT ON COLUMN admin_audit.assessment_scores.session_id IS 'Logical reference to the interview session ID';
    END IF;

    -- 3. Add test_results if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'test_results') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN test_results JSONB;
        COMMENT ON COLUMN admin_audit.assessment_scores.test_results IS 'Complete JSON output from the Vitest runner';
    END IF;

    -- 4. Add test_type if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'test_type') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN test_type TEXT;
    END IF;

    -- 5. Add max_score if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'max_score') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN max_score INTEGER;
    END IF;

    -- 6. Add index for session_id if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'admin_audit' AND tablename = 'assessment_scores' AND indexname = 'idx_assessment_scores_session_id') THEN
        CREATE INDEX idx_assessment_scores_session_id ON admin_audit.assessment_scores(session_id);
    END IF;

END $$;

-- Grant permissions (safe to re-run)
GRANT USAGE ON SCHEMA admin_audit TO authenticated, service_role;
GRANT ALL ON TABLE admin_audit.assessment_scores TO service_role;
GRANT SELECT, INSERT ON TABLE admin_audit.assessment_scores TO authenticated;
