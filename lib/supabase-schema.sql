-- Minerva Interview Sessions Schema (Simplified)
-- Run this in Supabase SQL Editor to create the database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Interview Sessions Table
CREATE TABLE IF NOT EXISTS interview_sessions (
    -- Primary identifiers
    session_id TEXT PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE, -- Links to your SaaS candidate table

    -- Current state
    current_phase TEXT,
    status TEXT NOT NULL DEFAULT 'created', -- created, active, paused, completed, cancelled

    -- Timing
    interview_start_time TIMESTAMPTZ,
    interview_end_time TIMESTAMPTZ,

    -- Vapi tracking
    active_vapi_call_id TEXT,
    total_vapi_seconds INTEGER DEFAULT 0,

    -- Conversation history (JSONB for flexibility)
    conversation_history JSONB DEFAULT '[]'::jsonb,

    -- Phase states (JSONB for nested structure)
    phases JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Phase history array
    phase_history JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_candidate_id ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_current_phase ON interview_sessions(current_phase);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON interview_sessions(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interview_sessions_updated_at
    BEFORE UPDATE ON interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth strategy)
-- For now, allow all operations with service role key
CREATE POLICY "Enable all access for service role"
    ON interview_sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE interview_sessions IS 'Stores interview session state for Minerva technical interviews';
COMMENT ON COLUMN interview_sessions.candidate_id IS 'Foreign key to your SaaS candidate table - only link needed to your system';
COMMENT ON COLUMN interview_sessions.conversation_history IS 'Array of {role, content} message objects from Vapi conversations';
COMMENT ON COLUMN interview_sessions.phases IS 'State for each phase: {KICK_OFF: {status, startTime, endTime, vapiCallId, commits, messages}, ...}';
COMMENT ON COLUMN interview_sessions.phase_history IS 'Chronological array of phase events: [{phase, action, trigger, timestamp}, ...]';
