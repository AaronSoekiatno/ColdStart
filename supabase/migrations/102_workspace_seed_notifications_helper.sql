-- Helper function to seed notifications for a candidate
-- Call this after create_candidate_schema() to populate sample data

CREATE OR REPLACE FUNCTION seed_candidate_notifications(candidate_id TEXT)
RETURNS VOID AS $$
DECLARE
  schema_name TEXT;
  sample_user_id UUID;
BEGIN
  schema_name := get_candidate_schema(candidate_id);
  sample_user_id := gen_random_uuid();
  
  -- Insert 5 sample notifications (3 unread, 2 read)
  EXECUTE format('
    INSERT INTO %I.notifications (id, user_id, type, content, read, created_at) VALUES
    (gen_random_uuid(), %L, ''like'', ''sarah_dev liked your post "Building Real-Time Features"'', false, NOW() - INTERVAL ''2 hours''),
    (gen_random_uuid(), %L, ''comment'', ''john_code commented: "Great work! How did you handle the WebSocket connections?"'', false, NOW() - INTERVAL ''5 hours''),
    (gen_random_uuid(), %L, ''follow'', ''emma_ui started following you'', false, NOW() - INTERVAL ''1 day''),
    (gen_random_uuid(), %L, ''like'', ''alex_full liked your post'', true, NOW() - INTERVAL ''3 days''),
    (gen_random_uuid(), %L, ''comment'', ''lisa_pm commented on your post'', true, NOW() - INTERVAL ''5 days'')
  ', schema_name, sample_user_id, sample_user_id, sample_user_id, sample_user_id, sample_user_id);
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
-- SELECT create_candidate_schema('test_candidate');
-- SELECT seed_candidate_notifications('test_candidate');
