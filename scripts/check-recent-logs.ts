import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkRecentLogs() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 Checking recent prompt logs...\n');

    // Get last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: logs, error } = await supabase
        .from('prompt_logs')
        .select('candidate_id, created_at, tokens_used, prompt_text_preview, response_time_ms')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error querying logs:', error);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log('❌ No logs found in the last 7 days.');
        console.log('\nThis means tokens_used is NOT being tracked.');
        console.log('The wrapper only logs prompts but not API responses with token counts.');
        return;
    }

    console.log(`Found ${logs.length} logs in the last 7 days:\n`);

    for (const log of logs) {
        console.log('─'.repeat(80));
        console.log(`Time: ${new Date(log.created_at).toLocaleString()}`);
        console.log(`Candidate: ${log.candidate_id?.slice(0, 20) || 'unknown'}`);
        console.log(`Tokens: ${log.tokens_used || 'NOT TRACKED'}`);
        console.log(`Response time: ${log.response_time_ms || 'N/A'}ms`);
        console.log(`Preview: ${log.prompt_text_preview?.slice(0, 100) || 'N/A'}...`);
    }

    console.log('\n─'.repeat(80));

    // Calculate stats
    const logsWithTokens = logs.filter(log => log.tokens_used != null);
    if (logsWithTokens.length === 0) {
        console.log('\n⚠️  PROBLEM IDENTIFIED:');
        console.log('None of the logs have token counts!');
        console.log('The wrapper is not capturing token usage from Claude API responses.');
    } else {
        const totalTokens = logsWithTokens.reduce((sum, log) => sum + (log.tokens_used || 0), 0);
        const avgTokens = Math.round(totalTokens / logsWithTokens.length);
        console.log(`\n✅ ${logsWithTokens.length}/${logs.length} logs have token data`);
        console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
        console.log(`Average per call: ${avgTokens.toLocaleString()}`);
        console.log(`Estimated cost: $${((totalTokens / 1_000_000) * 3).toFixed(2)}`);
    }
}

checkRecentLogs().catch(console.error);
