-- Prompt Logging Migration
-- Creates the prompt_logs table and RPC functions for logging AI prompts/responses
-- This migration is idempotent and safe to run multiple times

-- Ensure admin_audit schema exists (should already exist from 001_initial_schema.sql)
CREATE SCHEMA IF NOT EXISTS admin_audit;

-- Create prompt_logs table (no compression - Supabase doesn't have pg_lzcompress)
CREATE TABLE IF NOT EXISTS admin_audit.prompt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  tool_name TEXT,
  user_agent TEXT,
  model_requested TEXT,
  prompt_text_preview TEXT, -- First 500 chars for quick queries
  prompt_text TEXT, -- Full prompt text
  prompt_json JSONB, -- Full JSON request
  request_metadata JSONB, -- Additional request metadata
  response_status INTEGER,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  response_json JSONB, -- Response JSON
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add provider column if it doesn't exist (for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin_audit' 
    AND table_name = 'prompt_logs' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE admin_audit.prompt_logs ADD COLUMN provider TEXT;
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prompt_logs_candidate_id ON admin_audit.prompt_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_created_at ON admin_audit.prompt_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_tool_name ON admin_audit.prompt_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_provider ON admin_audit.prompt_logs(provider);

-- RPC Function: log_prompt
-- Logs a prompt request (before response is received)
-- Drop function first if it exists (to handle signature changes)
DROP FUNCTION IF EXISTS log_prompt(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION log_prompt(
  p_candidate_id TEXT,
  p_prompt_text TEXT,
  p_prompt_json JSONB,
  p_provider TEXT,
  p_tool_name TEXT,
  p_user_agent TEXT,
  p_model_requested TEXT,
  p_request_metadata JSONB,
  p_response_status INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_response_json JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  prompt_preview TEXT;
BEGIN
  -- Generate preview (first 500 chars)
  prompt_preview := LEFT(p_prompt_text, 500);

  -- Insert into prompt_logs (no compression)
  INSERT INTO admin_audit.prompt_logs (
    candidate_id,
    provider,
    tool_name,
    user_agent,
    model_requested,
    prompt_text_preview,
    prompt_text,
    prompt_json,
    request_metadata,
    response_status,
    response_time_ms,
    tokens_used,
    response_json,
    created_at
  ) VALUES (
    p_candidate_id,
    p_provider,
    p_tool_name,
    p_user_agent,
    p_model_requested,
    prompt_preview,
    p_prompt_text,
    p_prompt_json,
    p_request_metadata,
    p_response_status,
    p_response_time_ms,
    p_tokens_used,
    p_response_json,
    NOW()
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: update_prompt_log_response
-- Updates an existing prompt log with response data
-- Finds the most recent log entry for the candidate that doesn't have a response yet
-- Drop function first if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS update_prompt_log_response(TEXT, INTEGER, INTEGER, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION update_prompt_log_response(
  p_candidate_id TEXT,
  p_response_status INTEGER,
  p_response_time_ms INTEGER,
  p_tokens_used INTEGER,
  p_response_json JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update the most recent log entry for this candidate that doesn't have a response
  WITH latest_log AS (
    SELECT id
    FROM admin_audit.prompt_logs
    WHERE candidate_id = p_candidate_id
      AND response_status IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  )
  UPDATE admin_audit.prompt_logs
  SET
    response_status = p_response_status,
    response_time_ms = p_response_time_ms,
    tokens_used = p_tokens_used,
    response_json = p_response_json
  FROM latest_log
  WHERE admin_audit.prompt_logs.id = latest_log.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get_prompt_text
-- Returns the full prompt text for a given log ID
DROP FUNCTION IF EXISTS get_prompt_text(UUID);
CREATE OR REPLACE FUNCTION get_prompt_text(p_log_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT prompt_text FROM admin_audit.prompt_logs WHERE id = p_log_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get_prompt_json
-- Returns the full prompt JSON for a given log ID
DROP FUNCTION IF EXISTS get_prompt_json(UUID);
CREATE OR REPLACE FUNCTION get_prompt_json(p_log_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT prompt_json FROM admin_audit.prompt_logs WHERE id = p_log_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get_response_json
-- Returns the full response JSON for a given log ID
DROP FUNCTION IF EXISTS get_response_json(UUID);
CREATE OR REPLACE FUNCTION get_response_json(p_log_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT response_json FROM admin_audit.prompt_logs WHERE id = p_log_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION log_prompt TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_prompt_log_response TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_prompt_text TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_prompt_json TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_response_json TO authenticated, service_role;

-- Lock down admin_audit schema - only system can write
REVOKE ALL ON SCHEMA admin_audit FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA admin_audit FROM authenticated;

