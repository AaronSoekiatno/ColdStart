import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function findCulprit() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Searching for Claude API calls on Jan 14, 11:00-12:00 UTC...\n');

    // Query for calls during the incident
    const { data: logs, error } = await supabase
        .from('prompt_logs')
        .select('*')
        .gte('created_at', '2026-01-14T11:00:00Z')
        .lt('created_at', '2026-01-14T12:00:00Z')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log('❌ No logs found in Supabase for this time period');
        console.log('   This means the logging failed or was bypassed');
        return;
    }

    console.log(`✅ Found ${logs.length} logged API calls\n`);

    // Group by candidate
    const byCandidate = new Map();
    for (const log of logs) {
        const cid = log.candidate_id || 'unknown';
        if (!byCandidate.has(cid)) {
            byCandidate.set(cid, []);
        }
        byCandidate.get(cid).push(log);
    }

    console.log('📊 Calls by Candidate:');
    console.log('─'.repeat(80));
    for (const [candidateId, calls] of byCandidate.entries()) {
        console.log(`\n${candidateId}:`);
        console.log(`  Total calls: ${calls.length}`);
        console.log(`  First call: ${new Date(calls[0].created_at).toISOString()}`);
        console.log(`  Last call: ${new Date(calls[calls.length - 1].created_at).toISOString()}`);
        
        // Show first few calls
        console.log(`\n  Sample calls:`);
        for (const call of calls.slice(0, 3)) {
            const time = new Date(call.created_at).toLocaleTimeString();
            const tool = call.tool_name || 'unknown';
            const status = call.response_status || 'unknown';
            console.log(`    ${time} | ${tool} | Status: ${status}`);
        }
    }
}

findCulprit().catch(console.error);
