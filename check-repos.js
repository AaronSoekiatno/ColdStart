// Check if GitHub repos exist for a specific user
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

async function checkRepos() {
  // Get your email from command line or hardcode it
  const email = process.argv[2] || 'aidan.nt76@gmail.com';

  console.log(`\n🔍 Checking GitHub repos for: ${email}\n`);

  // 1. Find candidate
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, email, github_username, github_access_token, github_connected_at')
    .eq('email', email)
    .single();

  if (candidateError) {
    console.error('❌ Candidate not found:', candidateError.message);
    return;
  }

  console.log('✅ Candidate found:');
  console.log(`   ID: ${candidate.id}`);
  console.log(`   GitHub username: ${candidate.github_username || 'NOT SET'}`);
  console.log(`   GitHub connected: ${candidate.github_connected_at || 'NEVER'}`);
  console.log(`   Has access token: ${candidate.github_access_token ? 'YES' : 'NO'}`);

  // 2. Count repos
  const { count, error: countError } = await supabase
    .from('github_repositories')
    .select('*', { count: 'exact', head: true })
    .eq('candidate_id', candidate.id);

  if (countError) {
    console.error('\n❌ Error counting repos:', countError.message);
    return;
  }

  console.log(`\n📊 Total repos in database: ${count || 0}`);

  if (count === 0) {
    console.log('\n⚠️  NO REPOS FOUND IN DATABASE');
    console.log('\nPossible reasons:');
    console.log('1. Background sync from OAuth callback failed');
    console.log('2. User skipped repo selection in onboarding');
    console.log('3. Repos were never fetched from GitHub API');
    console.log('\nNext steps:');
    console.log('- Check application logs for sync errors');
    console.log('- Manually trigger sync via /api/candidate/github/repositories?refresh=true');
    return;
  }

  // 3. Show repo details
  const { data: repos, error: reposError } = await supabase
    .from('github_repositories')
    .select('name, full_name, is_selected, is_private, stargazers_count, synced_at, category_tags')
    .eq('candidate_id', candidate.id)
    .order('synced_at', { ascending: false })
    .limit(10);

  if (reposError) {
    console.error('\n❌ Error fetching repos:', reposError.message);
    return;
  }

  console.log('\n📦 Most recent repos:');
  repos.forEach((repo, i) => {
    console.log(`\n${i + 1}. ${repo.full_name}`);
    console.log(`   Selected: ${repo.is_selected ? '✅' : '❌'}`);
    console.log(`   Private: ${repo.is_private ? 'Yes' : 'No'}`);
    console.log(`   Stars: ${repo.stargazers_count}`);
    console.log(`   Categories: ${repo.category_tags?.length > 0 ? repo.category_tags.join(', ') : 'none'}`);
    console.log(`   Last synced: ${repo.synced_at || 'never'}`);
  });

  // 4. Count selected repos
  const { count: selectedCount } = await supabase
    .from('github_repositories')
    .select('*', { count: 'exact', head: true })
    .eq('candidate_id', candidate.id)
    .eq('is_selected', true);

  console.log(`\n✨ Selected repos: ${selectedCount || 0} out of ${count}`);
}

checkRepos().catch(console.error);
