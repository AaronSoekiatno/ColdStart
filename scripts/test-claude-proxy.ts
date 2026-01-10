#!/usr/bin/env node
/**
 * Test script for Claude proxy endpoint
 * Generates a valid JWT and tests the /api/proxy/claude endpoint
 */

import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error('❌ Error: SUPABASE_JWT_SECRET not found in .env.local');
  process.exit(1);
}

// Generate a test JWT
const testCandidateId = 'test-candidate-' + Date.now();
const testSchemaName = 'candidate_test';

const payload = {
  sub: testCandidateId,
  candidateId: testCandidateId, // Claude proxy uses this field
  candidate_id: testCandidateId,
  schema: testSchemaName,
  role: 'authenticated',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
};

const token = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });

console.log('🔑 Generated Test JWT:');
console.log(token);
console.log('');
console.log('📋 Token Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('');
console.log('🧪 Testing Claude Proxy...');
console.log('');

// Test the proxy
const testPrompt = {
  model: 'claude-3-sonnet-20240229',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'Say hello in one sentence' }
  ]
};

const proxyUrl = 'http://localhost:3000/api/proxy/claude/v1/messages';

console.log(`📡 Sending request to: ${proxyUrl}`);
console.log('');

try {
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPrompt),
  });

  const statusCode = response.status;
  const responseData = await response.json();

  if (statusCode === 200) {
    console.log('✅ Success! Claude responded:');
    console.log('');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');
    console.log('💾 Check admin_audit.prompt_logs in Supabase to verify logging!');
    console.log(`   candidate_id: ${testCandidateId}`);
  } else {
    console.log(`❌ Error: HTTP ${statusCode}`);
    console.log(JSON.stringify(responseData, null, 2));
  }
} catch (error) {
  console.error('❌ Request failed:', error);
}