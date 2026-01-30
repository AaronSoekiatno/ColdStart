// Test script to verify github_repositories insert
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('1. Skipping schema check (requires admin query)...');

  console.log('\n2. Finding a test candidate...');
  const { data: candidates, error: candidateError } = await supabase
    .from('candidates')
    .select('id, email, github_username')
    .not('github_access_token', 'is', null)
    .limit(1)
    .single();

  if (candidateError) {
    console.error('Candidate fetch error:', candidateError);
    return;
  }

  console.log('Test candidate:', candidates);

  console.log('\n3. Attempting to insert test repository...');
  const testRepo = {
    candidate_id: candidates.id,
    github_repo_id: 999999999, // Fake ID for testing
    name: 'test-repo',
    full_name: 'test/test-repo',
    html_url: 'https://github.com/test/test-repo',
    description: 'Test repository',
    language: 'JavaScript',
    languages: { JavaScript: 1000 },
    topics: ['test'],
    is_private: false,
    is_fork: false,
    is_archived: false,
    stargazers_count: 0,
    forks_count: 0,
    watchers_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pushed_at: new Date().toISOString(),
    size: 100,
    default_branch: 'main',
    homepage: null,
    license_name: null,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
    has_pages: false,
    full_data: { test: true },
    synced_at: new Date().toISOString(),
    is_selected: false,
    category_tags: []
  };

  const { data, error } = await supabase
    .from('github_repositories')
    .upsert(testRepo, {
      onConflict: 'candidate_id,github_repo_id',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    console.error('\n❌ INSERT FAILED:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
  } else {
    console.log('\n✅ INSERT SUCCESSFUL:');
    console.log('Inserted data:', data);

    // Clean up test data
    console.log('\n4. Cleaning up test data...');
    await supabase
      .from('github_repositories')
      .delete()
      .eq('github_repo_id', 999999999);
    console.log('Test data cleaned up');
  }
}

testInsert().catch(console.error);