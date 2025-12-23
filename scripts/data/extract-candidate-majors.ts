/**
 * Extract candidate majors from structured resume data
 * 
 * This script extracts major information from:
 * 1. candidates.structured_resume_data.education[].major
 * 2. resumes.structured_data.education[].major
 * 
 * Usage:
 *   npm run extract-majors                    # Extract and display majors
 *   npm run extract-majors -- --output       # Extract and save to CSV file
 *   npm run extract-majors -- --populate      # Extract and populate major column in candidates table
 *   npm run extract-majors -- --populate --dry-run  # Dry run: show what would be updated
 */

import { resolve } from 'path';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface EducationItem {
  id?: string;
  major?: string;
  degree?: string;
  school?: string;
  graduationDate?: string;
  [key: string]: any;
}

interface StructuredResumeData {
  education?: EducationItem[];
  [key: string]: any;
}

interface CandidateMajorResult {
  candidateId: string;
  email: string;
  name: string;
  source: 'candidates' | 'resumes';
  resumeId?: string;
  majors: string[];
  degrees: string[];
  schools: string[];
  graduationDates: string[];
}

/**
 * Extract majors from structured resume data
 */
function extractMajorsFromStructuredData(
  structuredData: StructuredResumeData | null | undefined
): { majors: string[]; degrees: string[]; schools: string[]; graduationDates: string[] } {
  const majors: string[] = [];
  const degrees: string[] = [];
  const schools: string[] = [];
  const graduationDates: string[] = [];

  if (!structuredData || !structuredData.education || !Array.isArray(structuredData.education)) {
    return { majors, degrees, schools, graduationDates };
  }

  for (const edu of structuredData.education) {
    if (edu.major && typeof edu.major === 'string' && edu.major.trim()) {
      majors.push(edu.major.trim());
    }
    if (edu.degree && typeof edu.degree === 'string' && edu.degree.trim()) {
      degrees.push(edu.degree.trim());
    }
    if (edu.school && typeof edu.school === 'string' && edu.school.trim()) {
      schools.push(edu.school.trim());
    }
    if (edu.graduationDate && typeof edu.graduationDate === 'string' && edu.graduationDate.trim()) {
      graduationDates.push(edu.graduationDate.trim());
    }
  }

  return { majors, degrees, schools, graduationDates };
}

/**
 * Extract majors from candidates table
 */
