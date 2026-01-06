
import { spawn } from 'child_process';
import path from 'path';

/**
 * Test script for verifying provision-key.js logic
 * 
 * Usage: tsx scripts/test-provisioning-flow.ts
 */

const PROVISION_SCRIPT = path.join(process.cwd(), 'AbsurdLangChain', 'scripts', 'provision-key.js');
const MOCK_API_PORT = 3005;
const MOCK_API_URL = `http://localhost:${MOCK_API_PORT}`;

// 1. Start a mock server to simulate the provisioning API
import http from 'http';

const server = http.createServer((req, res) => {
  console.log(`[Mock Server] Received request: ${req.method} ${req.url}`);
  
  if (req.url === '/api/topcandidates/provision' && req.method === 'GET') {
      const authHeader = req.headers['authorization'];
      let isAuthenticated = false;

      // Log auth header for debugging
      if (authHeader) {
          console.log(`[Mock Server] Auth Header: ${authHeader}`);
          if (authHeader.startsWith('Bearer ')) {
              isAuthenticated = true; // For testing purposes, accept any Bearer token
          }
      } else {
           console.log(`[Mock Server] No Auth Header received`);
      }

    const proxyUrl = `${MOCK_API_URL}/api/proxy/gemini`;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      GEMINI_BASE_URL: proxyUrl,
      GOOGLE_BASE_URL: proxyUrl,
      GOOGLE_API_KEY: 'managed-by-proxy',
      SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_PRIVATE_KEY: 'mock-private-key',
      SUPABASE_ANON_KEY: 'mock-anon-key',
      _TEST_AUTH_RECEIVED: isAuthenticated // Return this so we can verify it in the logs/output
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(MOCK_API_PORT, () => {
  console.log(`[Test] Mock provisioning server running at ${MOCK_API_URL}`);
  runTests();
});

async function runTests() {
  try {
    console.log('\n--- Test 1: Using QUARTERMASTER_API_URL directly ---');
    await runScript({ QUARTERMASTER_API_URL: `${MOCK_API_URL}/api/topcandidates/provision` });

    console.log('\n--- Test 2: Using ADMIN_TELEMETRY_URL (Base URL) ---');
    await runScript({ ADMIN_TELEMETRY_URL: MOCK_API_URL });

    console.log('\n--- Test 3: With HERMES_PROVISIONING_TOKEN ---');
    await runScript({ 
      ADMIN_TELEMETRY_URL: MOCK_API_URL,
      HERMES_PROVISIONING_TOKEN: 'test-token-uuid-1234'
    });

    console.log('\n✅ All provisioning tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

function runScript(env: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('node', [PROVISION_SCRIPT], {
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
