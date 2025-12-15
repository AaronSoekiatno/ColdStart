-- Add 'value-first' to the persona check constraint
-- This migration updates the existing constraint to include the new 'value-first' persona option

-- Drop the existing check constraint
alter table public.generated_emails
  drop constraint if exists generated_emails_persona_check;

-- Add the updated check constraint with all three persona options
alter table public.generated_emails
  add constraint generated_emails_persona_check check (persona in ('direct-ask', 'genuine-fan', 'value-first'));
