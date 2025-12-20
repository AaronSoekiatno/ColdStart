/**
 * Analyze Startups3 Data Quality
 * Identifies startups missing team_size data and analyzes job counts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeDataQuality() {
  console.log('🔍 Analyzing Startups3 Data Quality\n');
  console.log('='.repeat(70));

  // 1. Fetch all startups from startups3 (pagination to handle >1000 records)
  console.log('\n📥 Fetching all startups from startups3 table...');

  let allStartups: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('startups3')
      .select('id, name, team_size, batch, industry')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching startups3:', error);
      return;
    }

    if (data && data.length > 0) {
      allStartups = allStartups.concat(data);
      console.log(`   Fetched ${data.length} startups (page ${page + 1})...`);
      hasMore = data.length === pageSize; // Continue if we got a full page
      page++;
    } else {
      hasMore = false;
    }
  }

  const startups = allStartups;
  console.log(`\n📊 Total Startups Fetched: ${startups.length}\n`);

  // 2. Analyze team_size data
  const withTeamSize = startups?.filter(s => s.team_size) || [];
  const withoutTeamSize = startups?.filter(s => !s.team_size) || [];

  console.log('Team Size Data:');
  console.log(`  ✓ With team_size: ${withTeamSize.length}`);
  console.log(`  ❌ Missing team_size: ${withoutTeamSize.length}`);
  console.log(`  📈 Coverage: ${((withTeamSize.length / (startups?.length || 1)) * 100).toFixed(1)}%\n`);

  // 3. Parse team_size values to identify companies >50 employees
  const parseTeamSize = (teamSize: string | null): number | null => {
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
  };

  const largeCompanies = withTeamSize.filter(s => {
    const size = parseTeamSize(s.team_size);
    return size !== null && size > 50;
  });

  const smallCompanies = withTeamSize.filter(s => {
    const size = parseTeamSize(s.team_size);
    return size !== null && size <= 50;
  });

  console.log('Team Size Distribution (for those with data):');
  console.log(`  🟢 ≤50 employees: ${smallCompanies.length}`);
  console.log(`  🔴 >50 employees: ${largeCompanies.length}\n`);

  // 4. Fetch all jobs and group by company (with pagination)
  console.log('📥 Fetching all jobs from database...');

  let allJobs: any[] = [];
  page = 0;
  hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, company_name, startup_id, job_title')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching jobs:', error);
      return;
    }

    if (data && data.length > 0) {
      allJobs = allJobs.concat(data);
      console.log(`   Fetched ${data.length} jobs (page ${page + 1})...`);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const jobs = allJobs;
  console.log(`\n📋 Total Jobs Fetched: ${jobs.length}\n`);

  // Group jobs by startup
  const jobsByStartup: Record<string, any[]> = {};
  jobs?.forEach(job => {
    const key = job.startup_id || job.company_name;
    if (!jobsByStartup[key]) {
      jobsByStartup[key] = [];
    }
    jobsByStartup[key].push(job);
  });

  // 5. Match jobs to startups3 and identify issues
  const startupsWithJobs = Object.keys(jobsByStartup).length;
  let jobsFromLargeCompanies = 0;
  let jobsFromUnknownSize = 0;
  let jobsFromSmallCompanies = 0;

  const largeCompanyJobs: any[] = [];
  const unknownSizeCompanyJobs: any[] = [];

  Object.entries(jobsByStartup).forEach(([startupKey, startupJobs]) => {
    // Find the startup in startups3
    const startup = startups?.find(s =>
      s.id === startupKey || s.name === startupKey || s.name === startupJobs[0]?.company_name
    );

    if (!startup) {
      jobsFromUnknownSize += startupJobs.length;
      unknownSizeCompanyJobs.push({
        company: startupJobs[0]?.company_name,
        jobCount: startupJobs.length,
        reason: 'Startup not found in startups3 table'
      });
      return;
    }

    if (!startup.team_size) {
      jobsFromUnknownSize += startupJobs.length;
      unknownSizeCompanyJobs.push({
        company: startup.name,
        jobCount: startupJobs.length,
        reason: 'Missing team_size data'
      });
      return;
    }

    const size = parseTeamSize(startup.team_size);
    if (size === null) {
      jobsFromUnknownSize += startupJobs.length;
      unknownSizeCompanyJobs.push({
        company: startup.name,
        jobCount: startupJobs.length,
        reason: `Invalid team_size format: "${startup.team_size}"`
      });
      return;
    }

    if (size > 50) {
      jobsFromLargeCompanies += startupJobs.length;
      largeCompanyJobs.push({
        company: startup.name,
        teamSize: startup.team_size,
        jobCount: startupJobs.length,
        jobs: startupJobs.map(j => j.job_title)
      });
    } else {
      jobsFromSmallCompanies += startupJobs.length;
    }
  });

  console.log('='.repeat(70));
  console.log('📊 JOB DISTRIBUTION BY COMPANY SIZE\n');
  console.log(`Jobs from companies with ≤50 employees: ${jobsFromSmallCompanies} ✓`);
  console.log(`Jobs from companies with >50 employees: ${jobsFromLargeCompanies} ❌`);
  console.log(`Jobs from companies with unknown size: ${jobsFromUnknownSize} ⚠️\n`);

  // 6. Show problematic companies
  if (largeCompanyJobs.length > 0) {
    console.log('='.repeat(70));
    console.log('🔴 COMPANIES >50 EMPLOYEES (SHOULD BE REMOVED)\n');
    largeCompanyJobs
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 20)
      .forEach(company => {
        console.log(`${company.company} (${company.teamSize})`);
        console.log(`  Jobs: ${company.jobCount}`);
        console.log(`  Sample: ${company.jobs.slice(0, 2).join(', ')}${company.jobs.length > 2 ? '...' : ''}\n`);
      });

    if (largeCompanyJobs.length > 20) {
      console.log(`... and ${largeCompanyJobs.length - 20} more companies\n`);
    }
  }

  if (unknownSizeCompanyJobs.length > 0) {
    console.log('='.repeat(70));
    console.log('⚠️  COMPANIES WITH UNKNOWN SIZE (NEED ENRICHMENT)\n');
    unknownSizeCompanyJobs
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 20)
      .forEach(company => {
        console.log(`${company.company}`);
        console.log(`  Jobs: ${company.jobCount}`);
        console.log(`  Issue: ${company.reason}\n`);
      });

    if (unknownSizeCompanyJobs.length > 20) {
      console.log(`... and ${unknownSizeCompanyJobs.length - 20} more companies\n`);
    }
  }

  // 7. Summary and recommendations
  console.log('='.repeat(70));
  console.log('💡 RECOMMENDATIONS\n');

  if (largeCompanyJobs.length > 0) {
    console.log(`1. ❌ Delete ${jobsFromLargeCompanies} jobs from ${largeCompanyJobs.length} companies >50 employees`);
    console.log(`   Run: npx tsx scripts/cleanup-large-company-jobs-startups3.ts\n`);
  }

  if (unknownSizeCompanyJobs.length > 0) {
    console.log(`2. ⚠️  Enrich ${withoutTeamSize.length} startups missing team_size data`);
    console.log(`   This affects ${jobsFromUnknownSize} jobs`);
    console.log(`   Manual enrichment needed for startups3\n`);
  }

  console.log(`3. ✓ Add validation to job scrapers to check team_size before scraping`);
  console.log(`   This prevents future large company jobs from being added\n`);

  console.log('='.repeat(70));

  // 8. Show sample of missing team_size companies
  if (withoutTeamSize.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('📝 SAMPLE OF STARTUPS MISSING TEAM_SIZE (First 10)\n');
    withoutTeamSize.slice(0, 10).forEach(s => {
      console.log(`  - ${s.name} (${s.batch || 'No batch'})`);
    });
    if (withoutTeamSize.length > 10) {
      console.log(`\n  ... and ${withoutTeamSize.length - 10} more`);
    }
    console.log('\n' + '='.repeat(70));
  }
}

analyzeDataQuality().catch(console.error);
