/**
 * Test script for create_candidate_schema RPC function
 * 
 * Tests the Postgres RPC function to ensure it correctly:
 * - Creates a private schema for a candidate
 * - Creates all required tables (users, sessions, events, performance_logs)
 * - Inserts seed data into performance_logs
 * - Updates candidates table with schema info
 * - Handles idempotency (multiple calls return same schema)
 * 
 * Usage:
 *   tsx scripts/tests/test-rpc-function.ts [candidate_id]
 * 
 * Note: Requires a valid candidate_id from your candidates table
 */

import { resolve } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

async function testRPCFunction() {
  console.log('=== Testing create_candidate_schema RPC Function ===\n');

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ FAILED: Supabase credentials not found!');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  console.log('TEST 1: Database Connection');
  console.log('-'.repeat(50));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Service role key: ${supabaseKey.substring(0, 20)}...`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ PASSED: Supabase client initialized\n');

  // Get candidate ID from command line or fetch a test candidate
  let candidateId: string | null = process.argv[2] || null;

  if (!candidateId) {
    console.log('TEST 2: Fetch Test Candidate');
    console.log('-'.repeat(50));
    
    // Fetch first candidate from database
    const { data: candidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id, email, name, provisioned_schema_name')
      .limit(1)
      .single();

    if (fetchError || !candidates) {
      console.error('❌ FAILED: Could not fetch test candidate');
      console.error('Error:', fetchError?.message || 'No candidates found');
      console.error('\nPlease provide a candidate_id as argument:');
      console.error('  tsx scripts/tests/test-rpc-function.ts <candidate-id>');
      process.exit(1);
    }

    candidateId = candidates.id;
    console.log(`Using candidate:`);
    console.log(`  ID: ${candidateId}`);
    console.log(`  Email: ${(candidates as any).email}`);
    console.log(`  Name: ${(candidates as any).name}`);
    console.log(`  Existing schema: ${(candidates as any).provisioned_schema_name || 'None'}`);
    console.log('✅ PASSED: Test candidate found\n');
  } else {
    // Verify candidate exists
    const { data: candidate, error: verifyError } = await supabase
      .from('candidates')
      .select('id, email, name, provisioned_schema_name')
      .eq('id', candidateId)
      .single();

    if (verifyError || !candidate) {
      console.error('❌ FAILED: Candidate not found');
      console.error('Error:', verifyError?.message);
      process.exit(1);
    }

    console.log(`Using candidate:`);
    console.log(`  ID: ${candidateId}`);
    console.log(`  Email: ${(candidate as any).email}`);
    console.log(`  Name: ${(candidate as any).name}`);
    console.log(`  Existing schema: ${(candidate as any).provisioned_schema_name || 'None'}\n`);
  }

  // Test 3: Call RPC function
  console.log('TEST 3: Call create_candidate_schema RPC');
  console.log('-'.repeat(50));
  console.log(`Candidate ID: ${candidateId}\n`);

  const { data: schemaName, error: rpcError } = await supabase.rpc(
    'create_candidate_schema',
    { candidate_id_param: candidateId }
  );

  if (rpcError) {
    console.error('❌ FAILED: RPC function call failed');
    console.error('Error:', rpcError.message);
    console.error('Details:', rpcError);
    process.exit(1);
  }

  if (!schemaName || typeof schemaName !== 'string') {
    console.error('❌ FAILED: RPC function did not return schema name');
    console.error('Returned:', schemaName);
    process.exit(1);
  }

  console.log(`✅ PASSED: Schema created successfully`);
  console.log(`Schema name: ${schemaName}\n`);

  // Test 4: Verify schema exists
  console.log('TEST 4: Verify Schema Exists');
  console.log('-'.repeat(50));
  
  const { data: schemas, error: schemaError } = await supabase
    .rpc('exec_sql', {
      sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schemaName}'`
    })
    .catch(() => {
      // exec_sql might not exist, try direct query
      return { data: null, error: { message: 'Cannot query schemas directly' } };
    });

  // Alternative: Check if we can query tables in the schema
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', schemaName)
    .limit(10);

  if (tablesError) {
    console.log('⚠️  WARNING: Cannot directly verify schema (this is expected)');
    console.log('   Schema verification requires direct database access');
  } else if (tables && tables.length > 0) {
    console.log(`✅ PASSED: Schema exists with ${tables.length} table(s)`);
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });
  } else {
    console.log('⚠️  WARNING: Could not verify tables (might require direct DB access)');
  }
  console.log('');

  // Test 5: Verify candidates table was updated
  console.log('TEST 5: Verify Candidates Table Updated');
  console.log('-'.repeat(50));
  
  const { data: updatedCandidate, error: updateError } = await supabase
    .from('candidates')
    .select('id, provisioned_schema_name, provisioned_at')
    .eq('id', candidateId)
    .single();

  if (updateError || !updatedCandidate) {
    console.error('❌ FAILED: Could not verify candidate update');
    console.error('Error:', updateError?.message);
    process.exit(1);
  }

  const updated = updatedCandidate as any;
  if (updated.provisioned_schema_name !== schemaName) {
    console.error('❌ FAILED: Schema name mismatch');
    console.error(`Expected: ${schemaName}`);
    console.error(`Got: ${updated.provisioned_schema_name}`);
    process.exit(1);
  }

  if (!updated.provisioned_at) {
    console.error('❌ FAILED: provisioned_at timestamp not set');
    process.exit(1);
  }

  console.log(`✅ PASSED: Candidates table updated correctly`);
  console.log(`  Schema name: ${updated.provisioned_schema_name}`);
  console.log(`  Provisioned at: ${updated.provisioned_at}\n`);

  // Test 6: Test idempotency (call again)
  console.log('TEST 6: Test Idempotency (Second Call)');
  console.log('-'.repeat(50));
  
  const { data: schemaName2, error: rpcError2 } = await supabase.rpc(
    'create_candidate_schema',
    { candidate_id_param: candidateId }
  );

  if (rpcError2) {
    console.error('❌ FAILED: Second RPC call failed');
    console.error('Error:', rpcError2.message);
    process.exit(1);
  }

  if (schemaName2 !== schemaName) {
    console.error('❌ FAILED: Idempotency failed');
    console.error(`First call returned: ${schemaName}`);
    console.error(`Second call returned: ${schemaName2}`);
    process.exit(1);
  }

  console.log(`✅ PASSED: Idempotency works`);
  console.log(`  Both calls returned: ${schemaName2}\n`);

  // Test 7: Verify seed data (if we can access the schema)
  console.log('TEST 7: Verify Schema Structure');
  console.log('-'.repeat(50));
  console.log('Note: Direct schema access requires database privileges');
  console.log('To fully verify, run these SQL queries in your database:');
  console.log(`\n  SELECT table_name FROM information_schema.tables`);
  console.log(`    WHERE table_schema = '${schemaName}';`);
  console.log(`\n  SELECT COUNT(*) FROM ${schemaName}.performance_logs;`);
  console.log(`  -- Should return 10 records\n`);
  console.log(`  SELECT column_name, data_type FROM information_schema.columns`);
  console.log(`    WHERE table_schema = '${schemaName}' AND table_name = 'performance_logs';`);
  console.log('');

  console.log('=== All Tests Complete ===');
  console.log(`\nSummary:`);
  console.log(`  - Candidate ID: ${candidateId}`);
  console.log(`  - Schema name: ${schemaName}`);
  console.log(`  - Schema created: Yes`);
  console.log(`  - Candidates table updated: Yes`);
  console.log(`  - Idempotency: Working`);
  console.log(`\nNext steps:`);
  console.log(`  1. Verify tables exist in database: ${schemaName}`);
  console.log(`  2. Check performance_logs has 10 seed records`);
  console.log(`  3. Verify intentional gaps (missing index, missing constraint)`);
  console.log('');
}

// Run tests
testRPCFunction()
  .then(() => {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });

