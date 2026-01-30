import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeFailed() {
  console.log('='.repeat(80));
  console.log('Analyzing Failed GitHub Syncs');
  console.log('='.repeat(80));

  // Get all candidates with GitHub connected
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, email, name, github_username, github_access_token')
    .not('github_access_token', 'is', null)
    .not('github_username', 'is', null);

  if (error) {
    console.error('Failed to fetch candidates:', error);
    process.exit(1);
  }

  console.log(`\nTotal candidates with GitHub: ${candidates?.length || 0}\n`);

  // For each candidate, check if they have repositories
  const candidatesWithoutRepos = [];
  const candidatesWithRepos = [];

  for (const candidate of candidates || []) {
    const { data: repos, error: repoError } = await supabase
      .from('github_repositories')
      .select('id')
      .eq('candidate_id', candidate.id);

    if (repoError) {
      console.error(`Error checking repos for ${candidate.github_username}:`, repoError);
      continue;
    }

    const repoCount = repos?.length || 0;

    if (repoCount === 0) {
      candidatesWithoutRepos.push(candidate);
      console.log(`❌ ${candidate.github_username} (${candidate.email}) - 0 repos`);
    } else {
      candidatesWithRepos.push({ ...candidate, repoCount });
      console.log(`✓ ${candidate.github_username} (${candidate.email}) - ${repoCount} repos`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total candidates with GitHub: ${candidates?.length || 0}`);
  console.log(`Candidates with repositories: ${candidatesWithRepos.length}`);
  console.log(`Candidates WITHOUT repositories: ${candidatesWithoutRepos.length}`);
  
  if (candidatesWithoutRepos.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('Candidates Without Repositories (Failed Syncs)');
    console.log('='.repeat(80));
    candidatesWithoutRepos.forEach((c, i) => {
      console.log(`${i + 1}. ${c.github_username} (${c.email})`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Token exists: ${c.github_access_token ? 'YES' : 'NO'}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));
}

analyzeFailed().catch(console.error);
