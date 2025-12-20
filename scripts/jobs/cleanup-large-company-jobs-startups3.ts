/**
 * Cleanup Large Company Jobs (Startups3)
 * Removes jobs from companies with ≥50 employees based on startups3 table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseTeamSize(teamSize: string | null): number | null {
  if (!teamSize) return null;

  // Handle ranges like "10-50", "50-200", "200+"
  const match = teamSize.match(/(\d+)(?:-(\d+)|\+)?/);
  if (!match) return null;

  const min = parseInt(match[1]);
  const max = match[2] ? parseInt(match[2]) : min;

  // For "200+", treat as max value
  if (teamSize.includes('+')) {
    return min;
  }

  // Return max value of range
  return max;
}

async function cleanupLargeCompanyJobs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🧹 Cleanup Large Company Jobs (Startups3)');
  console.log('='.repeat(70));
  if (dryRun) console.log('⚠️  DRY RUN MODE - No changes will be made');
  console.log('='.repeat(70));

  // 1. Fetch all startups from startups3 with team_size (with pagination)
  console.log('\n📥 Fetching startups with team_size data from startups3...');

  let allStartups: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('startups3')
      .select('id, name, team_size')
      .not('team_size', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching startups3:', error);
      return;
    }

    if (data && data.length > 0) {
      allStartups = allStartups.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const startups = allStartups;
  console.log(`✓ Found ${startups.length} startups with team_size data\n`);

  // 2. Identify large companies (>50 employees)
  const largeCompanies = startups?.filter(s => {
    const size = parseTeamSize(s.team_size);
    return size !== null && size > 50;
  }) || [];

  console.log(`🔴 Identified ${largeCompanies.length} companies with >50 employees\n`);

  if (largeCompanies.length === 0) {
    console.log('✓ No large companies found. Nothing to clean up!');
    return;
  }

  // 3. Get job counts for each large company
  let totalJobsToDelete = 0;
  const companyJobCounts: Array<{ company: string; teamSize: string; jobIds: string[] }> = [];

  for (const company of largeCompanies) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, job_title')
      .or(`startup_id.eq.${company.id},company_name.eq.${company.name}`);

    if (jobs && jobs.length > 0) {
      totalJobsToDelete += jobs.length;
      companyJobCounts.push({
        company: company.name,
        teamSize: company.team_size!,
        jobIds: jobs.map(j => j.id)
      });

      console.log(`${company.name} (${company.team_size}): ${jobs.length} jobs`);
    }
  }

  console.log(`\n📊 Total jobs to delete: ${totalJobsToDelete}\n`);

  if (totalJobsToDelete === 0) {
    console.log('✓ No jobs found for large companies. Nothing to clean up!');
    return;
  }

  // 4. Delete jobs
  if (dryRun) {
    console.log('='.repeat(70));
    console.log('🔍 DRY RUN - Would delete these jobs:\n');

    companyJobCounts.forEach(company => {
      console.log(`${company.company} (${company.teamSize}):`);
      console.log(`  ${company.jobIds.length} jobs would be deleted\n`);
    });

    console.log('='.repeat(70));
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('Remove --dry-run flag to apply deletions');
  } else {
    console.log('='.repeat(70));
    console.log('🗑️  Deleting jobs...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const company of companyJobCounts) {
      console.log(`Deleting ${company.jobIds.length} jobs from ${company.company}...`);

      const { error } = await supabase
        .from('jobs')
        .delete()
        .in('id', company.jobIds);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✓ Deleted ${company.jobIds.length} jobs`);
        deletedCount += company.jobIds.length;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(70));
    console.log(`Jobs deleted: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(70));
  }
}

cleanupLargeCompanyJobs().catch(console.error);
