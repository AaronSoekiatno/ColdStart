
import { provisionFlyMachine } from '../lib/container-orchestration/flyio';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    // Generate a shorter runId to keep app name within limits
    // Fly app name format in flyio.ts: `assess-${candidateId.slice(0, 8)}-${sessionPart}`
    // sessionPart is sessionId without 'session_' and underscores replaced.
    const runId = Math.floor(Math.random() * 1000).toString(); 
    
    // We use a candidate ID that looks real enough
    const candidateId = 'test-deploy-user';
    const sessionId = `session_deployment_test_${runId}`;

    const config = {
        candidateId: candidateId,
        sessionId: sessionId,
        password: 'password123',
        telemetryUrl: 'https://hermes-startup.vercel.app', 
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        supabaseJwt: 'test-jwt-token' 
    };
    
    console.log('Provisioning machine with session:', sessionId);
    try {
        const { url } = await provisionFlyMachine(config);
        console.log('Machine provisioned successfully.');
        console.log('URL:', url);
        console.log('App Name (derived):', `assess-${candidateId.slice(0,8)}-deployment-test-${runId}`);
    } catch (e: any) {
        console.error('Failed to provision machine:', e);
        if (e.stdout) console.log('stdout:', e.stdout);
        if (e.stderr) console.error('stderr:', e.stderr);
    }
}

main();
