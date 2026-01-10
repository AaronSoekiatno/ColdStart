-- Multi-Tenant Schema Architecture
-- Schema-per-Candidate Model for scaling to 4,000+ users

-- ============================================================================
-- PUBLIC SCHEMA (Read-Only Shared Data)
-- ============================================================================
-- Contains shared reference data that all candidates can read but not modify

-- Viral Benchmarks Table
-- Industry benchmarks for viral scores and engagement rates
CREATE TABLE IF NOT EXISTS public.viral_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  benchmark_viral_score DECIMAL(5,2) NOT NULL,
  benchmark_engagement_rate DECIMAL(5,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Global Templates Table
-- Shared templates that candidates can reference
CREATE TABLE IF NOT EXISTS public.global_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Grant read-only access to public schema for all users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

-- ============================================================================
-- ADMIN_AUDIT SCHEMA (System Tracking)
-- ============================================================================
-- Tracks candidate performance metrics: commit frequency, query efficiency, etc.

CREATE SCHEMA IF NOT EXISTS admin_audit;

-- Candidate Performance Tracking
CREATE TABLE IF NOT EXISTS admin_audit.candidate_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  commit_frequency INTEGER DEFAULT 0,
  query_efficiency_score DECIMAL(5,2),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_metrics_candidate_id ON admin_audit.candidate_metrics(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_metrics_last_activity ON admin_audit.candidate_metrics(last_activity_at DESC);

-- Lock down admin_audit schema - only system can write
REVOKE ALL ON SCHEMA admin_audit FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA admin_audit FROM authenticated;

-- ============================================================================
-- FUNCTION: Create Candidate Schema
-- ============================================================================
-- This function creates a new schema for a candidate and sets up their tables
-- Called automatically when a new candidate starts

CREATE OR REPLACE FUNCTION create_candidate_schema(candidate_id TEXT)
RETURNS TEXT AS $$
DECLARE
  schema_name TEXT;
BEGIN
  -- Generate schema name: sandbox_{candidate_id}
  schema_name := 'sandbox_' || lower(replace(candidate_id, '-', '_'));
  
  -- Create the schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- Create video_scripts table in candidate's schema
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.video_scripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      script_content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      creator_id TEXT
    )', schema_name);
  
  -- Create performance_logs table in candidate's schema
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.performance_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      script_id UUID REFERENCES %I.video_scripts(id) ON DELETE CASCADE,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      engagement_rate DECIMAL(5,2),
      viral_score DECIMAL(5,2) CHECK (viral_score >= 0 AND viral_score <= 100),
      logged_at TIMESTAMP DEFAULT NOW()
    )', schema_name, schema_name);
  
  -- Create indexes
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_video_scripts_created_at ON %I.video_scripts(created_at)', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_performance_logs_script_id ON %I.performance_logs(script_id)', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_performance_logs_viral_score ON %I.performance_logs(viral_score DESC)', schema_name);
  
  -- Grant full access to candidate's schema
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO authenticated', schema_name);
  
  -- Initialize candidate metrics in admin_audit
  INSERT INTO admin_audit.candidate_metrics (candidate_id, schema_name, last_activity_at)
  VALUES (candidate_id, schema_name, NOW())
  ON CONFLICT (candidate_id) DO UPDATE SET last_activity_at = NOW();
  
  RETURN schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get Candidate Schema Name
-- ============================================================================
-- Helper function to get schema name from candidate_id

CREATE OR REPLACE FUNCTION get_candidate_schema(candidate_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'sandbox_' || lower(replace(candidate_id, '-', '_'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: Set Search Path for Candidate
-- ============================================================================
-- Sets the search_path to jail a candidate to their schema + public
-- This function should be called at the start of each session/connection
-- to ensure queries are "jailed" to the candidate's schema

CREATE OR REPLACE FUNCTION set_candidate_search_path(candidate_id TEXT)
RETURNS VOID AS $$
DECLARE
  schema_name TEXT;
BEGIN
  schema_name := get_candidate_schema(candidate_id);
  -- Set search_path to candidate's schema first, then public
  -- This means unqualified table names resolve to candidate's schema first
  -- But they can still access public schema with public.table_name
  EXECUTE format('SET search_path TO %I, public', schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Execute Query with Candidate Context
-- ============================================================================
-- Executes a SQL query in the context of a candidate's schema
-- This is a helper for applications that need to run raw SQL queries
-- with the proper search_path set

CREATE OR REPLACE FUNCTION exec_with_candidate_context(
  candidate_id TEXT,
  query_text TEXT
)
RETURNS JSONB AS $$
DECLARE
  schema_name TEXT;
  result JSONB;
BEGIN
  schema_name := get_candidate_schema(candidate_id);
  -- Set search_path for this transaction
  EXECUTE format('SET LOCAL search_path TO %I, public', schema_name);
  -- Execute the query (this is a simplified version - in production,
  -- you'd want more sophisticated query execution)
  -- Note: This function is a placeholder - actual implementation would
  -- depend on your query execution needs
  RETURN jsonb_build_object('schema', schema_name, 'query', query_text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
