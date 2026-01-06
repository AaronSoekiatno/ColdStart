import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkCandidateTokens() {
  console.log('🔍 Checking candidate provisioning tokens...\n');

  try {
    // Get all candidates with provisioning tokens
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, email, provisioning_token, assessment_repo_url, created_at')
      .not('provisioning_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching candidates:', error);
      return;
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  No candidates with provisioning tokens found.');
      console.log('\nThis means all candidate records were deleted or never had tokens generated.');
      console.log('To fix: Create a new assessment repository through the onboarding flow.');
      return;
    }

    console.log(`✅ Found ${candidates.length} candidate(s) with provisioning tokens:\n`);
    
    candidates.forEach((c, i) => {
      console.log(`${i + 1}. Email: ${c.email}`);
      console.log(`   Token: ${c.provisioning_token}`);
      console.log(`   Repo: ${c.assessment_repo_url || 'Not created'}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\n`);
    });

    // Check for the specific token from the error
    const errorToken = '2b803f4d-8396-4d2f-883d-16984e8e75c6';
    const matchingCandidate = candidates.find(c => c.provisioning_token === errorToken);
    
    if (matchingCandidate) {
      console.log(`✅ Token ${errorToken} belongs to ${matchingCandidate.email}`);
    } else {
      console.log(`❌ Token ${errorToken} NOT FOUND in database.`);
      console.log('   This token was likely from a deleted candidate record.');
      console.log('   Solution: Delete the old assessment repository and create a new one.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkCandidateTokens();
