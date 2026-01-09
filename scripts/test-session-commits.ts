/**
 * Test script for session commits RPC function
 * 
 * Usage: npx tsx scripts/test-session-commits.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSessionCommits() {
  console.log('🧪 Testing session commits RPC function...\n');
  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('');

  const testData = {
    p_candidate_id: 'test-user-' + Date.now(),
    p_event: 'push',
    p_added_lines: 42,
    p_deleted_lines: 13,
    p_commit_message: 'Test commit: Added authentication feature',
    p_repo_name: 'hermes-assessment-test',
    p_commit_hash: 'abc123def456' + Date.now(),
    p_commit_author: 'Test User',
    p_commit_timestamp: new Date().toISOString(),
    p_snapshot_storage_path: null, // No actual snapshot for test
    p_snapshot_size_bytes: null,
  };

  console.log('📤 Calling log_session_commit with test data:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  const { data, error } = await supabase.rpc('log_session_commit', testData);

  if (error) {
    console.error('❌ RPC call failed:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
    
    if (error.code === 'PGRST202') {
      console.error('\n💡 The function does not exist. You need to run the migration first:');
      console.error('   1. Go to Supabase Dashboard → SQL Editor');
      console.error('   2. Run the contents of: supabase/migrations/043_create_session_commits_table.sql');
    }
    
    process.exit(1);
  }

  console.log('✅ RPC call successful!');
  console.log('📦 Response:', JSON.stringify(data, null, 2));
  console.log('');

  // Query the table to verify
  console.log('🔍 Querying session_commits table to verify...');
  const { data: commits, error: queryError } = await supabase
    .from('session_commits')
    .select('*')
    .eq('candidate_github_username', testData.p_candidate_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (queryError) {
    console.error('❌ Query failed:', queryError.message);
    
    if (queryError.code === '42P01') {
      console.error('\n💡 The table does not exist. You need to run the migration first.');
    }
    
    process.exit(1);
  }

  if (!commits || commits.length === 0) {
    console.error('❌ No commits found in table after insert');
    process.exit(1);
  }

  console.log('✅ Found commit in database:');
  console.log('');
  console.log('📊 Session Commit Record:');
  console.log('   ID:', commits[0].id);
  console.log('   Candidate:', commits[0].candidate_github_username);
  console.log('   Repo:', commits[0].repo_name);
  console.log('   Event:', commits[0].event_type);
  console.log('   Commit Hash:', commits[0].commit_hash);
  console.log('   Added Lines:', commits[0].added_lines);
  console.log('   Deleted Lines:', commits[0].deleted_lines);
  console.log('   Net Lines:', commits[0].net_lines);
  console.log('   Message:', commits[0].commit_message);
  console.log('   Created At:', commits[0].created_at);
  console.log('');
  
  // Clean up test data
  console.log('🧹 Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('session_commits')
    .delete()
    .eq('candidate_github_username', testData.p_candidate_id);
  
  if (deleteError) {
    console.warn('⚠️  Could not clean up test data:', deleteError.message);
  } else {
    console.log('✅ Test data cleaned up');
  }
  
  console.log('');
  console.log('🎉 All tests passed! Session commits system is working.');
}

testSessionCommits().catch(console.error);
