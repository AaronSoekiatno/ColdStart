-- Create startup_users table to link auth users to startups
create table if not exists public.startup_users (
  id uuid primary key default uuid_generate_v4(),
  startup_id uuid references public.startups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'owner',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(startup_id, user_id)
);

-- Enable moddatetime extension if it's available, otherwise create a custom function
create extension if not exists moddatetime schema extensions;

-- Add updated_at trigger
create trigger handle_updated_at before update on public.startup_users
  for each row execute procedure moddatetime (updated_at);

-- Enable RLS
alter table public.startup_users enable row level security;

-- Add RLS policies
create policy "Users can view their own startup connections"
  on public.startup_users for select
  using (auth.uid() = user_id);

create policy "Users can insert their own startup connections"
  on public.startup_users for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own startup connections"
  on public.startup_users for update
  using (auth.uid() = user_id);

create policy "Users can delete their own startup connections"
  on public.startup_users for delete
  using (auth.uid() = user_id);


