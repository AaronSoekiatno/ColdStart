import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MatchStats {
  totalMatches: number;
  matchesOlderThan30Days: number;
  matchesOlderThan60Days: number;
  matchesOlderThan90Days: number;
  oldestMatchDate: string;
  newestMatchDate: string;
}

async function analyzeMatches(): Promise<MatchStats> {
  console.log('📊 Analyzing matches table...\n');

  // Get total count
  const { count: totalMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  // Get matches older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { count: matchesOlderThan30Days } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .lt('matched_at', thirtyDaysAgo.toISOString());

  // Get matches older than 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const { count: matchesOlderThan60Days } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .lt('matched_at', sixtyDaysAgo.toISOString());

  // Get matches older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { count: matchesOlderThan90Days } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .lt('matched_at', ninetyDaysAgo.toISOString());

  // Get date range
  const { data: dateRange } = await supabase
    .from('matches')
    .select('matched_at')
    .order('matched_at', { ascending: true })
    .limit(1);

  const { data: newestMatch } = await supabase
    .from('matches')
    .select('matched_at')
    .order('matched_at', { ascending: false })
    .limit(1);

  return {
    totalMatches: totalMatches || 0,
    matchesOlderThan30Days: matchesOlderThan30Days || 0,
    matchesOlderThan60Days: matchesOlderThan60Days || 0,
    matchesOlderThan90Days: matchesOlderThan90Days || 0,
    oldestMatchDate: dateRange?.[0]?.matched_at || 'N/A',
    newestMatchDate: newestMatch?.[0]?.matched_at || 'N/A',
  };
}

async function archiveMatches(daysOld: number): Promise<void> {
  console.log(`\n📦 Archiving matches older than ${daysOld} days...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Fetch old matches
  const { data: oldMatches, error } = await supabase
    .from('matches')
    .select('*')
    .lt('matched_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error fetching matches for archive:', error);
    return;
  }

  if (!oldMatches || oldMatches.length === 0) {
    console.log('✅ No matches to archive');
    return;
  }

  // Save to archive table (you'll need to create this table)
  const { error: archiveError } = await supabase
    .from('matches_archive')
    .insert(oldMatches.map(match => ({
      ...match,
      archived_at: new Date().toISOString()
    })));

  if (archiveError) {
    console.error('Error archiving matches:', archiveError);
    console.log('💡 You may need to create the matches_archive table first');
    return;
  }

  console.log(`✅ Archived ${oldMatches.length} matches`);
}

async function deleteOldMatches(daysOld: number, skipArchive: boolean = false): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  console.log(`\n🗑️  Deleting matches older than ${daysOld} days (before ${cutoffDate.toISOString().split('T')[0]})...`);

  // Archive first if requested
  if (!skipArchive) {
    await archiveMatches(daysOld);
  }

  // Delete old matches
  const { data, error } = await supabase
    .from('matches')
    .delete()
    .lt('matched_at', cutoffDate.toISOString())
    .select();

  if (error) {
    console.error('Error deleting matches:', error);
    return 0;
  }

  const deletedCount = data?.length || 0;
  console.log(`✅ Deleted ${deletedCount} matches`);

  return deletedCount;
}

async function main() {
  console.log('🧹 Hermes Matches Cleanup Tool\n');
  console.log('=' .repeat(50));

  // Analyze current state
  const stats = await analyzeMatches();

  console.log('Current Matches Statistics:');
  console.log(`  Total matches: ${stats.totalMatches.toLocaleString()}`);
  console.log(`  Oldest match: ${stats.oldestMatchDate}`);
  console.log(`  Newest match: ${stats.newestMatchDate}`);
  console.log();
  console.log('Cleanup Opportunities:');
  console.log(`  Matches older than 30 days: ${stats.matchesOlderThan30Days.toLocaleString()}`);
  console.log(`  Matches older than 60 days: ${stats.matchesOlderThan60Days.toLocaleString()}`);
  console.log(`  Matches older than 90 days: ${stats.matchesOlderThan90Days.toLocaleString()}`);
  console.log();
  console.log('Estimated space savings (matches table only):');
  console.log(`  Delete 30+ days: ~${(stats.matchesOlderThan30Days * 0.07 / 1024).toFixed(2)} MB`);
  console.log(`  Delete 60+ days: ~${(stats.matchesOlderThan60Days * 0.07 / 1024).toFixed(2)} MB`);
  console.log(`  Delete 90+ days: ~${(stats.matchesOlderThan90Days * 0.07 / 1024).toFixed(2)} MB`);
  console.log();
  console.log('=' .repeat(50));

  // Get command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipArchive = args.includes('--skip-archive');
  const daysArg = args.find(arg => arg.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : null;

  if (!days) {
    console.log('\n📖 Usage:');
    console.log('  npm run cleanup:matches -- --days=90 [--dry-run] [--skip-archive]');
    console.log();
    console.log('Options:');
    console.log('  --days=N         Delete matches older than N days (required)');
    console.log('  --dry-run        Show what would be deleted without actually deleting');
    console.log('  --skip-archive   Skip archiving before deletion');
    console.log();
    console.log('Examples:');
    console.log('  npm run cleanup:matches -- --days=90 --dry-run');
    console.log('  npm run cleanup:matches -- --days=60 --skip-archive');
    console.log('  npm run cleanup:matches -- --days=30');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would delete ${
      days <= 30 ? stats.matchesOlderThan30Days :
      days <= 60 ? stats.matchesOlderThan60Days :
      stats.matchesOlderThan90Days
    } matches older than ${days} days`);
    console.log('✅ No changes made (dry run)');
    return;
  }

  // Confirm deletion
  console.log(`\n⚠️  WARNING: This will permanently delete matches older than ${days} days`);
  console.log(`   This action will remove approximately ${
    days <= 30 ? stats.matchesOlderThan30Days :
    days <= 60 ? stats.matchesOlderThan60Days :
    stats.matchesOlderThan90Days
  } matches`);
  console.log();
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const deletedCount = await deleteOldMatches(days, skipArchive);

  console.log();
  console.log('=' .repeat(50));
  console.log('✅ Cleanup complete!');
  console.log(`   Deleted: ${deletedCount.toLocaleString()} matches`);
  console.log(`   Estimated space freed: ~${(deletedCount * 0.07 / 1024).toFixed(2)} MB`);
  console.log();
  console.log('💡 Next steps:');
  console.log('   - Run VACUUM on your database to reclaim space');
  console.log('   - Consider setting up a cron job to run this regularly');
  console.log('   - Check related tables (jobs, candidates) for additional cleanup');
}

main().catch(console.error);
