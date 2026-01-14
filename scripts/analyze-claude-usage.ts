import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function analyzeClaudeUsage() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Analyzing Claude API Usage from Yesterday...\n');

    // Get yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Query prompt_logs for yesterday
    const { data: logs, error } = await supabase
        .from('prompt_logs')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error querying logs:', error);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log('No logs found for yesterday.');
        return;
    }

    console.log(`📊 Found ${logs.length} API calls yesterday\n`);

    // Analyze by candidate
    const byCandidateMap = new Map<string, { count: number; tokens: number }>();
    const byToolMap = new Map<string, { count: number; tokens: number }>();
    let totalTokens = 0;

    for (const log of logs) {
        const candidateId = log.candidate_id || 'unknown';
        const toolName = log.tool_name || 'unknown';
        const tokens = log.tokens_used || 0;

        totalTokens += tokens;

        // By candidate
        const candidateStats = byCandidateMap.get(candidateId) || { count: 0, tokens: 0 };
        candidateStats.count++;
        candidateStats.tokens += tokens;
        byCandidateMap.set(candidateId, candidateStats);

        // By tool
        const toolStats = byToolMap.get(toolName) || { count: 0, tokens: 0 };
        toolStats.count++;
        toolStats.tokens += tokens;
        byToolMap.set(toolName, toolStats);
    }

    console.log('📈 Total Tokens Used:', totalTokens.toLocaleString());
    console.log('💰 Estimated Cost: $' + ((totalTokens / 1_000_000) * 3).toFixed(2), '(at $3/MTok average)\n');

    console.log('👥 By Candidate:');
    console.log('─'.repeat(80));
    const candidateEntries = Array.from(byCandidateMap.entries())
        .sort((a, b) => b[1].tokens - a[1].tokens);
    
    for (const [candidateId, stats] of candidateEntries) {
        console.log(`${candidateId.slice(0, 36).padEnd(36)} | ${stats.count.toString().padStart(5)} calls | ${stats.tokens.toLocaleString().padStart(12)} tokens`);
    }

    console.log('\n🔧 By Tool:');
    console.log('─'.repeat(80));
    const toolEntries = Array.from(byToolMap.entries())
        .sort((a, b) => b[1].tokens - a[1].tokens);
    
    for (const [toolName, stats] of toolEntries) {
        console.log(`${toolName.padEnd(36)} | ${stats.count.toString().padStart(5)} calls | ${stats.tokens.toLocaleString().padStart(12)} tokens`);
    }

    // Show top 10 largest individual calls
    console.log('\n🔥 Top 10 Largest Individual Calls:');
    console.log('─'.repeat(80));
    const topCalls = [...logs]
        .sort((a, b) => (b.tokens_used || 0) - (a.tokens_used || 0))
        .slice(0, 10);

    for (const call of topCalls) {
        const candidateId = (call.candidate_id || 'unknown').slice(0, 20);
        const toolName = (call.tool_name || 'unknown').slice(0, 15);
        const tokens = (call.tokens_used || 0).toLocaleString();
        const time = new Date(call.created_at).toLocaleTimeString();
        console.log(`${time} | ${candidateId.padEnd(20)} | ${toolName.padEnd(15)} | ${tokens.padStart(10)} tokens`);
    }

    // Check for suspicious patterns
    console.log('\n⚠️  Suspicious Patterns:');
    console.log('─'.repeat(80));
    
    // Calls with >100k tokens
    const largeCalls = logs.filter(log => (log.tokens_used || 0) > 100000);
    if (largeCalls.length > 0) {
        console.log(`❗ ${largeCalls.length} calls used >100k tokens each`);
    }

    // Rapid calls from same candidate (>10 calls in 1 minute)
    const callsByMinute = new Map<string, number>();
    for (const log of logs) {
        const minute = new Date(log.created_at).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
        const key = `${log.candidate_id}-${minute}`;
        callsByMinute.set(key, (callsByMinute.get(key) || 0) + 1);
    }
    
    const rapidCalls = Array.from(callsByMinute.entries()).filter(([_, count]) => count > 10);
    if (rapidCalls.length > 0) {
        console.log(`❗ ${rapidCalls.length} instances of >10 calls per minute from same candidate`);
        for (const [key, count] of rapidCalls.slice(0, 5)) {
            console.log(`   - ${key}: ${count} calls`);
        }
    }

    if (largeCalls.length === 0 && rapidCalls.length === 0) {
        console.log('✅ No obvious suspicious patterns detected');
    }
}

analyzeClaudeUsage().catch(console.error);
