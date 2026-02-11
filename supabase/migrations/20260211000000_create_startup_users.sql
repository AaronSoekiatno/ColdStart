-- Drop existing startup_users table if it exists (from previous migration attempts)
drop table if exists public.startup_users cascade;

-- Create startup_users table to store founder onboarding data
-- This is the primary table for founders who go through company-form onboarding
create table if not exists public.startup_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  
  -- Company Information (from Phase 1)
  company_name text not null,
  website text,
  
  -- Hiring Information (from Phase 2)
  hiring_for text,
  job_posting_file_url text,
  
  -- Metadata
  role text default 'founder',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable moddatetime extension if it's available
create extension if not exists moddatetime schema extensions;

-- Add updated_at trigger using the extensions schema
create trigger handle_updated_at before update on public.startup_users
  for each row execute procedure extensions.moddatetime (updated_at);

-- Enable RLS
alter table public.startup_users enable row level security;

-- Add RLS policies
create policy "Users can view their own startup data"
  on public.startup_users for select
  using (auth.uid() = user_id);

create policy "Users can insert their own startup data"
  on public.startup_users for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own startup data"
  on public.startup_users for update
  using (auth.uid() = user_id);

create policy "Users can delete their own startup data"
  on public.startup_users for delete
  using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists idx_startup_users_user_id on public.startup_users(user_id);
create index if not exists idx_startup_users_company_name on public.startup_users(company_name);

