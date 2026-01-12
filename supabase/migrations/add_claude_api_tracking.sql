-- Migration: Add Claude API key tracking tables
-- Description: Track Claude API keys per user session for usage monitoring and cost control

-- Table to track Claude API keys per session
CREATE TABLE IF NOT EXISTS claude_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  api_key_hash TEXT NOT NULL, -- Store hashed, not plaintext
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for performance
  CONSTRAINT unique_session_key UNIQUE (session_id)
);

-- Index for looking up keys by user
CREATE INDEX IF NOT EXISTS idx_claude_api_keys_user_id ON claude_api_keys(user_id);

-- Index for finding active keys
CREATE INDEX IF NOT EXISTS idx_claude_api_keys_active ON claude_api_keys(user_id, session_id) 
  WHERE revoked_at IS NULL;

-- Row Level Security (RLS) policies
ALTER TABLE claude_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view their own API keys"
  ON claude_api_keys FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all keys (for backend API)
CREATE POLICY "Service role can manage all API keys"
  ON claude_api_keys FOR ALL
  USING (auth.role() = 'service_role');

-- Function to automatically revoke expired keys
CREATE OR REPLACE FUNCTION revoke_expired_claude_keys()
RETURNS void AS $$
BEGIN
  UPDATE claude_api_keys
  SET revoked_at = NOW()
  WHERE expires_at < NOW()
    AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to run this function periodically
-- This requires the pg_cron extension
-- SELECT cron.schedule('revoke-expired-claude-keys', '*/15 * * * *', 'SELECT revoke_expired_claude_keys()');

COMMENT ON TABLE claude_api_keys IS 'Tracks Claude API keys provisioned to user sessions';

