-- Migration 061: Add post-mortem survey fields to assessment_scores
-- Tracks candidate reflections after the assessment

DO $$ 
BEGIN 
    -- 1. Add q1_approach
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'q1_approach') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN q1_approach TEXT;
    END IF;

    -- 2. Add q2_production_readiness
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'q2_production_readiness') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN q2_production_readiness TEXT;
    END IF;

    -- 3. Add q3_claude_mistake
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'q3_claude_mistake') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN q3_claude_mistake TEXT;
    END IF;

    -- 4. Add difficulty_score
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'difficulty_score') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN difficulty_score INTEGER;
    END IF;

    -- 5. Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin_audit' AND table_name = 'assessment_scores' AND column_name = 'updated_at') THEN
        ALTER TABLE admin_audit.assessment_scores ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

END $$;

-- Update the log_test_result function or create a new one for post-mortem
-- Since post-mortem happens after tests, it's better to have a separate RPC

CREATE OR REPLACE FUNCTION public.submit_post_mortem(
  p_session_id TEXT,
  p_candidate_id UUID,
  p_q1_approach TEXT,
  p_q2_production_readiness TEXT,
  p_q3_claude_mistake TEXT,
  p_difficulty_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin_audit, extensions
AS $$
DECLARE
  v_score_id UUID;
  v_result JSONB;
BEGIN
  -- Find the latest assessment score for this session
  SELECT id INTO v_score_id
  FROM admin_audit.assessment_scores
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_score_id IS NOT NULL THEN
    -- Update existing record
    UPDATE admin_audit.assessment_scores SET
      q1_approach = p_q1_approach,
      q2_production_readiness = p_q2_production_readiness,
      q3_claude_mistake = p_q3_claude_mistake,
      difficulty_score = p_difficulty_score,
      updated_at = NOW()
    WHERE id = v_score_id
    RETURNING to_jsonb(assessment_scores.*) INTO v_result;
  ELSE
    -- Create new record
    INSERT INTO admin_audit.assessment_scores (
      session_id,
      candidate_id,
      q1_approach,
      q2_production_readiness,
      q3_claude_mistake,
      difficulty_score,
      created_at
    ) VALUES (
      p_session_id,
      p_candidate_id,
      p_q1_approach,
      p_q2_production_readiness,
      p_q3_claude_mistake,
      p_difficulty_score,
      NOW()
    )
    RETURNING to_jsonb(assessment_scores.*) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.submit_post_mortem TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_post_mortem TO service_role;
