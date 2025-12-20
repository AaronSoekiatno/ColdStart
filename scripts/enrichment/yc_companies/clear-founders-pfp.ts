import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
const currentDir = process.cwd();
const parentDir = resolve(currentDir, '..');
const envPath = resolve(currentDir, '.env.local');
const parentEnvPath = resolve(parentDir, '.env.local');

// Try parent directory first (if running from yc_companies folder)
const result = config({ path: parentEnvPath }) || config({ path: envPath });
if (!result.parsed || Object.keys(result.parsed).length === 0) {
  console.warn('⚠️  No environment variables loaded. Make sure .env.local exists in project root.');
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in .env.local');
}

if (!supabaseKey) {
  throw new Error('Missing Supabase Service Role Key. Set SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Clears all founders_pfp data from the startups table
 */
async function clearFoundersPfp() {
  console.log('🗑️  Clearing all founders_pfp data from startups table...\n');

  // Get count first
  const { count } = await supabase
    .from('startups3')
    .select('id', { count: 'exact', head: true })
    .not('founders_pfp', 'is', null);

  console.log(`📊 Found ${count || 0} startups with founders_pfp data\n`);

  if (!count || count === 0) {
    console.log('✅ No data to clear.');
    return;
  }

  // Clear all founders_pfp fields
  const { error } = await supabase
    .from('startups3')
    .update({ founders_pfp: null })
    .not('founders_pfp', 'is', null);

  if (error) {
    console.error('❌ Error clearing founders_pfp:', error);
    throw error;
  }

  console.log(`✅ Successfully cleared founders_pfp from ${count} startups`);
}

// Run the clear
clearFoundersPfp()
  .then(() => {
    console.log('\n✨ Clear complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });


