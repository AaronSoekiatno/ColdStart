
import { provisionFlyMachine, destroyFlyMachine } from '../lib/container-orchestration/flyio';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testProvisioning() {
  console.log('🚀 Starting provisioning test...');
  
  if (!process.env.FLY_API_TOKEN) {
    console.error('❌ FLY_API_TOKEN is missing in .env.local');
    process.exit(1);
  }

  const testId = Math.floor(Math.random() * 10000).toString();
  const config = {
    candidateId: `test-user-${testId}`,
    sessionId: `sess-${testId}`,
    password: '', // Disabled auth
    telemetryUrl: 'https://google.com', // Dummy URL
    supabaseUrl: 'https://placeholder.supabase.co',
    supabaseAnonKey: 'placeholder',
    supabaseJwt: 'placeholder',
  };

  try {
    console.log(`📋 Configuration:`);
    console.log(`- Candidate: ${config.candidateId}`);
    console.log(`- Session: ${config.sessionId}`);
    
    console.log('\n🏗️  Provisioning machine...');
    const result = await provisionFlyMachine(config);
    
    console.log('\n✅ Success!');
    console.log(`URL: ${result.url}`);
    
    console.log('\n🧹 Cleaning up in 120 seconds (2 mins)... GO CHECK THE URL NOW!');
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    const appName = result.url.replace('https://', '').replace('.fly.dev', '');
    await destroyFlyMachine(appName);
    console.log('🗑️  Cleanup complete');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testProvisioning();
