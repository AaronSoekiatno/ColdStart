-- Create intro_requests table
CREATE TABLE IF NOT EXISTS intro_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  founder_email TEXT NOT NULL,
  hiring_for TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intro_requests_email ON intro_requests(founder_email);
CREATE INDEX IF NOT EXISTS idx_intro_requests_status ON intro_requests(status);
CREATE INDEX IF NOT EXISTS idx_intro_requests_candidate ON intro_requests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_intro_requests_created ON intro_requests(created_at DESC);

-- Enable RLS
ALTER TABLE intro_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (API can read/write all)
CREATE POLICY "Service role can manage intro requests"
  ON intro_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_intro_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intro_requests_updated_at
  BEFORE UPDATE ON intro_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_intro_requests_updated_at();
