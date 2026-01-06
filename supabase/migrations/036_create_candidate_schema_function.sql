-- Create RPC function to provision candidate assessment workspace
-- This function creates a private Postgres schema with tables for the candidate's assessment

CREATE OR REPLACE FUNCTION public.create_candidate_schema(candidate_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_name TEXT;
  sanitized_uuid TEXT;
  existing_schema TEXT;
BEGIN
  -- Sanitize UUID: replace hyphens with underscores for valid schema name
  sanitized_uuid := REPLACE(candidate_id_param::TEXT, '-', '_');
  schema_name := 'candidate_' || sanitized_uuid;
  
  -- Check if schema already exists (idempotency)
  SELECT schema_name INTO existing_schema
  FROM public.candidates
  WHERE id = candidate_id_param
    AND provisioned_schema_name = schema_name;
  
  IF existing_schema IS NOT NULL THEN
    -- Schema already provisioned, return existing schema name
    RETURN schema_name;
  END IF;
  
  -- Create the schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- Create empty users table
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )', schema_name);
  
  -- Create empty sessions table
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      ended_at TIMESTAMP WITH TIME ZONE
    )', schema_name, schema_name);
  
  -- Create empty events table
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES %I.sessions(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )', schema_name, schema_name);
  
  -- Create performance_logs table with seed data
  -- Intentional gaps: missing index on timestamp, missing CHECK constraint on response_time_ms
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.performance_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint TEXT NOT NULL,
      response_time_ms INTEGER NOT NULL,
      status_code INTEGER NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      user_id UUID REFERENCES %I.users(id) ON DELETE SET NULL
    )', schema_name, schema_name);
  
  -- Insert 5-10 realistic seed records for immediate testing
  EXECUTE format('
    INSERT INTO %I.performance_logs (endpoint, response_time_ms, status_code, timestamp, user_id)
    VALUES
      (''/api/users'', 45, 200, NOW() - INTERVAL ''2 hours'', NULL),
      (''/api/sessions'', 120, 200, NOW() - INTERVAL ''1 hour 30 minutes'', NULL),
      (''/api/events'', 78, 200, NOW() - INTERVAL ''1 hour'', NULL),
      (''/api/users/123'', 234, 200, NOW() - INTERVAL ''45 minutes'', NULL),
      (''/api/sessions/456'', 156, 200, NOW() - INTERVAL ''30 minutes'', NULL),
      (''/api/events'', 89, 201, NOW() - INTERVAL ''15 minutes'', NULL),
      (''/api/users'', 312, 500, NOW() - INTERVAL ''10 minutes'', NULL),
      (''/api/sessions/789'', 67, 200, NOW() - INTERVAL ''5 minutes'', NULL),
      (''/api/events/101'', 198, 404, NOW() - INTERVAL ''2 minutes'', NULL),
      (''/api/users'', 145, 200, NOW() - INTERVAL ''1 minute'', NULL)
    ON CONFLICT DO NOTHING', schema_name);
  
  -- Grant permissions to authenticated role
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO authenticated', schema_name);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO authenticated', schema_name);
  
  -- Update candidates table with schema name and timestamp
  UPDATE public.candidates
  SET 
    provisioned_schema_name = schema_name,
    provisioned_at = NOW()
  WHERE id = candidate_id_param;
  
  RETURN schema_name;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to create candidate schema: %', SQLERRM;
END;
$$;

-- Add comment to document the function
COMMENT ON FUNCTION public.create_candidate_schema(UUID) IS 
'Creates a private Postgres schema for candidate assessment workspace. Includes empty tables (users, sessions, events) and performance_logs with seed data. Returns the schema name. Idempotent - returns existing schema if already provisioned.';

