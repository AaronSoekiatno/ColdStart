-- Add resume download tracking table
-- This tracks when users download resumes from the resumes section

create table if not exists public.resume_downloads (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references public.candidates(id) on delete cascade not null,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  download_type text not null check (download_type in ('preview', 'enhanced', 'original')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.resume_downloads enable row level security;

-- Allow users to view their own download history
create policy "Users can view their own resume downloads" on public.resume_downloads
  for select using (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Allow users to insert their own download records
create policy "Users can insert their own resume downloads" on public.resume_downloads
  for insert with check (
    candidate_id in (
      select id from public.candidates where email = auth.jwt() ->> 'email'
    )
  );

-- Add indexes for performance
create index if not exists idx_resume_downloads_candidate_id on public.resume_downloads(candidate_id);
create index if not exists idx_resume_downloads_resume_id on public.resume_downloads(resume_id);
create index if not exists idx_resume_downloads_download_type on public.resume_downloads(download_type);
create index if not exists idx_resume_downloads_created_at on public.resume_downloads(created_at desc);

-- Add comments
comment on table public.resume_downloads is 'Tracks resume download events for analytics';
comment on column public.resume_downloads.download_type is 'Type of download: preview (iframe view), enhanced (new PDF download), original (direct file download)';
