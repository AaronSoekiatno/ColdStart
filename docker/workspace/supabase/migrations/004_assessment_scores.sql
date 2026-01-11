-- Assessment Scores and Artifacts Storage
-- This migration creates infrastructure to store assessment scoring results

-- ============================================================================
-- ASSESSMENT SCORES TABLE
-- ============================================================================
-- Stores detailed assessment scoring results for each candidate

CREATE TABLE IF NOT EXISTS admin_audit.assessment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  
  -- Individual score components
  build_score INTEGER DEFAULT 0,
  completion_score INTEGER DEFAULT 0,
  enhanced_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  
  -- Score artifact (full JSON summary)
  artifact_data JSONB,
  
  -- Metadata
  workflow_run_id TEXT,  -- GitHub Actions run ID for traceability
  scored_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_assessment_scores_candidate_id 
  ON admin_audit.assessment_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_scores_scored_at 
  ON admin_audit.assessment_scores(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_scores_total_score 
  ON admin_audit.assessment_scores(total_score DESC);

-- ============================================================================
-- RPC FUNCTION: Log Assessment Score
-- ============================================================================
-- This function stores assessment scores and the complete artifact JSON
-- Called by the GitHub Actions workflow after scoring is complete

CREATE OR REPLACE FUNCTION log_assessment_score(
  p_candidate_id TEXT,
  p_build_score INTEGER,
  p_completion_score INTEGER,
  p_enhanced_score INTEGER,
  p_total_score INTEGER,
  p_artifact_data JSONB DEFAULT NULL,
  p_workflow_run_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_audit.assessment_scores (
    candidate_id,
    build_score,
    completion_score,
    enhanced_score,
    total_score,
    artifact_data,
    workflow_run_id
  ) VALUES (
    p_candidate_id,
    p_build_score,
    p_completion_score,
    p_enhanced_score,
    p_total_score,
    p_artifact_data,
    p_workflow_run_id
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_assessment_score TO anon, authenticated, service_role;

-- ============================================================================
-- RPC FUNCTION: Get Latest Assessment Score
-- ============================================================================
-- Retrieves the most recent assessment score for a candidate

CREATE OR REPLACE FUNCTION get_latest_assessment_score(p_candidate_id TEXT)
RETURNS TABLE (
  id UUID,
  candidate_id TEXT,
  build_score INTEGER,
  completion_score INTEGER,
  enhanced_score INTEGER,
  total_score INTEGER,
  artifact_data JSONB,
  workflow_run_id TEXT,
  scored_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.candidate_id,
    s.build_score,
    s.completion_score,
    s.enhanced_score,
    s.total_score,
    s.artifact_data,
    s.workflow_run_id,
    s.scored_at
  FROM admin_audit.assessment_scores s
  WHERE s.candidate_id = p_candidate_id
  ORDER BY s.scored_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_latest_assessment_score TO anon, authenticated, service_role;

-- ============================================================================
-- RPC FUNCTION: Get Assessment Score History
-- ============================================================================
-- Retrieves all assessment scores for a candidate (useful for tracking progress)

CREATE OR REPLACE FUNCTION get_assessment_score_history(p_candidate_id TEXT)
RETURNS TABLE (
  id UUID,
  candidate_id TEXT,
  build_score INTEGER,
  completion_score INTEGER,
  enhanced_score INTEGER,
  total_score INTEGER,
  workflow_run_id TEXT,
  scored_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.candidate_id,
    s.build_score,
    s.completion_score,
    s.enhanced_score,
    s.total_score,
    s.workflow_run_id,
    s.scored_at
  FROM admin_audit.assessment_scores s
  WHERE s.candidate_id = p_candidate_id
  ORDER BY s.scored_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_assessment_score_history TO anon, authenticated, service_role;
