-- Migration: Backfill active candidates into waitlist table
-- This ensures all active candidates are in the email preferences system (waitlist table)
--
-- Active candidates are defined as those who:
-- 1. Have completed onboarding (onboarding_completed = true), OR
-- 2. Have an active subscription (subscription_status = 'active' or 'trialing'), OR
-- 3. Have uploaded a resume (have entries in resumes table or structured_resume_data)
--
-- This is a one-time backfill. For future candidates, consider adding a trigger
-- or updating application code to automatically add candidates to waitlist.
--
-- Note: This migration works whether or not the user_type column exists.
-- If user_type column exists (from migration 033), it will be set to 'user'.
-- If it doesn't exist yet, the backfill will still work and migration 033 will add the column.

DO $$
DECLARE
    has_user_type BOOLEAN;
BEGIN
    -- Check if user_type column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'waitlist' 
        AND column_name = 'user_type'
    ) INTO has_user_type;

    IF has_user_type THEN
        -- Insert with user_type = 'user'
        INSERT INTO public.waitlist (email, created_at, user_type)
        SELECT 
            c.email,
            COALESCE(c.created_at, NOW()),
            'user'::TEXT
        FROM public.candidates c
        WHERE 
            c.email IS NOT NULL
            AND c.email != ''
            AND NOT EXISTS (
                SELECT 1 
                FROM public.waitlist w 
                WHERE LOWER(TRIM(w.email)) = LOWER(TRIM(c.email))
            )
            AND (
                c.onboarding_completed = true
                OR c.subscription_status IN ('active', 'trialing')
                OR EXISTS (
                    SELECT 1 
                    FROM public.resumes r 
                    WHERE r.candidate_id = c.id 
                    AND r.is_active = true
                )
                OR c.structured_resume_data IS NOT NULL
            )
        ON CONFLICT (email) DO UPDATE
        SET user_type = 'user';
    ELSE
        -- Insert without user_type (column doesn't exist yet)
        INSERT INTO public.waitlist (email, created_at)
        SELECT 
            c.email,
            COALESCE(c.created_at, NOW())
        FROM public.candidates c
        WHERE 
            c.email IS NOT NULL
            AND c.email != ''
            AND NOT EXISTS (
                SELECT 1 
                FROM public.waitlist w 
                WHERE LOWER(TRIM(w.email)) = LOWER(TRIM(c.email))
            )
            AND (
                c.onboarding_completed = true
                OR c.subscription_status IN ('active', 'trialing')
                OR EXISTS (
                    SELECT 1 
                    FROM public.resumes r 
                    WHERE r.candidate_id = c.id 
                    AND r.is_active = true
                )
                OR c.structured_resume_data IS NOT NULL
            )
        ON CONFLICT (email) DO NOTHING;
    END IF;
END $$;

-- Add comment documenting this migration
COMMENT ON TABLE public.waitlist IS 'Email preferences and marketing communications list. Includes both waitlist signups (leads) and active candidates (users) from the candidates table. Use user_type column to distinguish between leads and users for targeted messaging.';

