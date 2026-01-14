import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function investigateJWTTokens() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Investigating JWT Tokens and Sessions...\n');

    // 1. Check all interview sessions
    console.log('1️⃣ Checking interview_sessions table...');
    const { data: sessions, error: sessionsError } = await supabase
        .from('interview_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (sessionsError) {
        console.error('Error:', sessionsError);
    } else {
        console.log(`Found ${sessions?.length || 0} recent sessions\n`);
        if (sessions && sessions.length > 0) {
            console.log('Recent sessions:');
            for (const session of sessions.slice(0, 5)) {
                console.log(`  - ${session.session_id} | Candidate: ${session.candidate_id} | Created: ${new Date(session.created_at).toLocaleString()}`);
            }
        }
    }

    // 2. Check for any sessions created around the incident time
    console.log('\n2️⃣ Checking for sessions during incident (Jan 14, 11:00-12:00 UTC)...');
    const { data: incidentSessions, error: incidentError } = await supabase
        .from('interview_sessions')
        .select('*')
        .gte('created_at', '2026-01-14T11:00:00Z')
        .lt('created_at', '2026-01-14T12:00:00Z');

    if (incidentError) {
        console.error('Error:', incidentError);
    } else {
        console.log(`Found ${incidentSessions?.length || 0} sessions during incident`);
        if (incidentSessions && incidentSessions.length > 0) {
            for (const session of incidentSessions) {
                console.log(`  ⚠️  ${session.session_id} | Candidate: ${session.candidate_id}`);
            }
        }
    }

    // 3. Check claude_api_keys table for provisioned keys
    console.log('\n3️⃣ Checking claude_api_keys table...');
    const { data: apiKeys, error: keysError } = await supabase
        .from('claude_api_keys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (keysError) {
        console.error('Error:', keysError);
    } else {
        console.log(`Found ${apiKeys?.length || 0} API key records\n`);
        if (apiKeys && apiKeys.length > 0) {
            console.log('Recent API keys:');
            for (const key of apiKeys) {
                console.log(`  - User: ${key.user_id} | Session: ${key.session_id} | Created: ${new Date(key.created_at).toLocaleString()}`);
            }
        }
    }

    // 4. Check for any candidates
    console.log('\n4️⃣ Checking candidates table...');
    const { data: candidates, error: candidatesError } = await supabase
        .from('candidates')
        .select('id, email, name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (candidatesError) {
        console.error('Error:', candidatesError);
    } else {
        console.log(`Found ${candidates?.length || 0} candidates\n`);
        if (candidates && candidates.length > 0) {
            console.log('Recent candidates:');
            for (const candidate of candidates) {
                console.log(`  - ${candidate.email} | ${candidate.name} | Created: ${new Date(candidate.created_at).toLocaleString()}`);
            }
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 Analysis:');
    console.log('='.repeat(80));
    console.log('\nPossible explanations for mystery usage:');
    console.log('1. You or teammate testing/debugging at 3 AM');
    console.log('2. Automated test/script that ran unexpectedly');
    console.log('3. Old JWT token that was still valid');
    console.log('4. API key was used directly (bypassing proxy)');
    console.log('\nNext steps:');
    console.log('- Check Anthropic Console for User-Agent in request details');
    console.log('- Check Vercel logs: vercel logs --since "2026-01-14T11:00:00Z"');
    console.log('- Ask teammate if they were testing at 3 AM PST');
}

investigateJWTTokens().catch(console.error);
