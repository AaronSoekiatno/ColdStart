import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkPromptLogs() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking prompt_logs table...\n');

    // Get total count
    const { count, error: countError } = await supabase
        .from('prompt_logs')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error querying table:', countError);
        return;
    }

    console.log(`📊 Total records in prompt_logs: ${count || 0}\n`);

    // Get last 20 records
    const { data: logs, error } = await supabase
        .from('prompt_logs')
        .select('id, created_at, candidate_id, tool_name, tokens_used, provider')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error querying logs:', error);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log('No logs found in the table.');
        return;
    }

    console.log('📋 Last 20 records:');
    console.log('─'.repeat(100));
    console.log('Created At           | Candidate ID                         | Tool         | Tokens   | Provider');
    console.log('─'.repeat(100));

    for (const log of logs) {
        const time = new Date(log.created_at).toLocaleString();
        const candidateId = (log.candidate_id || 'unknown').slice(0, 36);
        const toolName = (log.tool_name || 'unknown').slice(0, 12);
        const tokens = (log.tokens_used || 0).toString().padStart(8);
        const provider = (log.provider || 'unknown').slice(0, 8);
        
        console.log(`${time.padEnd(20)} | ${candidateId.padEnd(36)} | ${toolName.padEnd(12)} | ${tokens} | ${provider}`);
    }

    // Get date range
    const { data: dateRange } = await supabase
        .from('prompt_logs')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);

    if (dateRange && dateRange.length > 0) {
        const oldest = new Date(dateRange[0].created_at);
        const newest = new Date(logs[0].created_at);
        console.log(`\n📅 Date range: ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`);
    }

    // Get total tokens
    const { data: tokenData } = await supabase
        .from('prompt_logs')
        .select('tokens_used');

    if (tokenData) {
        const totalTokens = tokenData.reduce((sum, log) => sum + (log.tokens_used || 0), 0);
        console.log(`\n💰 Total tokens across all logs: ${totalTokens.toLocaleString()}`);
        console.log(`💵 Estimated total cost: $${((totalTokens / 1_000_000) * 3).toFixed(2)} (at $3/MTok average)`);
    }
}

checkPromptLogs().catch(console.error);
