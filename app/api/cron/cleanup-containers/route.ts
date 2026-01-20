import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { destroyFlyMachine } from '@/lib/container-orchestration/flyio';

/**
 * GET /api/cron/cleanup-containers
 * 
 * Cron job that destroys containers older than 1 hour
 * Should be called by Vercel Cron or similar scheduler
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find containers older than 1 hour that are still running
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    
    // Verify Supabase Admin client is available
    if (!supabaseAdmin) {
      console.error('[Cleanup] Supabase Admin client not available (check SUPABASE_SERVICE_ROLE_KEY)');
      return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('session_id, container_url, container_started_at')
      .eq('container_status', 'running')
      .lt('container_started_at', oneHourAgo);

    if (error) {
      console.error('[Cleanup] Error fetching sessions:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const results = [];
    for (const session of sessions || []) {
      try {
        // Destroy machine (handles both old and new URL formats)
        console.log(`[Cleanup] Destroying container: ${session.container_url}`);
        await destroyFlyMachine(session.container_url);

        // Update database
        await supabaseAdmin
          .from('interview_sessions')
          .update({
            container_status: 'stopped',
            container_stopped_at: new Date().toISOString(),
          })
          .eq('session_id', session.session_id);

        results.push({ session_id: session.session_id, status: 'destroyed' });
      } catch (error) {
        console.error(`[Cleanup] Failed to destroy ${session.session_id}:`, error);
        results.push({ 
          session_id: session.session_id, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      cleaned: results.length,
      results,
    });

  } catch (error) {
    console.error('[Cleanup] Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
