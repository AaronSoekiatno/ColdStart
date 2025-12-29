-- Fix foreign key constraints to reference startups3 instead of startups
-- This migration updates both generated_emails and sent_emails tables

-- Step 1: Drop old foreign key constraints
ALTER TABLE public.generated_emails
DROP CONSTRAINT IF EXISTS generated_emails_startup_id_fkey;

ALTER TABLE public.sent_emails
DROP CONSTRAINT IF EXISTS sent_emails_startup_id_fkey;

-- Step 2: Clean up orphaned records that reference non-existent startups in startups3
-- Delete generated_emails that reference startups not in startups3
DELETE FROM public.generated_emails
WHERE startup_id NOT IN (SELECT id FROM public.startups3);

-- Delete sent_emails that reference startups not in startups3
DELETE FROM public.sent_emails
WHERE startup_id NOT IN (SELECT id FROM public.startups3);

-- Step 3: Add new foreign key constraints pointing to startups3
ALTER TABLE public.generated_emails
ADD CONSTRAINT generated_emails_startup_id_fkey
FOREIGN KEY (startup_id) REFERENCES public.startups3(id) ON DELETE CASCADE;

ALTER TABLE public.sent_emails
ADD CONSTRAINT sent_emails_startup_id_fkey
FOREIGN KEY (startup_id) REFERENCES public.startups3(id) ON DELETE CASCADE;
