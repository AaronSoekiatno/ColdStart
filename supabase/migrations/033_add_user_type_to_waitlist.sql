-- Add user_type column to waitlist table to distinguish between leads and users
-- Leads: People who signed up for the waitlist but haven't become active users
-- Users: Active candidates who have accounts and are using the platform

ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'lead' CHECK (user_type IN ('lead', 'user'));

-- Add index for filtering by user type
CREATE INDEX IF NOT EXISTS idx_waitlist_user_type ON public.waitlist(user_type);

-- Add comment to document the column
COMMENT ON COLUMN public.waitlist.user_type IS 'Type of user: "lead" for waitlist signups who haven''t become active users, "user" for active candidates using the platform';

-- Update existing waitlist entries that correspond to active candidates to be 'user' type
-- This backfills existing data based on whether the email exists in candidates table
UPDATE public.waitlist w
SET user_type = 'user'
WHERE EXISTS (
    SELECT 1 
    FROM public.candidates c 
    WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(w.email))
    AND (
        c.onboarding_completed = true
        OR c.subscription_status IN ('active', 'trialing')
        OR EXISTS (
            SELECT 1 
            FROM public.resumes r 
            WHERE r.candidate_id = c.id 
            AND r.is_active = true
        )
    )
);

