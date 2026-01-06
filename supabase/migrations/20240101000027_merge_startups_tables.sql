-- Add missing columns to startups table if they don't exist
ALTER TABLE startups 
ADD COLUMN IF NOT EXISTS enrichment_quality_score FLOAT,
ADD COLUMN IF NOT EXISTS enrichment_quality_status TEXT,
ADD COLUMN IF NOT EXISTS pinecone_id TEXT,
ADD COLUMN IF NOT EXISTS website_keywords TEXT;

-- Merge data from startups3 into startups
-- Using ON CONFLICT (name) DO NOTHING to skip duplicates
INSERT INTO startups (
    batch,
    company_logo,
    company_twitter_url,
    created_at,
    data_source, -- Assuming this exists in startups or is nullable
    date_raised,
    description,
    enrichment_quality_score,
    enrichment_quality_status,
    enrichment_status,
    founder_backgrounds,
    founder_emails,
    founder_linkedin,
    founder_names,
    founder_school,
    founder_twitter_urls,
    founders_pfp,
    funding_amount,
    -- id is skipped to let startups generate its own UUIDs
    industry,
    -- job_listing missing in startups3 based on inspection, skipping
    keywords,
    location,
    name,
    needs_enrichment,
    pinecone_id,
    team_size,
    website,
    website_keywords,
    yc_description,
    yc_launch,
    yc_link
)
SELECT
    batch,
    company_logo,
    company_twitter_url,
    created_at,
    NULL as data_source, -- startups3 didn't have this in inspection, setting to NULL
    date_raised,
    description,
    enrichment_quality_score,
    enrichment_quality_status,
    enrichment_status,
    founder_backgrounds,
    founder_emails,
    founder_linkedin,
    founder_names,
    founder_school,
    founder_twitter_urls,
    founders_pfp,
    funding_amount,
    industry,
    keywords,
    location,
    name,
    needs_enrichment,
    pinecone_id,
    team_size,
    website,
    website_keywords,
    yc_description,
    yc_launch,
    yc_link
FROM startups3
ON CONFLICT (name) DO NOTHING;
