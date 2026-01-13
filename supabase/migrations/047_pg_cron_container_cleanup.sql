-- IMPORTANT: Enable these extensions via Supabase Dashboard first:
-- 1. Go to Database > Extensions
-- 2. Enable: pg_cron
-- 3. Enable: pg_net
-- Then run this migration

-- Create a config table for storing the Fly API token
CREATE TABLE IF NOT EXISTS admin_audit.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the Fly API token (replace with your actual token)
-- Run this separately after the migration:
-- INSERT INTO admin_audit.system_config (key, value) 
-- VALUES ('fly_api_token', 'YOUR_FLY_TOKEN_HERE')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Create a function that cleans up old containers
CREATE OR REPLACE FUNCTION cleanup_old_containers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_record RECORD;
    app_name TEXT;
    fly_api_token TEXT;
BEGIN
    -- Get Fly API token from config table
    SELECT value INTO fly_api_token 
    FROM admin_audit.system_config 
    WHERE key = 'fly_api_token';
    
    IF fly_api_token IS NULL THEN
        RAISE NOTICE 'FLY_API_TOKEN not configured in system_config table';
        RETURN;
    END IF;

    -- Find sessions older than 3 hours that are still running
    FOR session_record IN 
        SELECT session_id, container_url
        FROM interview_sessions
        WHERE container_status = 'running'
        AND container_started_at < NOW() - INTERVAL '3 hours'
    LOOP
        -- Extract app name from URL (e.g., https://assessment-xyz.fly.dev -> assessment-xyz)
        app_name := REPLACE(REPLACE(session_record.container_url, 'https://', ''), '.fly.dev', '');
        
        -- Call Fly.io API to destroy the app
        PERFORM net.http_delete(
            url := 'https://api.fly.io/v1/apps/' || app_name,
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || fly_api_token,
                'Content-Type', 'application/json'
            )
        );
        
        -- Update the database
        UPDATE interview_sessions
        SET 
            container_status = 'stopped',
            container_stopped_at = NOW()
        WHERE session_id = session_record.session_id;
        
        RAISE NOTICE 'Destroyed container: %', app_name;
    END LOOP;
END;
$$;

-- Schedule the cleanup function to run every hour
-- Note: pg_cron times are in UTC
SELECT cron.schedule(
    'cleanup-old-containers',     -- job name
    '0 * * * *',                   -- hourly (at minute 0)
    'SELECT cleanup_old_containers();'
);

-- View all cron jobs
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('cleanup-old-containers');
