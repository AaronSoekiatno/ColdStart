/**
 * Remove Work at a Startup Links from Jobs Table
 *
 * This script:
 * 1. Finds all jobs with workatastartup.com URLs
 * 2. Sets their job_url to NULL
 *
 * Usage:
 *   npx tsx scripts/remove-workatastartup-links.ts
 *   npx tsx scripts/remove-workatastartup-links.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🚀 Remove Work at a Startup Links from Jobs Table');
  console.log('='.repeat(60));
  if (dryRun) console.log('⚠️  DRY RUN MODE - No changes will be made');
  console.log('='.repeat(60));

  // Find all jobs with workatastartup.com URLs
  console.log('\n📥 Finding jobs with workatastartup.com URLs...');

  const { data: jobs, error: fetchError } = await supabase
    .from('jobs')
    .select('id, job_title, company_name, job_url')
    .like('job_url', '%workatastartup.com%');

  if (fetchError) {
    console.error('❌ Error fetching jobs:', fetchError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('✅ No workatastartup.com URLs found in the jobs table');
    process.exit(0);
  }

  console.log(`✓ Found ${jobs.length} jobs with workatastartup.com URLs`);

  // Show sample of jobs that will be updated
  console.log('\n📋 Sample of jobs to be updated:');
  jobs.slice(0, 10).forEach((job, index) => {
    console.log(`   ${index + 1}. ${job.company_name} - ${job.job_title}`);
    console.log(`      Current URL: ${job.job_url}`);
  });

  if (jobs.length > 10) {
    console.log(`   ... and ${jobs.length - 10} more`);
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - Would set job_url to NULL for these jobs');
    console.log(`Total jobs that would be updated: ${jobs.length}`);
    console.log('\nRun without --dry-run to apply changes');
    process.exit(0);
  }

  // Update all jobs with workatastartup.com URLs to NULL
  console.log('\n🔄 Updating jobs...');

  const { error: updateError, count } = await supabase
    .from('jobs')
    .update({ job_url: null })
    .like('job_url', '%workatastartup.com%');

  if (updateError) {
    console.error('❌ Error updating jobs:', updateError);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ UPDATE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Jobs updated: ${jobs.length}`);
  console.log('All workatastartup.com URLs have been set to NULL');
  console.log('='.repeat(60));
}

main().catch(console.error);
