-- Create bug_reports table for user feedback
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- User info (auto-captured)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,

  -- Bug description (user-provided)
  description TEXT NOT NULL,

  -- Context (auto-captured)
  page_url TEXT,
  user_agent TEXT,
  browser_info JSONB,

  -- Status tracking (for admin use)
  status TEXT DEFAULT 'new', -- new, investigating, resolved, wontfix

  -- Extensible metadata
  metadata JSONB
);

-- Indexes for querying
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);

-- Enable Row Level Security
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own reports
CREATE POLICY "Users can create bug reports"
  ON bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own reports (optional, for future use)
CREATE POLICY "Users can view own reports"
  ON bug_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for admin access via Supabase dashboard)
CREATE POLICY "Service role has full access"
  ON bug_reports
  TO service_role
  USING (true)
  WITH CHECK (true);
