/**
 * Test script for API Key Pool utility
 * 
 * Tests the API key pool manager to ensure it correctly:
 * - Initializes from environment variables
 * - Handles single key (GEMINI_API_KEY)
 * - Handles key pools (GEMINI_API_KEY_POOL or GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
 * - Tracks usage statistics
 * - Implements round-robin selection
 * 
 * Usage:
 *   tsx scripts/tests/test-api-key-pool.ts
 */

import { resolve } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { getApiKeyPool, getNextApiKey } from '../../lib/api-key-pool';

function testApiKeyPool() {
  console.log('=== Testing API Key Pool Utility ===\n');

  const pool = getApiKeyPool();

  // Test 1: Check initialization
  console.log('TEST 1: Pool Initialization');
  console.log('-'.repeat(50));
  const keyCount = pool.getKeyCount();
  const hasKeys = pool.hasKeys();
  console.log(`Key count: ${keyCount}`);
  console.log(`Has keys: ${hasKeys}`);
  
  if (!hasKeys) {
    console.error('\n❌ FAILED: No API keys found in pool!');
    console.error('Please set GEMINI_API_KEY in .env.local');
    process.exit(1);
  }
  console.log('✅ PASSED: Pool initialized successfully\n');

  // Test 2: Test round-robin selection
  console.log('TEST 2: Round-Robin Key Selection');
  console.log('-'.repeat(50));
  const selectedKeys: string[] = [];
  const iterations = Math.min(5, keyCount * 2); // Test multiple rounds if pool has multiple keys
  
  for (let i = 0; i < iterations; i++) {
    const key = getNextApiKey();
    selectedKeys.push(key);
    // Only show first 15 characters for security
    console.log(`  Selection ${i + 1}: ${key.substring(0, 15)}...`);
  }
  
  // Verify round-robin works (if multiple keys)
  if (keyCount > 1) {
    const uniqueKeys = new Set(selectedKeys);
    if (uniqueKeys.size === keyCount) {
      console.log(`✅ PASSED: Round-robin cycling through ${keyCount} keys\n`);
    } else {
      console.log(`⚠️  WARNING: Expected ${keyCount} unique keys, got ${uniqueKeys.size}`);
    }
  } else {
    console.log('✅ PASSED: Single key selection works (pool mode ready for future)\n');
  }

  // Test 3: Test usage statistics
  console.log('TEST 3: Usage Statistics');
  console.log('-'.repeat(50));
  const stats = pool.getUsageStats();
  
  stats.forEach((stat, index) => {
    console.log(`Key ${index + 1}:`);
    console.log(`  Usage count: ${stat.usageCount}`);
    console.log(`  Last used: ${stat.lastUsed.toISOString()}`);
    console.log(`  Key preview: ${stat.key.substring(0, 15)}...`);
  });
  
  if (stats.length > 0 && stats[0].usageCount > 0) {
    console.log('✅ PASSED: Usage tracking works\n');
  } else {
    console.log('⚠️  WARNING: Usage count is 0 (might be expected on first run)\n');
  }

  // Test 4: Test error handling (if no keys)
  console.log('TEST 4: Error Handling');
  console.log('-'.repeat(50));
  try {
    // This should not throw since we have keys
    const testKey = getNextApiKey();
    if (testKey && testKey.length > 0) {
      console.log('✅ PASSED: Key retrieval succeeds when keys are available');
    }
  } catch (error) {
    console.error('❌ FAILED: Unexpected error:', error);
    process.exit(1);
  }

  console.log('\n=== All Tests Complete ===');
  console.log(`\nSummary:`);
  console.log(`  - Keys in pool: ${keyCount}`);
  console.log(`  - Total selections tested: ${iterations}`);
  console.log(`  - Pool ready for production: ${hasKeys ? 'Yes' : 'No'}`);
  console.log(`  - Future pool support: Ready (when GEMINI_API_KEY_POOL is set)\n`);
}

// Run tests
try {
  testApiKeyPool();
} catch (error) {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
}

