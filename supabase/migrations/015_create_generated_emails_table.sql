-- Create generated_emails table to store email drafts (one per candidate-startup pair)
-- This ensures each user gets exactly ONE generated email per startup company.
-- Gemini will only be called ONCE per user per startup - subsequent requests will return the stored email.
create table if not exists public.generated_emails (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  startup_id text not null references public.startups(id) on delete cascade,
  email_tone text, -- 'professional', 'classy', 'informative', 'ambitious', 'conversational', or null for default (stored but not part of uniqueness)
  subject text not null,
  body text not null,
  match_score numeric,
  recipient_email text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  -- Ensure one generated email per candidate-startup pair (one-to-one mapping)
  -- This unique constraint guarantees Gemini will only be called once per user per company
  constraint generated_emails_candidate_startup_unique unique (candidate_id, startup_id)
);

-- Create indexes for faster queries
create index if not exists idx_generated_emails_candidate_id on public.generated_emails(candidate_id);
create index if not exists idx_generated_emails_startup_id on public.generated_emails(startup_id);
create index if not exists idx_generated_emails_candidate_startup on public.generated_emails(candidate_id, startup_id);

-- Enable Row Level Security
alter table public.generated_emails enable row level security;

-- Policy: Users can only see their own generated emails
create policy "Users can view their own generated emails"
  on public.generated_emails
  for select
  using (
    exists (
      select 1
      from public.candidates
      where candidates.id = generated_emails.candidate_id
        and candidates.email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can insert their own generated emails
create policy "Users can insert their own generated emails"
  on public.generated_emails
  for insert
  with check (
    exists (
      select 1
      from public.candidates
      where candidates.id = generated_emails.candidate_id
        and candidates.email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can update their own generated emails
create policy "Users can update their own generated emails"
  on public.generated_emails
  for update
  using (
    exists (
      select 1
      from public.candidates
      where candidates.id = generated_emails.candidate_id
        and candidates.email = auth.jwt() ->> 'email'
    )
  );

-- Add trigger to update updated_at timestamp
create or replace function update_generated_emails_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_generated_emails_updated_at
  before update on public.generated_emails
  for each row
  execute function update_generated_emails_updated_at();
