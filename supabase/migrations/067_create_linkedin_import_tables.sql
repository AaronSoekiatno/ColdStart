-- LinkedIn Import Tables
-- Per product spec: linkedin-scraping-product-spec.md

-- LinkedIn import tracking table
CREATE TABLE IF NOT EXISTS linkedin_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('csv', 'api')),
  status TEXT NOT NULL CHECK (status IN ('processing', 'complete', 'failed')),
  total_connections INT DEFAULT 0,
  matched_connections INT DEFAULT 0,
  file_hash TEXT, -- prevent duplicate CSV uploads
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Individual LinkedIn connections from imports
CREATE TABLE IF NOT EXISTS founder_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES linkedin_imports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- LinkedIn data
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company TEXT,
  position TEXT,
  profile_url TEXT,
  connected_date DATE,

  -- Matching data (matches to candidates in Hermes DB)
  matched_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  match_confidence FLOAT CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method TEXT CHECK (match_method IN ('email', 'name_company', 'name_school')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraping jobs table (for PhantomBuster API method)
CREATE TABLE IF NOT EXISTS linkedin_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  phantombuster_container_id TEXT,
  status TEXT CHECK (status IN ('queued', 'running', 'success', 'failed')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_imports_user_id ON linkedin_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_imports_status ON linkedin_imports(status);
CREATE INDEX IF NOT EXISTS idx_founder_connections_user_id ON founder_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_connections_matched_candidate ON founder_connections(matched_candidate_id);
CREATE INDEX IF NOT EXISTS idx_founder_connections_email ON founder_connections(email);
CREATE INDEX IF NOT EXISTS idx_founder_connections_import_id ON founder_connections(import_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_id ON linkedin_scrape_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON linkedin_scrape_jobs(status);

-- Enable Row Level Security
ALTER TABLE linkedin_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_scrape_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own LinkedIn data
CREATE POLICY "Users can view their own imports" ON linkedin_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imports" ON linkedin_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imports" ON linkedin_imports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own connections" ON founder_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections" ON founder_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own scrape jobs" ON linkedin_scrape_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scrape jobs" ON linkedin_scrape_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scrape jobs" ON linkedin_scrape_jobs
  FOR UPDATE USING (auth.uid() = user_id);
