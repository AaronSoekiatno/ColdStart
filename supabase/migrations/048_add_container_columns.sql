-- Add container tracking columns to interview_sessions table

ALTER TABLE interview_sessions 
ADD COLUMN IF NOT EXISTS container_url TEXT,
ADD COLUMN IF NOT EXISTS container_status TEXT,
ADD COLUMN IF NOT EXISTS container_password TEXT,
ADD COLUMN IF NOT EXISTS container_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS container_stopped_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_interview_sessions_container_status 
ON interview_sessions(container_status) 
WHERE container_status IS NOT NULL;

COMMENT ON COLUMN interview_sessions.container_url IS 'Fly.io container URL (e.g., https://assessment-xyz.fly.dev)';
COMMENT ON COLUMN interview_sessions.container_status IS 'Container status: provisioning, running, stopped, error';
COMMENT ON COLUMN interview_sessions.container_password IS 'Container password (deprecated - using --auth none)';
COMMENT ON COLUMN interview_sessions.container_started_at IS 'When the container was provisioned';
COMMENT ON COLUMN interview_sessions.container_stopped_at IS 'When the container was stopped/destroyed';
