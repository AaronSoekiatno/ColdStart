-- Drop the summary column from candidates table
-- This column is no longer used - all summary data is now stored in structured_resume_data JSONB
-- Migration: 026_drop_summary_column.sql

ALTER TABLE candidates DROP COLUMN IF EXISTS summary;

