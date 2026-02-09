-- Dashboard Metrics Cache Table
-- Stores pre-computed dashboard metrics with TTL for performance optimization

CREATE TABLE IF NOT EXISTS dashboard_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL UNIQUE,
  metric_value JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookup by key
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_key ON dashboard_metrics_cache(metric_key);

-- Index for cleaning up expired entries
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_expires ON dashboard_metrics_cache(expires_at);

-- Performance indexes for assessment_scores queries
CREATE INDEX IF NOT EXISTS idx_assessment_scores_total_score
  ON admin_audit.assessment_scores(total_score DESC)
  WHERE total_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_scores_candidate
  ON admin_audit.assessment_scores(candidate_id);

CREATE INDEX IF NOT EXISTS idx_assessment_scores_created
  ON admin_audit.assessment_scores(created_at DESC);

-- Performance indexes for session_commits
CREATE INDEX IF NOT EXISTS idx_session_commits_session_candidate
  ON session_commits(session_id, candidate_github_username);

CREATE INDEX IF NOT EXISTS idx_session_commits_created
  ON session_commits(created_at DESC);

-- Performance indexes for github_code_analyses
CREATE INDEX IF NOT EXISTS idx_github_analyses_candidate_score
  ON github_code_analyses(candidate_id, overall_score DESC)
  WHERE overall_score IS NOT NULL;

-- Performance indexes for prompt_logs
CREATE INDEX IF NOT EXISTS idx_prompt_logs_candidate
  ON admin_audit.prompt_logs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_prompt_logs_created
  ON admin_audit.prompt_logs(created_at DESC);

-- Performance index for interview_sessions
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate
  ON interview_sessions(candidate_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_status
  ON interview_sessions(status);

-- Function to clean up expired cache entries (can be called via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_dashboard_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM dashboard_metrics_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_metrics_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_metrics_cache TO service_role;

COMMENT ON TABLE dashboard_metrics_cache IS 'Caches pre-computed dashboard metrics for performance (5-minute TTL)';
COMMENT ON COLUMN dashboard_metrics_cache.metric_key IS 'Unique identifier for the cached metric (e.g., "overview_metrics", "candidate_distribution")';
COMMENT ON COLUMN dashboard_metrics_cache.metric_value IS 'JSON payload containing the computed metric data';
COMMENT ON COLUMN dashboard_metrics_cache.expires_at IS 'Timestamp when this cache entry expires and should be recomputed';
