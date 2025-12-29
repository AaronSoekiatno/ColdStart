-- Create access_codes table for one-time use beta access codes
-- These codes grant access to the beta testing cohort

CREATE TABLE IF NOT EXISTS access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The actual access code (unique identifier users will enter)
  code TEXT NOT NULL UNIQUE,
  
  -- Optional: restrict to a specific email (NULL means anyone can use it)
  restricted_to_email TEXT,
  
  -- Tracking usage
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  description TEXT, -- Internal note about what this code is for (e.g., "Beta cohort 1")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_is_used ON access_codes(is_used);

-- Add comments
COMMENT ON TABLE access_codes IS 'One-time use access codes for beta testing cohort';
COMMENT ON COLUMN access_codes.code IS 'The unique access code string that users enter';
COMMENT ON COLUMN access_codes.restricted_to_email IS 'If set, only this email can use the code';
COMMENT ON COLUMN access_codes.is_used IS 'Whether this code has been redeemed';
COMMENT ON COLUMN access_codes.used_by_email IS 'Email of the user who redeemed the code';
COMMENT ON COLUMN access_codes.used_at IS 'Timestamp when the code was redeemed';

-- Enable Row Level Security
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own used codes (for history)
CREATE POLICY "Users can view their own used codes" ON access_codes
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = used_by_email
    OR auth.jwt() ->> 'email' = restricted_to_email
  );

-- Policy: Service role can do everything (for admin operations)
-- Note: Service role bypasses RLS by default

-- Add beta_access column to candidates table to track beta cohort membership
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS beta_access BOOLEAN DEFAULT false;

-- Add index for beta access queries
CREATE INDEX IF NOT EXISTS idx_candidates_beta_access ON candidates(beta_access);

-- Add comment
COMMENT ON COLUMN candidates.beta_access IS 'Whether user has beta testing cohort access (granted via access code)';

