-- Create Forensic Metrics Table in Admin Audit Schema
-- This table tracks forensic code metrics for candidate submissions

CREATE TABLE IF NOT EXISTS admin_audit.forensic_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  event TEXT NOT NULL,
  added_lines INTEGER DEFAULT 0,
  deleted_lines INTEGER DEFAULT 0,
  commit_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  -- optional: link to specific commit hash if we had it
  -- commit_hash TEXT
  
  -- We don't enforce foreign keys strictness here to allow decoupled logging
);

-- Index for querying by candidate
CREATE INDEX IF NOT EXISTS idx_forensic_metrics_candidate_id ON admin_audit.forensic_metrics(candidate_id);

-- RPC Function to log metrics
-- This function is SECURITY DEFINER, meaning it runs with the privileges of the creator
-- allowing it to write to the locked admin_audit schema.
CREATE OR REPLACE FUNCTION log_forensic_metrics(
  p_candidate_id TEXT,
  p_event TEXT,
  p_added_lines INTEGER,
  p_deleted_lines INTEGER,
  p_commit_message TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_audit.forensic_metrics (
    candidate_id,
    event,
    added_lines,
    deleted_lines,
    commit_message
  ) VALUES (
    p_candidate_id,
    p_event,
    p_added_lines,
    p_deleted_lines,
    p_commit_message
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated/anon so the GitHub Action can call it
-- (Relies on the ease of calling via Supabase Client or REST)
GRANT EXECUTE ON FUNCTION log_forensic_metrics TO anon, authenticated, service_role;
