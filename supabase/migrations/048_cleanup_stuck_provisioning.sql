-- Update the cleanup function to also handle stuck provisioning sessions
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

    -- 1. Clean up sessions older than 3 hours that are still running
    FOR session_record IN 
        SELECT session_id, container_url
        FROM interview_sessions
        WHERE container_status = 'running'
        AND container_started_at < NOW() - INTERVAL '3 hours'
        AND container_url IS NOT NULL
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
        
        RAISE NOTICE 'Destroyed running container: %', app_name;
    END LOOP;

    -- 2. Clean up stuck provisioning sessions (older than 30 minutes)
    -- These are sessions that failed to provision but were never marked as failed
    UPDATE interview_sessions
    SET 
        container_status = 'failed',
        container_stopped_at = NOW()
    WHERE container_status = 'provisioning'
    AND created_at < NOW() - INTERVAL '30 minutes'
    AND container_url IS NULL;
    
    -- Log how many stuck sessions were cleaned
    RAISE NOTICE 'Cleaned up % stuck provisioning sessions', 
        (SELECT COUNT(*) FROM interview_sessions 
         WHERE container_status = 'failed' 
         AND container_stopped_at > NOW() - INTERVAL '1 minute');

END;
$$;
