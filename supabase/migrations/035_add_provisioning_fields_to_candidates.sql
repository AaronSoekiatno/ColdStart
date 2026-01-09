-- Add provisioning fields to candidates table
-- These fields track the Postgres schema created for each candidate's assessment workspace

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS provisioned_schema_name TEXT,
ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP WITH TIME ZONE;

-- Create index on provisioned_schema_name for efficient lookups
CREATE INDEX IF NOT EXISTS idx_candidates_provisioned_schema_name 
ON public.candidates(provisioned_schema_name);

-- Add comments to document the columns
COMMENT ON COLUMN public.candidates.provisioned_schema_name IS 'Postgres schema name created for candidate assessment workspace (e.g., candidate_abc123)';
COMMENT ON COLUMN public.candidates.provisioned_at IS 'Timestamp when the candidate schema was provisioned';

