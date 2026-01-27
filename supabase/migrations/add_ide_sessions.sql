-- Migration: Add IDE sessions tracking table
-- Description: Track IDE container sessions for users

CREATE TABLE IF NOT EXISTS ide_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE,
  container_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'ended', 'expired'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'expired'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ide_sessions_user_id ON ide_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_session_id ON ide_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_active ON ide_sessions(user_id, status) WHERE status = 'active';

-- RLS Policies
ALTER TABLE ide_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IDE sessions"
  ON ide_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all IDE sessions"
  ON ide_sessions FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE ide_sessions IS 'Tracks IDE container sessions for users';
