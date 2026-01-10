-- Add container tracking columns to interview_sessions
ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS container_url TEXT,
ADD COLUMN IF NOT EXISTS container_password TEXT,
ADD COLUMN IF NOT EXISTS container_status TEXT DEFAULT 'provisioning',
ADD COLUMN IF NOT EXISTS container_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS container_stopped_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on status (e.g. for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_container_status 
ON public.interview_sessions(container_status);
