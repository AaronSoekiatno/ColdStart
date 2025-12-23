-- Migration: Create saved_matches table
-- This table stores which startups users have saved for later review

CREATE TABLE IF NOT EXISTS saved_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure a user can't save the same match twice
  UNIQUE(user_id, match_id)
);

-- Add index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_saved_matches_user_id ON saved_matches(user_id);

-- Add index for faster lookups by match
CREATE INDEX IF NOT EXISTS idx_saved_matches_match_id ON saved_matches(match_id);

-- Add compound index for checking if a specific match is saved by a user
CREATE INDEX IF NOT EXISTS idx_saved_matches_user_match ON saved_matches(user_id, match_id);

-- Enable Row Level Security
ALTER TABLE saved_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own saved matches
CREATE POLICY "Users can view their own saved matches"
  ON saved_matches
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own saved matches
CREATE POLICY "Users can insert their own saved matches"
  ON saved_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own saved matches
CREATE POLICY "Users can delete their own saved matches"
  ON saved_matches
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment explaining the table
COMMENT ON TABLE saved_matches IS 'Stores which startups/matches users have saved for later review';
COMMENT ON COLUMN saved_matches.user_id IS 'References auth.users - the user who saved the match';
COMMENT ON COLUMN saved_matches.match_id IS 'References matches table - the match that was saved';
COMMENT ON COLUMN saved_matches.saved_at IS 'Timestamp when the match was saved';
