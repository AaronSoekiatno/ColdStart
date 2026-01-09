/**
 * Test script for JWT generation utility
 * 
 * Tests the candidate JWT token generation to ensure it correctly:
 * - Generates valid JWT tokens
 * - Includes correct claims (candidate_id, schema, role)
 * - Sets proper expiration times
 * - Handles errors appropriately
 * 
 * Usage:
 *   tsx scripts/tests/test-jwt-generation.ts [candidate_id] [schema_name]
 */

import { resolve } from 'path';
import { config } from 'dotenv';
import * as jwt from 'jsonwebtoken';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { generateCandidateJWT } from '../../lib/generate-candidate-jwt';

function testJWTGeneration() {
  console.log('=== Testing JWT Generation Utility ===\n');

  // Check for JWT secret
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    console.error('❌ FAILED: JWT secret not found!');
    console.error('Please set SUPABASE_JWT_SECRET or JWT_SECRET in .env.local');
    console.error('Get it from: Supabase Dashboard > Settings > API > JWT Secret');
    process.exit(1);
  }

  console.log('TEST 1: Environment Configuration');
  console.log('-'.repeat(50));
  console.log(`JWT Secret found: ${jwtSecret ? 'Yes' : 'No'}`);
  console.log(`Secret length: ${jwtSecret.length} characters`);
  console.log(`Secret preview: ${jwtSecret.substring(0, 20)}...`);
  console.log('✅ PASSED: JWT secret is configured\n');

  // Get test parameters from command line or use defaults
  const candidateId = process.argv[2] || '550e8400-e29b-41d4-a716-446655440000';
  const schemaName = process.argv[3] || 'candidate_test_123';
  const expiresInHours = 24;

  console.log('TEST 2: JWT Token Generation');
  console.log('-'.repeat(50));
  console.log(`Candidate ID: ${candidateId}`);
  console.log(`Schema name: ${schemaName}`);
  console.log(`Expiration: ${expiresInHours} hours\n`);

  let token: string;
  try {
    token = generateCandidateJWT(candidateId, schemaName, expiresInHours);
    console.log('✅ PASSED: Token generated successfully');
    console.log(`Token length: ${token.length} characters`);
    console.log(`Token preview: ${token.substring(0, 50)}...\n`);
  } catch (error) {
    console.error('❌ FAILED: Token generation failed');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Test 3: Decode and verify token structure
  console.log('TEST 3: Token Structure Validation');
  console.log('-'.repeat(50));
  
  try {
    // Decode without verification (just to check structure)
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Failed to decode token');
    }

    const { header, payload } = decoded;

    // Check header
    console.log('Header:');
    console.log(`  Algorithm: ${header.alg}`);
    console.log(`  Type: ${header.typ || 'JWT'}`);
    
    if (header.alg !== 'HS256') {
      console.error('❌ FAILED: Algorithm should be HS256');
      process.exit(1);
    }
    console.log('✅ PASSED: Header is correct');

    // Check payload
    console.log('\nPayload:');
    console.log(`  sub (subject): ${payload.sub}`);
    console.log(`  candidate_id: ${payload.candidate_id}`);
    console.log(`  schema: ${payload.schema}`);
    console.log(`  role: ${payload.role}`);
    console.log(`  iat (issued at): ${new Date((payload.iat as number) * 1000).toISOString()}`);
    console.log(`  exp (expires at): ${new Date((payload.exp as number) * 1000).toISOString()}`);

    // Verify claims
    const issues: string[] = [];
    if (payload.sub !== candidateId) {
      issues.push(`sub mismatch: expected ${candidateId}, got ${payload.sub}`);
    }
    if (payload.candidate_id !== candidateId) {
      issues.push(`candidate_id mismatch: expected ${candidateId}, got ${payload.candidate_id}`);
    }
    if (payload.schema !== schemaName) {
      issues.push(`schema mismatch: expected ${schemaName}, got ${payload.schema}`);
    }
    if (payload.role !== 'authenticated') {
      issues.push(`role mismatch: expected 'authenticated', got ${payload.role}`);
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const expectedExp = now + (expiresInHours * 60 * 60);
    const actualExp = payload.exp as number;
    const expDiff = Math.abs(actualExp - expectedExp);
    
    if (expDiff > 60) { // Allow 1 minute difference
      issues.push(`expiration time mismatch: expected ~${expectedExp}, got ${actualExp}`);
    }

    if (issues.length > 0) {
      console.error('\n❌ FAILED: Token claims validation failed');
      issues.forEach(issue => console.error(`  - ${issue}`));
      process.exit(1);
    }

    console.log('\n✅ PASSED: All token claims are correct');

    // Verify expiration time
    const expiresIn = actualExp - now;
    const expiresInHoursActual = Math.floor(expiresIn / 3600);
    console.log(`\nExpiration check: Token expires in ${expiresInHoursActual} hours (expected: ${expiresInHours})`);
    
    if (Math.abs(expiresInHoursActual - expiresInHours) <= 1) {
      console.log('✅ PASSED: Expiration time is correct\n');
    } else {
      console.log(`⚠️  WARNING: Expiration time difference: ${Math.abs(expiresInHoursActual - expiresInHours)} hours\n`);
    }

  } catch (error) {
    console.error('❌ FAILED: Token validation failed');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Test 4: Verify token signature (optional - requires secret)
  console.log('TEST 4: Token Signature Verification');
  console.log('-'.repeat(50));
  
  try {
    const verified = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
    });
    console.log('✅ PASSED: Token signature is valid');
    console.log(`Verified payload:`, verified);
  } catch (error) {
    console.error('❌ FAILED: Token signature verification failed');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('\nThis might indicate:');
    console.error('  - JWT secret mismatch');
    console.error('  - Token was tampered with');
    console.error('  - Token algorithm mismatch');
    process.exit(1);
  }

  console.log('\n=== All Tests Complete ===');
  console.log(`\nSummary:`);
  console.log(`  - Token generated: Yes`);
  console.log(`  - Token structure: Valid`);
  console.log(`  - Token claims: Correct`);
  console.log(`  - Token signature: Valid`);
  console.log(`  - Token expiration: ${expiresInHours} hours`);
  console.log(`\nToken (first 100 chars): ${token.substring(0, 100)}...\n`);
}

// Run tests
try {
  testJWTGeneration();
} catch (error) {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
}

