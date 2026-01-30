import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// List of failed candidate IDs from the analysis
const failedCandidateIds = [
  '1b1abf84-be36-4449-972c-91ed7e223a29', // dhawankunsh-prog
  '72742ff2-489b-4090-a915-5b71336765a8', // kalashjain03
  '4183c244-7984-4410-b554-0d207dace1ca', // SanikaMogal09
  'de933312-62c5-46fc-903c-e24cc5e8f12c', // ykburra-cyber
  '16050c25-1ae8-4eee-8317-d427f5ff231e', // yidnekachewyabsera2028
  '96f101a3-d3f5-47c9-aa08-f3317479aa3d', // lilmilo2704
  'ca8b7c27-3c04-4ff6-b32a-ac0baedf28ff', // byteninja010
  '6fa6926c-0cdd-4805-a74c-e05e990eeb89', // AA-rya
  '2759c60d-d6a1-4284-95de-cffc63108a0b', // hema125-creator
  'fd478afc-47e5-4a58-a1af-6f205cf8853e', // BingxuanY
  'b97072a5-27be-409a-aafd-7d0178412bac', // yhvxqd6mh2-sketch
  '8ab6e9de-6384-459b-80db-74fd100fbaba', // aar290
  '94881713-50a1-4bf2-872e-4f1fd4277d27', // jliao35-droid
  'd6486f3f-3028-47be-ab73-48c60f657f0f', // sank3t9
  '970563a6-6414-4ba8-909f-d78d6052cb80', // Bromano2911
  '8ed6936d-c7df-4c5f-940f-428d978b08d7', // Acetyl-CoA-29
  '5720c873-f025-4b28-9967-858d055fa73d', // Nickn2137
  '8b50c904-da40-45d1-84df-6ef616fdc397', // fmaatoug-lab
  '6ce8084b-8718-498a-b7cd-293202606e8b', // jainkalash345-dev
  'b206aa10-64b0-4e37-9a1a-2d6fc92f14f3', // Aidan1223f (you!)
];

async function diagnoseFailure(candidateId: string, githubUsername: string, githubAccessToken: string) {
  const octokit = new Octokit({
    auth: githubAccessToken,
  });

  try {
    // Test 1: Check if token is valid by getting authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`  ✓ Token is valid, authenticated as: ${user.login}`);

    // Test 2: Check if username matches
    if (user.login !== githubUsername) {
      console.log(`  ⚠️  Username mismatch! Stored: ${githubUsername}, Actual: ${user.login}`);
    }

    // Test 3: Try to fetch repositories
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      affiliation: 'owner',
    });

    console.log(`  ℹ️  Found ${repos.length} repositories with affiliation='owner'`);

    if (repos.length === 0) {
      // Try with different affiliations
      const { data: allRepos } = await octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
      });
      console.log(`  ℹ️  Found ${allRepos.length} repositories without affiliation filter`);
      
      if (allRepos.length > 0) {
        console.log(`  ⚠️  User has repos but they're not owned (likely collaborator/org repos)`);
        return { status: 'NO_OWNED_REPOS', repoCount: allRepos.length };
      } else {
        console.log(`  ℹ️  User genuinely has no repositories`);
        return { status: 'EMPTY_ACCOUNT', repoCount: 0 };
      }
    }

    return { status: 'HAS_REPOS', repoCount: repos.length };
  } catch (error: any) {
    if (error.status === 401) {
      console.log(`  ❌ Token is invalid or expired (401 Unauthorized)`);
      return { status: 'INVALID_TOKEN', error: error.message };
    } else if (error.status === 403) {
      console.log(`  ❌ Rate limit exceeded or insufficient permissions (403 Forbidden)`);
      return { status: 'RATE_LIMIT_OR_PERMISSIONS', error: error.message };
    } else {
      console.log(`  ❌ Error: ${error.message}`);
      return { status: 'ERROR', error: error.message };
    }
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('Diagnosing Failed GitHub Syncs');
  console.log('='.repeat(80));

  // Fetch failed candidates
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, email, name, github_username, github_access_token')
    .in('id', failedCandidateIds);

  if (error) {
    console.error('Failed to fetch candidates:', error);
    process.exit(1);
  }

  console.log(`\nDiagnosing ${candidates?.length || 0} failed candidates\n`);

  const results = {
    INVALID_TOKEN: [] as string[],
    RATE_LIMIT_OR_PERMISSIONS: [] as string[],
    NO_OWNED_REPOS: [] as string[],
    EMPTY_ACCOUNT: [] as string[],
    HAS_REPOS: [] as string[],
    ERROR: [] as string[],
  };

  for (const candidate of candidates || []) {
    console.log(`\n${candidate.github_username} (${candidate.email})`);
    const result = await diagnoseFailure(
      candidate.id,
      candidate.github_username,
      candidate.github_access_token
    );

    results[result.status].push(candidate.github_username);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('Diagnosis Summary');
  console.log('='.repeat(80));
  console.log(`Invalid/Expired Tokens: ${results.INVALID_TOKEN.length}`);
  if (results.INVALID_TOKEN.length > 0) {
    results.INVALID_TOKEN.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log(`\nRate Limited/Permission Issues: ${results.RATE_LIMIT_OR_PERMISSIONS.length}`);
  if (results.RATE_LIMIT_OR_PERMISSIONS.length > 0) {
    results.RATE_LIMIT_OR_PERMISSIONS.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log(`\nNo Owned Repos (only collaborator): ${results.NO_OWNED_REPOS.length}`);
  if (results.NO_OWNED_REPOS.length > 0) {
    results.NO_OWNED_REPOS.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log(`\nEmpty Accounts (no repos at all): ${results.EMPTY_ACCOUNT.length}`);
  if (results.EMPTY_ACCOUNT.length > 0) {
    results.EMPTY_ACCOUNT.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log(`\nActually Has Repos (unexpected!): ${results.HAS_REPOS.length}`);
  if (results.HAS_REPOS.length > 0) {
    results.HAS_REPOS.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log(`\nOther Errors: ${results.ERROR.length}`);
  if (results.ERROR.length > 0) {
    results.ERROR.forEach(u => console.log(`  - ${u}`));
  }
  
  console.log('='.repeat(80));
}

main().catch(console.error);
