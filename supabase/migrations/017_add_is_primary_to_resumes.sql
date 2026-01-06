-- Add is_primary field to resumes table
-- This allows premium users to select which resume is their "current" resume
-- Only one resume per candidate can be primary at a time

alter table public.resumes
add column if not exists is_primary boolean default false;

-- Create unique partial index to ensure only one primary resume per candidate
create unique index if not exists idx_resumes_one_primary_per_candidate
on public.resumes(candidate_id)
where is_primary = true;

-- Set the most recent resume as primary for existing candidates (backward compatibility)
-- This ensures existing users have a primary resume set
update public.resumes r1
set is_primary = true
where r1.id = (
  select r2.id
  from public.resumes r2
  where r2.candidate_id = r1.candidate_id
    and r2.is_active = true
  order by r2.created_at desc
  limit 1
)
and not exists (
  select 1
  from public.resumes r3
  where r3.candidate_id = r1.candidate_id
    and r3.is_primary = true
);

-- Add comment
comment on column public.resumes.is_primary is 'Whether this resume is the primary/current resume for email generation. Only one resume per candidate can be primary.';
