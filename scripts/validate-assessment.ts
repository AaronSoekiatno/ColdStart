#!/usr/bin/env ts-node
/**
 * Assessment Validation Script
 *
 * Validates whether the notifications assessment tests the 3 dimensions:
 * 1. AI Leverage - Can they use AI critically, not blindly?
 * 2. Context Awareness - Do they understand codebase context?
 * 3. Validation - Do they test incrementally?
 *
 * Run: npx ts-node scripts/validate-assessment.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ValidationResult {
  metric: string;
  value: number | string;
  target: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  interpretation: string;
}

const results: ValidationResult[] = [];

async function runQuery<T>(name: string, query: string): Promise<T[]> {
  console.log(`\n🔍 Running query: ${name}`);
  const { data, error } = await supabase.rpc('execute_sql', { query_text: query });

  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return [];
  }

  return data as T[];
}

async function validateScoreVariance() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION 1: Score Variance (Differentiation)');
  console.log('='.repeat(80));

  const query = `
    SELECT
      STDDEV(total_score) as score_variance,
      AVG(total_score) as avg_score,
      MIN(total_score) as min_score,
      MAX(total_score) as max_score,
      COUNT(*) as total_assessments
    FROM admin_audit.assessment_scores
    WHERE created_at >= NOW() - INTERVAL '30 days';
  `;

  const data = await runQuery<{
    score_variance: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    total_assessments: number;
  }>(
    'Score Variance',
    query
  );

  if (data.length === 0 || data[0].total_assessments === 0) {
    console.log('⚠️  No assessment data found in the last 30 days');
    results.push({
      metric: 'Score Variance',
      value: 'N/A',
      target: '> 20',
      status: 'WARNING',
      interpretation: 'No data available for analysis'
    });
    return;
  }

  const variance = data[0].score_variance || 0;
  const avg = data[0].avg_score || 0;
  const min = data[0].min_score || 0;
  const max = data[0].max_score || 0;
  const count = data[0].total_assessments;

  console.log(`\n📈 Results:`);
  console.log(`  Total Assessments: ${count}`);
  console.log(`  Score Variance: ${variance.toFixed(2)}`);
  console.log(`  Average Score: ${avg.toFixed(2)}`);
  console.log(`  Min Score: ${min}`);
  console.log(`  Max Score: ${max}`);

  const status = variance > 20 ? 'PASS' : variance > 15 ? 'WARNING' : 'FAIL';
  let interpretation = '';

  if (variance > 20) {
    interpretation = 'Excellent differentiation - assessment clearly separates strong from weak candidates';
  } else if (variance > 15) {
    interpretation = 'Moderate differentiation - assessment provides some signal but could be stronger';
  } else {
    interpretation = 'Low differentiation - assessment may be too easy or too hard (everyone clusters around same score)';
  }

  results.push({
    metric: 'Score Variance',
    value: variance.toFixed(2),
    target: '> 20',
    status,
    interpretation
  });

  console.log(`\n${status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌'} ${interpretation}`);
}

async function validateTestIterationPattern() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 VALIDATION 2: Test Iteration Pattern');
  console.log('='.repeat(80));

  const query = `
    SELECT
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY test_run_count) as median_test_runs,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY test_run_count) as p25_test_runs,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY test_run_count) as p75_test_runs,
      AVG(test_run_count) as avg_test_runs,
      COUNT(*) as total_sessions
    FROM interview_sessions
    WHERE container_started_at >= NOW() - INTERVAL '30 days'
      AND test_run_count IS NOT NULL
      AND test_run_count > 0;
  `;

  const data = await runQuery<{
    median_test_runs: number;
    p25_test_runs: number;
    p75_test_runs: number;
    avg_test_runs: number;
    total_sessions: number;
  }>(
    'Test Iteration Pattern',
    query
  );

  if (data.length === 0 || data[0].total_sessions === 0) {
    console.log('⚠️  No session data found in the last 30 days');
    results.push({
      metric: 'Median Test Runs',
      value: 'N/A',
      target: '2-4',
      status: 'WARNING',
      interpretation: 'No data available for analysis'
    });
    return;
  }

  const median = data[0].median_test_runs || 0;
  const p25 = data[0].p25_test_runs || 0;
  const p75 = data[0].p75_test_runs || 0;
  const avg = data[0].avg_test_runs || 0;
  const count = data[0].total_sessions;

  console.log(`\n📈 Results:`);
  console.log(`  Total Sessions: ${count}`);
  console.log(`  Median Test Runs: ${median.toFixed(1)}`);
  console.log(`  25th Percentile: ${p25.toFixed(1)}`);
  console.log(`  75th Percentile: ${p75.toFixed(1)}`);
  console.log(`  Average Test Runs: ${avg.toFixed(1)}`);

  const status = median >= 2 && median <= 4 ? 'PASS' : median >= 1.5 && median <= 5 ? 'WARNING' : 'FAIL';
  let interpretation = '';

  if (median >= 2 && median <= 4) {
    interpretation = 'Ideal iteration pattern - forces candidates to iterate but not excessively';
  } else if (median < 2) {
    interpretation = 'Too few iterations - assessment may be too easy or candidates are not testing incrementally';
  } else if (median > 4) {
    interpretation = 'Too many iterations - assessment may be too difficult or traps are too subtle';
  }

  results.push({
    metric: 'Median Test Runs',
    value: median.toFixed(1),
    target: '2-4',
    status,
    interpretation
  });

  console.log(`\n${status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌'} ${interpretation}`);
}

async function validateTimeDistribution() {
  console.log('\n' + '='.repeat(80));
  console.log('⏱️  VALIDATION 3: Time Distribution');
  console.log('='.repeat(80));

  const query = `
    SELECT
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
        EXTRACT(EPOCH FROM (container_stopped_at - container_started_at))/60
      ) as median_minutes,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY
        EXTRACT(EPOCH FROM (container_stopped_at - container_started_at))/60
      ) as p25_minutes,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY
        EXTRACT(EPOCH FROM (container_stopped_at - container_started_at))/60
      ) as p75_minutes,
      AVG(EXTRACT(EPOCH FROM (container_stopped_at - container_started_at))/60) as avg_minutes,
      COUNT(*) as total_sessions
    FROM interview_sessions
    WHERE container_stopped_at IS NOT NULL
      AND container_started_at >= NOW() - INTERVAL '30 days';
  `;

  const data = await runQuery<{
    median_minutes: number;
    p25_minutes: number;
    p75_minutes: number;
    avg_minutes: number;
    total_sessions: number;
  }>(
    'Time Distribution',
    query
  );

  if (data.length === 0 || data[0].total_sessions === 0) {
    console.log('⚠️  No completed session data found in the last 30 days');
    results.push({
      metric: 'Median Time (minutes)',
      value: 'N/A',
      target: '15-18',
      status: 'WARNING',
      interpretation: 'No data available for analysis'
    });
    return;
  }

  const median = data[0].median_minutes || 0;
  const p25 = data[0].p25_minutes || 0;
  const p75 = data[0].p75_minutes || 0;
  const avg = data[0].avg_minutes || 0;
  const count = data[0].total_sessions;

  console.log(`\n📈 Results:`);
  console.log(`  Total Completed Sessions: ${count}`);
  console.log(`  Median Time: ${median.toFixed(1)} minutes`);
  console.log(`  25th Percentile: ${p25.toFixed(1)} minutes`);
  console.log(`  75th Percentile: ${p75.toFixed(1)} minutes`);
  console.log(`  Average Time: ${avg.toFixed(1)} minutes`);

  const status = median >= 15 && median <= 18 ? 'PASS' : median >= 12 && median <= 20 ? 'WARNING' : 'FAIL';
  let interpretation = '';

  if (median >= 15 && median <= 18) {
    interpretation = 'Ideal time usage - candidates use most of the 20-minute limit';
  } else if (median < 15) {
    interpretation = 'Sessions completing too quickly - assessment may be too easy or candidates are giving up early';
  } else if (median > 18) {
    interpretation = 'Sessions using full time limit - good difficulty but monitor for frustration';
  }

  results.push({
    metric: 'Median Time (minutes)',
    value: median.toFixed(1),
    target: '15-18',
    status,
    interpretation
  });

  console.log(`\n${status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌'} ${interpretation}`);
}

async function validatePassRate() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 VALIDATION 4: Pass Rate (Appropriate Difficulty)');
  console.log('='.repeat(80));

  const query = `
    SELECT
      COUNT(*) FILTER (WHERE last_test_score >= 80) as high_scores,
      COUNT(*) FILTER (WHERE last_test_score >= 60 AND last_test_score < 80) as medium_scores,
      COUNT(*) FILTER (WHERE last_test_score < 60) as low_scores,
      COUNT(*) as total,
      (COUNT(*) FILTER (WHERE last_test_score >= 80)::float / NULLIF(COUNT(*), 0)) * 100 as pass_rate
    FROM interview_sessions
    WHERE last_test_score IS NOT NULL
      AND container_started_at >= NOW() - INTERVAL '30 days';
  `;

  const data = await runQuery<{
    high_scores: number;
    medium_scores: number;
    low_scores: number;
    total: number;
    pass_rate: number;
  }>(
    'Pass Rate',
    query
  );

  if (data.length === 0 || data[0].total === 0) {
    console.log('⚠️  No scored session data found in the last 30 days');
    results.push({
      metric: 'Pass Rate (%)',
      value: 'N/A',
      target: '40-60%',
      status: 'WARNING',
      interpretation: 'No data available for analysis'
    });
    return;
  }

  const highScores = data[0].high_scores || 0;
  const mediumScores = data[0].medium_scores || 0;
  const lowScores = data[0].low_scores || 0;
  const total = data[0].total;
  const passRate = data[0].pass_rate || 0;

  console.log(`\n📈 Results:`);
  console.log(`  Total Scored Sessions: ${total}`);
  console.log(`  High Scores (≥80): ${highScores} (${((highScores/total)*100).toFixed(1)}%)`);
  console.log(`  Medium Scores (60-79): ${mediumScores} (${((mediumScores/total)*100).toFixed(1)}%)`);
  console.log(`  Low Scores (<60): ${lowScores} (${((lowScores/total)*100).toFixed(1)}%)`);
  console.log(`  Pass Rate (≥80): ${passRate.toFixed(1)}%`);

  const status = passRate >= 40 && passRate <= 60 ? 'PASS' : passRate >= 30 && passRate <= 70 ? 'WARNING' : 'FAIL';
  let interpretation = '';

  if (passRate >= 40 && passRate <= 60) {
    interpretation = 'Ideal difficulty - assessment appropriately challenging';
  } else if (passRate > 70) {
    interpretation = 'Too easy - most candidates passing, reducing differentiation';
  } else if (passRate < 30) {
    interpretation = 'Too difficult - most candidates failing, may need to ease traps or provide better hints';
  }

  results.push({
    metric: 'Pass Rate (%)',
    value: passRate.toFixed(1),
    target: '40-60%',
    status,
    interpretation
  });

  console.log(`\n${status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌'} ${interpretation}`);
}

async function analyzeTestIterationDetails() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 DETAILED ANALYSIS: Test Iteration vs. Score');
  console.log('='.repeat(80));

  const query = `
    SELECT
      session_id,
      candidate_id,
      test_run_count,
      last_test_score,
      EXTRACT(EPOCH FROM (container_stopped_at - container_started_at))/60 as session_minutes
    FROM interview_sessions
    WHERE last_test_score IS NOT NULL
      AND container_started_at >= NOW() - INTERVAL '30 days'
    ORDER BY test_run_count DESC
    LIMIT 10;
  `;

  const data = await runQuery<{
    session_id: string;
    candidate_id: string;
    test_run_count: number;
    last_test_score: number;
    session_minutes: number;
  }>(
    'Top 10 Sessions by Test Iterations',
    query
  );

  if (data.length === 0) {
    console.log('⚠️  No session data available');
    return;
  }

  console.log('\n📊 Top Sessions by Iteration Count:');
  console.log('─'.repeat(80));
  console.log('Test Runs | Score | Minutes | Interpretation');
  console.log('─'.repeat(80));

  data.forEach(row => {
    let interpretation = '';
    if (row.test_run_count === 1 && row.last_test_score >= 90) {
      interpretation = '🚩 Suspiciously perfect - possible cheating';
    } else if (row.test_run_count >= 2 && row.test_run_count <= 4 && row.last_test_score >= 80) {
      interpretation = '✅ Strong - caught traps quickly';
    } else if (row.test_run_count >= 5 && row.test_run_count <= 8) {
      interpretation = '⚠️  Moderate - struggled with traps';
    } else if (row.test_run_count > 8) {
      interpretation = '❌ Weak - pattern unclear';
    }

    console.log(`${row.test_run_count.toString().padStart(9)} | ${row.last_test_score.toString().padStart(5)} | ${row.session_minutes.toFixed(1).padStart(7)} | ${interpretation}`);
  });
}

async function generateSummaryReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY REPORT');
  console.log('='.repeat(80));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log('\n📊 Validation Results:');
  console.log('─'.repeat(80));
  results.forEach(result => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`\n${statusIcon} ${result.metric}`);
    console.log(`   Value: ${result.value} (Target: ${result.target})`);
    console.log(`   ${result.interpretation}`);
  });

  console.log('\n' + '─'.repeat(80));
  console.log(`\n📈 Overall Assessment Health:`);
  console.log(`   ✅ PASS: ${passCount}/${results.length}`);
  console.log(`   ⚠️  WARNING: ${warningCount}/${results.length}`);
  console.log(`   ❌ FAIL: ${failCount}/${results.length}`);

  if (passCount === results.filter(r => r.value !== 'N/A').length) {
    console.log('\n🎉 VERDICT: Assessment is WELL-CALIBRATED and effectively tests the 3 dimensions');
    console.log('   - Differentiates candidates (variance)');
    console.log('   - Forces iteration (test runs)');
    console.log('   - Appropriate difficulty (pass rate)');
    console.log('   - Uses time effectively (duration)');
  } else if (failCount > 0) {
    console.log('\n⚠️  VERDICT: Assessment needs CALIBRATION - some metrics out of range');
    console.log('   Review failed metrics and consider adjusting:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.metric}: ${r.interpretation}`);
    });
  } else {
    console.log('\n✅ VERDICT: Assessment is MOSTLY EFFECTIVE but monitor warnings');
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🚀 Starting Assessment Validation');
  console.log('Analyzing last 30 days of assessment data...\n');

  try {
    await validateScoreVariance();
    await validateTestIterationPattern();
    await validateTimeDistribution();
    await validatePassRate();
    await analyzeTestIterationDetails();
    await generateSummaryReport();

    console.log('\n✅ Validation complete!\n');
  } catch (error) {
    console.error('\n❌ Error during validation:', error);
    process.exit(1);
  }
}

main();
