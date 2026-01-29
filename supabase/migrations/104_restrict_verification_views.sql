-- Migration: Restrict Verification Views to Admin (Service Role) Only
-- Purpose: Ensure regular users cannot query these views directly

-- Revoke access from authenticated users (if previously granted)
REVOKE SELECT ON public.latest_github_verifications FROM authenticated;
REVOKE SELECT ON public.github_verification_stats FROM authenticated;

-- Grant access ONLY to service_role
GRANT SELECT ON public.latest_github_verifications TO service_role;
GRANT SELECT ON public.github_verification_stats TO service_role;

-- Update comments
COMMENT ON VIEW public.latest_github_verifications IS 'Shows the most recent verification for each candidate. Restricted to service_role (admin).';
COMMENT ON VIEW public.github_verification_stats IS 'Aggregated verification statistics. Restricted to service_role (admin).';