async function extractMajorsFromCandidates(): Promise<CandidateMajorResult[]> {
  console.log('📚 Extracting majors from candidates table...\n');

  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, email, name, structured_resume_data')
    .not('structured_resume_data', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch candidates: ${error.message}`);
  }

  if (!candidates || candidates.length === 0) {
    console.log('  ℹ️  No candidates with structured_resume_data found');
    return [];
  }

  const results: CandidateMajorResult[] = [];

  for (const candidate of candidates) {
    const { majors, degrees, schools, graduationDates } = extractMajorsFromStructuredData(
      candidate.structured_resume_data as StructuredResumeData
    );

    if (majors.length > 0 || degrees.length > 0) {
      results.push({
        candidateId: candidate.id,
        email: candidate.email,
        name: candidate.name,
        source: 'candidates',
        majors,
        degrees,
        schools,
        graduationDates,
      });
    }
  }

  console.log(`  ✅ Found ${results.length} candidates with major information`);
  return results;
}

/**
 * Extract majors from resumes table
 */
async function extractMajorsFromResumes(): Promise<CandidateMajorResult[]> {
  console.log('📚 Extracting majors from resumes table...\n');

  // First get all resumes with structured_data
  const { data: resumes, error: resumesError } = await supabase
    .from('resumes')
    .select('id, candidate_id, structured_data')
    .not('structured_data', 'is', null)
    .eq('is_active', true);

  if (resumesError) {
    throw new Error(`Failed to fetch resumes: ${resumesError.message}`);
  }

  if (!resumes || resumes.length === 0) {
    console.log('  ℹ️  No resumes with structured_data found');
    return [];
  }

  // Get unique candidate IDs
  const candidateIds = [...new Set(resumes.map(r => r.candidate_id))];

  // Fetch candidate information in batches to avoid query size limits
  const BATCH_SIZE = 100;
  const candidateMap = new Map<string, { id: string; email: string; name: string }>();
  
  for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
    const batch = candidateIds.slice(i, i + BATCH_SIZE);
    
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, email, name')
      .in('id', batch);

    if (candidatesError) {
      throw new Error(`Failed to fetch candidates (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${candidatesError.message}`);
    }

    // Add to map
    (candidates || []).forEach(c => {
      candidateMap.set(c.id, c);
    });
  }

  const results: CandidateMajorResult[] = [];

  for (const resume of resumes) {
    const candidate = candidateMap.get(resume.candidate_id);
    if (!candidate) continue;

    const { majors, degrees, schools, graduationDates } = extractMajorsFromStructuredData(
      resume.structured_data as StructuredResumeData
    );

    if (majors.length > 0 || degrees.length > 0) {
      results.push({
        candidateId: candidate.id,
        email: candidate.email,
        name: candidate.name,
        source: 'resumes',
        resumeId: resume.id,
        majors,
        degrees,
        schools,
        graduationDates,
      });
    }
  }

  console.log(`  ✅ Found ${results.length} resumes with major information`);
  return results;
}

/**
 * Merge results from both sources, prioritizing resumes over candidates
 */
function mergeResults(
  candidateResults: CandidateMajorResult[],
  resumeResults: CandidateMajorResult[]
): CandidateMajorResult[] {
  const merged = new Map<string, CandidateMajorResult>();

  // First add candidates (may be overwritten by resumes)
  for (const result of candidateResults) {
    merged.set(result.candidateId, result);
  }

  // Then add/update with resumes (prioritize resumes as they're more current)
  for (const result of resumeResults) {
    const existing = merged.get(result.candidateId);
    if (existing) {
      // Merge majors from both sources, removing duplicates
      const allMajors = [...new Set([...existing.majors, ...result.majors])];
      const allDegrees = [...new Set([...existing.degrees, ...result.degrees])];
      const allSchools = [...new Set([...existing.schools, ...result.schools])];
      const allGraduationDates = [...new Set([...existing.graduationDates, ...result.graduationDates])];

      merged.set(result.candidateId, {
        ...result,
        majors: allMajors,
        degrees: allDegrees,
        schools: allSchools,
        graduationDates: allGraduationDates,
        source: 'resumes', // Prefer resumes as source
      });
    } else {
      merged.set(result.candidateId, result);
    }
  }

  return Array.from(merged.values());
}

/**
 * Display results in console
 */
function displayResults(results: CandidateMajorResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 MAJOR EXTRACTION RESULTS');
  console.log('='.repeat(80) + '\n');

  if (results.length === 0) {
    console.log('  ℹ️  No majors found in any candidates or resumes');
    return;
  }

  // Group by major for summary
  const majorCounts = new Map<string, number>();
  const degreeCounts = new Map<string, number>();

  for (const result of results) {
    for (const major of result.majors) {
      majorCounts.set(major, (majorCounts.get(major) || 0) + 1);
    }
    for (const degree of result.degrees) {
      degreeCounts.set(degree, (degreeCounts.get(degree) || 0) + 1);
    }
  }

  console.log(`Total candidates with major information: ${results.length}\n`);

  console.log('📈 Most common majors:');
  const sortedMajors = Array.from(majorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [major, count] of sortedMajors) {
    console.log(`  ${major}: ${count}`);
  }

  console.log('\n📜 Most common degrees:');
  const sortedDegrees = Array.from(degreeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [degree, count] of sortedDegrees) {
    console.log(`  ${degree}: ${count}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 DETAILED RESULTS');
  console.log('='.repeat(80) + '\n');

  for (const result of results) {
    console.log(`Candidate: ${result.name} (${result.email})`);
    console.log(`  Source: ${result.source}${result.resumeId ? ` (Resume ID: ${result.resumeId})` : ''}`);
    console.log(`  Majors: ${result.majors.length > 0 ? result.majors.join(', ') : 'None'}`);
    console.log(`  Degrees: ${result.degrees.length > 0 ? result.degrees.join(', ') : 'None'}`);
    console.log(`  Schools: ${result.schools.length > 0 ? result.schools.join(', ') : 'None'}`);
    console.log(`  Graduation Dates: ${result.graduationDates.length > 0 ? result.graduationDates.join(', ') : 'None'}`);
    console.log('');
  }
}

/**
 * Save results to CSV file
 */
function saveResultsToCSV(results: CandidateMajorResult[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `candidate-majors-${timestamp}.csv`;

  // CSV header
  const headers = [
    'Candidate ID',
    'Email',
    'Name',
    'Source',
    'Resume ID',
    'Majors',
    'Degrees',
    'Schools',
    'Graduation Dates',
  ];

  // CSV rows
  const rows = results.map(result => [
    result.candidateId,
    result.email,
    result.name,
    result.source,
    result.resumeId || '',
    result.majors.join('; '),
    result.degrees.join('; '),
    result.schools.join('; '),
    result.graduationDates.join('; '),
  ]);

  // Escape CSV values
  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  writeFileSync(filename, csvContent, 'utf-8');
  console.log(`\n💾 Results saved to: ${filename}`);
}

/**
 * Populate major column in candidates table
 */
async function populateMajorColumn(
  results: CandidateMajorResult[],
  dryRun: boolean = false
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log(dryRun ? '🔍 DRY RUN: Preview of updates' : '💾 POPULATING MAJOR COLUMN');
  console.log('='.repeat(80) + '\n');

  if (results.length === 0) {
    console.log('  ℹ️  No majors to populate');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ email: string; error: string }> = [];

  // Batch fetch current values for all candidates (more efficient)
  const candidateIds = results.map(r => r.candidateId);
  const currentMajorMap = new Map<string, string[] | null>();
  
  // Fetch in batches to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
    const batch = candidateIds.slice(i, i + BATCH_SIZE);
    
    const { data: currentCandidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id, major')
      .in('id', batch);

    if (fetchError && !dryRun) {
      throw new Error(`Failed to fetch current values (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${fetchError.message}`);
    }

    (currentCandidates || []).forEach(c => {
      currentMajorMap.set(
        c.id,
        Array.isArray(c.major) ? c.major : c.major ? [c.major] : null
      );
    });
  }

  for (const result of results) {
    // Only update if there are majors to set
    if (result.majors.length === 0) {
      continue;
    }

    // Remove duplicates and empty strings
    const uniqueMajors = [...new Set(result.majors.filter(m => m.trim()))];

    const currentMajor = currentMajorMap.get(result.candidateId) || null;
    const currentMajorStr = currentMajor 
      ? `[${currentMajor.join(', ')}]` 
      : 'NULL';

    if (dryRun) {
      console.log(`[DRY RUN] Would update: ${result.name} (${result.email})`);
      console.log(`  Current major: ${currentMajorStr}`);
      console.log(`  New major: [${uniqueMajors.join(', ')}]`);
      console.log('');
    } else {
      // Update the major column
      const { error } = await supabase
        .from('candidates')
        .update({ major: uniqueMajors })
        .eq('id', result.candidateId);

      if (error) {
        errorCount++;
        const errorMsg = error.message;
        errors.push({ email: result.email, error: errorMsg });
        console.log(`  ❌ Failed to update ${result.email}: ${errorMsg}`);
      } else {
        successCount++;
        console.log(`  ✅ Updated ${result.name} (${result.email})`);
        console.log(`     ${currentMajorStr} → [${uniqueMajors.join(', ')}]`);
      }
    }
  }

  if (!dryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(({ email, error }) => {
        console.log(`  - ${email}: ${error}`);
      });
    }
  } else {
    console.log(`\n[DRY RUN] Would update ${results.length} candidates`);
    console.log('Run without --dry-run to apply changes');
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldOutput = args.includes('--output') || args.includes('-o');
  const shouldPopulate = args.includes('--populate');
  const isDryRun = args.includes('--dry-run') || args.includes('--dryrun');

  try {
    console.log('🚀 Starting major extraction...\n');

    // Extract from both sources
    const candidateResults = await extractMajorsFromCandidates();
    const resumeResults = await extractMajorsFromResumes();

    // Merge results
    const mergedResults = mergeResults(candidateResults, resumeResults);

    // Display results
    displayResults(mergedResults);

    // Save to CSV if requested
    if (shouldOutput && mergedResults.length > 0) {
      saveResultsToCSV(mergedResults);
    }

    // Populate major column if requested
    if (shouldPopulate) {
      await populateMajorColumn(mergedResults, isDryRun);
    }

    console.log('\n✅ Extraction complete!');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { extractMajorsFromCandidates, extractMajorsFromResumes, mergeResults, populateMajorColumn };

