-- Add email sending tracking columns to waitlist table
-- This allows us to track which emails have been sent and handle failures

-- Add columns to track email sending status
alter table public.waitlist
  add column if not exists sent_at timestamp with time zone,
  add column if not exists sent_status text check (sent_status in ('pending', 'sent', 'failed')),
  add column if not exists error_message text;

-- Add index for filtering by sent status (useful for querying unsent emails)
create index if not exists idx_waitlist_sent_status on public.waitlist(sent_status);

-- Add index on sent_at for sorting/filtering by send date
create index if not exists idx_waitlist_sent_at on public.waitlist(sent_at desc);
