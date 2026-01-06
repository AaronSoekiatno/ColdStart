-- Add unique constraint to prevent duplicate emails to the same founder from the same startup
-- This allows upsert functionality: update existing email instead of creating duplicates

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM public.sent_emails a
USING public.sent_emails b
WHERE a.id < b.id
  AND a.candidate_id = b.candidate_id
  AND a.startup_id = b.startup_id
  AND a.recipient_email = b.recipient_email;

-- Add unique constraint
ALTER TABLE public.sent_emails
ADD CONSTRAINT sent_emails_candidate_startup_recipient_unique
UNIQUE (candidate_id, startup_id, recipient_email);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT sent_emails_candidate_startup_recipient_unique ON public.sent_emails IS
'Ensures one email per candidate per startup per recipient. Allows upsert to update existing emails instead of creating duplicates.';
