-- Test Candidates Table (for testing only)
-- Run this in your Supabase SQL Editor to create the candidates lookup table

CREATE TABLE IF NOT EXISTS test_candidates (
    id TEXT PRIMARY KEY DEFAULT 'cand_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    github_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_candidates_email ON test_candidates(email);

-- Updated_at trigger (reuse existing function if it exists)
CREATE TRIGGER update_test_candidates_updated_at
    BEFORE UPDATE ON test_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policy (allow all for testing)
ALTER TABLE test_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for service role"
    ON test_candidates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE test_candidates IS 'Test candidates table for Minerva interview system - lookup by email';
COMMENT ON COLUMN test_candidates.id IS 'Auto-generated candidate ID (format: cand_timestamp_random)';
COMMENT ON COLUMN test_candidates.email IS 'Unique email address for candidate lookup';
COMMENT ON COLUMN test_candidates.name IS 'Candidate name used in Vapi agent introduction';

