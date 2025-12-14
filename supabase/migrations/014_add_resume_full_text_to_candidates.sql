-- Add resume_full_text column to candidates table to store extracted full text content
-- This allows us to use the full resume context in email generation without re-processing
alter table public.candidates
add column if not exists resume_full_text text;

-- Add index for full text search if needed (optional, but useful for future features)
create index if not exists idx_candidates_resume_full_text_gin 
on public.candidates using gin(to_tsvector('english', resume_full_text));
