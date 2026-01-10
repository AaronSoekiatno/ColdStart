-- Migration: Cleanup prompt_logs table
-- Drops unused blob columns and prompt_length
-- Ensures prompt_text and prompt_json store full data (already in place)

-- Drop unused blob columns (legacy, never used in current schema)
ALTER TABLE admin_audit.prompt_logs
  DROP COLUMN IF EXISTS prompt_text_blob,
  DROP COLUMN IF EXISTS prompt_json_blob,
  DROP COLUMN IF EXISTS response_blob,
  DROP COLUMN IF EXISTS prompt_length;

-- Verify the table structure (for reference):
-- prompt_text_preview: TEXT - first 500 chars for quick queries
-- prompt_text: TEXT - full raw prompt text
-- prompt_json: JSONB - full JSON request structure
-- response_json: JSONB - full response (populated by update_prompt_log_response)
