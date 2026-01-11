-- Create a stored procedure to correctly log assessment scores
-- This bypasses the restriction where admin_audit schema is not directly exposed to the API

-- FIRST: Ensure the interview_sessions table has the necessary columns
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS last_test_run_at TIMESTAMPTZ;
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS last_test_score INTEGER;
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS test_run_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.log_test_result(
  p_session_id TEXT,
  p_candidate_id UUID,
  p_test_type TEXT,
  p_test_results JSONB,
  p_total_score INTEGER,
  p_max_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the creator (postgres/admin)
SET search_path = public, admin_audit, extensions -- Robust search path
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Insert into the admin_audit table
  INSERT INTO admin_audit.assessment_scores (
    session_id,
    candidate_id,
    test_type,
    test_results,
    total_score,
    max_score,
    created_at
  ) VALUES (
    p_session_id,
    p_candidate_id,
    p_test_type,
    p_test_results,
    p_total_score,
    p_max_score,
    NOW()
  )
  RETURNING to_jsonb(assessment_scores.*) INTO v_result;

  -- Update the interview_sessions table with the summary
  UPDATE public.interview_sessions
  SET 
    last_test_run_at = NOW(),
    last_test_score = p_total_score,
    test_run_count = COALESCE(test_run_count, 0) + 1
  WHERE session_id = p_session_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.log_test_result TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_test_result TO service_role;
