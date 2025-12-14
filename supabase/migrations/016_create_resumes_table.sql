-- Create resumes table to allow multiple resumes per candidate
-- This enables premium users to upload and manage multiple resumes

create table if not exists public.resumes (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references public.candidates(id) on delete cascade not null,
  name text not null, -- User-defined name for the resume (e.g., "Software Engineer Resume", "Product Manager Resume")
  file_name text not null, -- Original uploaded file name
  resume_path text, -- Path to resume file in Supabase Storage
  resume_full_text text, -- Full extracted text content from resume
  is_active boolean default true, -- Whether this resume is active/available for use
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.resumes enable row level security;

-- Allow users to view their own resumes
create policy "Users can view their own resumes" on public.resumes
  for select using (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Allow users to insert their own resumes
create policy "Users can insert their own resumes" on public.resumes
  for insert with check (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Allow users to update their own resumes
create policy "Users can update their own resumes" on public.resumes
  for update using (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Allow users to delete their own resumes
create policy "Users can delete their own resumes" on public.resumes
  for delete using (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Add indexes for performance
create index if not exists idx_resumes_candidate_id on public.resumes(candidate_id);
create index if not exists idx_resumes_is_active on public.resumes(is_active);
create index if not exists idx_resumes_created_at on public.resumes(created_at desc);

-- Add full text search index for resume content
create index if not exists idx_resumes_full_text_gin
on public.resumes using gin(to_tsvector('english', resume_full_text));

-- Add trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language 'plpgsql';

create trigger update_resumes_updated_at
  before update on public.resumes
  for each row execute procedure update_updated_at_column();

-- Migrate existing resume data from candidates table to resumes table
-- This ensures backward compatibility for users who already have resumes
insert into public.resumes (
  candidate_id,
  name,
  file_name,
  resume_path,
  resume_full_text,
  created_at,
  updated_at
)
select
  c.id,
  'Primary Resume' as name,
  coalesce(split_part(c.resume_path, '/', -1), 'resume.pdf') as file_name,
  c.resume_path,
  c.resume_full_text,
  c.created_at,
  c.created_at
from public.candidates c
where c.resume_path is not null;

-- Update candidates table to remove direct resume storage
-- Keep the fields for backward compatibility but mark as deprecated
comment on column public.candidates.resume_path is 'DEPRECATED: Use resumes table instead';
comment on column public.candidates.resume_full_text is 'DEPRECATED: Use resumes table instead';