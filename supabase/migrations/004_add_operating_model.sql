-- Add operating_model column to startups table
-- This stores the company's DNA/culture captured through founder interview

ALTER TABLE startups
ADD COLUMN IF NOT EXISTS operating_model JSONB DEFAULT '{
  "pace": null,
  "quality_bar": null,
  "priorities": [],
  "culture_description": null
}'::jsonb;

-- Add index for querying by operating model attributes
CREATE INDEX IF NOT EXISTS idx_startups_operating_model ON startups USING gin(operating_model);

-- Add comment for documentation
COMMENT ON COLUMN startups.operating_model IS 'Company DNA: pace (fast/moderate/deliberate), quality_bar (high/balanced/move-fast), priorities array, and culture_description';
