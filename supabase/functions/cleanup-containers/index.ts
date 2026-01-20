import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FLY_API_TOKEN = Deno.env.get('FLY_API_TOKEN');
const POOL_APP_NAME = 'hermes-assessment-pool';

// CORS headers for browser testing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Find containers older than 1 hour
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('interview_sessions')
      .select('session_id, container_url, container_started_at')
      .eq('container_status', 'running')
      .lt('container_started_at', oneHourAgo);

    if (error) {
      throw error;
    }

    console.log(`[Cleanup] Found ${sessions?.length ?? 0} stale sessions`);

    const results = [];

    // 3. Destroy each container via Fly.io Machines API
    for (const session of sessions || []) {
      if (!session.container_url) continue;

      try {
        // Extract machine name from URL
        // Format: https://assess-xxx.fly.dev
        const url = new URL(session.container_url);
        const machineName = url.hostname.split('.')[0];
        
        console.log(`[Cleanup] Processing session ${session.session_id} (Machine: ${machineName})`);

        // Sanitize token: Remove 'FlyV1' prefix if present from copy-paste
        const token = FLY_API_TOKEN?.replace(/^FlyV1\s+/, '') || '';

        // Resolve Machine ID from Name
        const listResp = await fetch(`https://api.machines.dev/v1/apps/${POOL_APP_NAME}/machines`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResp.ok) {
           console.error(`[Fly API] Failed to list machines: ${await listResp.text()}`);
           continue; 
        }

        const machines = await listResp.json();
        const machine = machines.find((m: any) => m.name === machineName);

        if (machine) {
            // Destroy Machine
            console.log(`[Fly API] Destroying machine ${machine.id}...`);
            const destroyResp = await fetch(`https://api.machines.dev/v1/apps/${POOL_APP_NAME}/machines/${machine.id}?force=true`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            
            if (!destroyResp.ok) {
                 const errText = await destroyResp.text();
                 // If 404, it's already gone
                 if (destroyResp.status !== 404) {
                     throw new Error(`Failed to destroy machine: ${errText}`);
                 }
            }
        } else {
            console.log(`[Fly API] Machine ${machineName} not found, assuming already deleted.`);
        }

        // 4. Update Database
        await supabase
          .from('interview_sessions')
          .update({
            container_status: 'stopped',
            container_stopped_at: new Date().toISOString(),
          })
          .eq('session_id', session.session_id);

        results.push({ session_id: session.session_id, status: 'destroyed' });

      } catch (err) {
        console.error(`[Cleanup] Failed to process ${session.session_id}:`, err);
        results.push({ session_id: session.session_id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Cleanup] Fatal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
