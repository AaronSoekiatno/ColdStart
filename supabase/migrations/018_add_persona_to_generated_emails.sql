-- Add persona column to generated_emails table
-- This stores which persona ('direct-ask', 'genuine-fan', or 'value-first') was used to generate the email
alter table public.generated_emails
  add column if not exists persona text check (persona in ('direct-ask', 'genuine-fan', 'value-first'));

-- Add index for faster persona-based queries
create index if not exists idx_generated_emails_persona on public.generated_emails(persona);

-- Update existing rows to have default persona
update public.generated_emails
set persona = 'direct-ask'
where persona is null;
