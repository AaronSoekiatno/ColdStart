    -- Create jobs table for Work at a Startup job listings
    CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    job_type TEXT, -- fulltime, contract, parttime, internship, etc.
    location TEXT, -- Remote, San Francisco, CA, US, etc.
    job_role TEXT, -- Full stack, Backend, Frontend, etc.
    posted_date TEXT, -- e.g., "13 days ago", "about 5 hours ago"
    job_url TEXT, -- Link to apply
    company_batch TEXT, -- YC batch (e.g., S21, W22, S24)
    company_tagline TEXT, -- Short company description/tagline (e.g., "AI Agents for collections")
    company_about TEXT, -- Full "About [Company]" section
    salary_range TEXT, -- e.g., "$75K - $90K", "$120K - $180K"
    visa_requirements TEXT, -- e.g., "US citizen/visa only", "US visa not required"
    experience_level TEXT, -- e.g., "Any (new grads ok)", "3+ years"
    skills TEXT, -- Comma-separated skills/technologies (e.g., "Node.js, Python, React, TypeScript")
    requirements TEXT, -- Full requirements section
    benefits TEXT, -- Benefits/compensation details
    interview_process TEXT, -- Interview process description
    full_description TEXT, -- Complete job description including all sections
    startup_id TEXT REFERENCES startups(id) ON DELETE SET NULL, -- Link to startups table if found
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_name, job_title, job_url) -- Prevent duplicates
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_jobs_company_name ON jobs(company_name);
    CREATE INDEX IF NOT EXISTS idx_jobs_startup_id ON jobs(startup_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
    CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
    CREATE INDEX IF NOT EXISTS idx_jobs_company_batch ON jobs(company_batch);
    CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

    -- Create GIN index for full-text search on descriptions
    CREATE INDEX IF NOT EXISTS idx_jobs_full_description_gin ON jobs USING gin(to_tsvector('english', COALESCE(full_description, '')));
    CREATE INDEX IF NOT EXISTS idx_jobs_skills_gin ON jobs USING gin(to_tsvector('english', COALESCE(skills, '')));

    -- Enable Row Level Security (RLS)
    ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

    -- Create policy to allow all operations (adjust based on your auth requirements)
    CREATE POLICY "Allow all operations on jobs" ON jobs
    FOR ALL USING (true) WITH CHECK (true);

    -- Create trigger to automatically update updated_at
    CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

    -- Add comments explaining the columns
    COMMENT ON TABLE jobs IS 'Job listings scraped from workatastartup.com';
    COMMENT ON COLUMN jobs.startup_id IS 'Foreign key to startups table if company is found in our database';
    COMMENT ON COLUMN jobs.company_tagline IS 'Short company tagline/description (e.g., "AI Agents for collections")';
    COMMENT ON COLUMN jobs.company_about IS 'Full "About [Company]" section from job listing';
    COMMENT ON COLUMN jobs.salary_range IS 'Salary range if provided (e.g., "$75K - $90K")';
    COMMENT ON COLUMN jobs.visa_requirements IS 'Visa/sponsorship requirements';
    COMMENT ON COLUMN jobs.experience_level IS 'Required experience level (e.g., "Any (new grads ok)")';
    COMMENT ON COLUMN jobs.skills IS 'Comma-separated list of required skills/technologies';
    COMMENT ON COLUMN jobs.full_description IS 'Complete job description including all sections (About, Requirements, Benefits, etc.)';

