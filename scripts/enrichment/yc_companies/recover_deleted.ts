/**
 * Recovery script to help identify and potentially restore deleted records
 * This script checks for records that might have been incorrectly deleted
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
const currentDir = process.cwd();
const possiblePaths = [
  join(currentDir, '.env.local'),
  join(currentDir, '..', '.env.local'),
  join(__dirname, '..', '.env.local'),
  join(__dirname, '..', '..', '.env.local'),
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  const result = config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No environment variables loaded. Make sure .env.local exists in project root.');
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string | number;
  name: string;
  industry?: string | null;
  description?: string | null;
  location?: string | null;
  yc_link?: string | null;
  founder_linkedin?: string | null;
  created_at?: string;
  [key: string]: any;
}

/**
 * Check for potential issues in the database
 */
async function analyzeDatabase() {
  console.log('🔍 Analyzing database for potential issues...\n');
  
  // Fetch all startups
  console.log('📂 Fetching all companies from startups3 table...');
  let allStartups: Startup[] = [];
  let pageNum = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: fetchError } = await supabase
      .from('startups3')
      .select('id, name, industry, description, location, yc_link, founder_linkedin, created_at')
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      throw new Error(`Failed to fetch startups: ${fetchError.message}`);
    }
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      allStartups = allStartups.concat(pageData);
      hasMore = pageData.length === pageSize;
      pageNum++;
      console.log(`   Fetched ${allStartups.length} companies so far...`);
    }
  }
  
  console.log(`\n   Found ${allStartups.length} total companies\n`);
  
  // Analyze for issues
  console.log('📊 Analysis Results:\n');
  
  // 1. Check for duplicates (same YC link + LinkedIn)
  console.log('1️⃣  Checking for remaining duplicates...');
  const duplicateGroups = new Map<string, Startup[]>();
  
  for (const startup of allStartups) {
    const ycLink = startup.yc_link?.toLowerCase().trim() || '';
    const linkedIn = startup.founder_linkedin?.toLowerCase().split(',')[0].trim() || '';
    
    if (ycLink && linkedIn) {
      const key = `${ycLink}|${linkedIn}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(startup);
    }
  }
  
  const remainingDuplicates = Array.from(duplicateGroups.values()).filter(g => g.length > 1);
  console.log(`   Found ${remainingDuplicates.length} duplicate groups still remaining`);
  
  if (remainingDuplicates.length > 0) {
    console.log(`\n   ⚠️  Remaining duplicates:`);
    remainingDuplicates.slice(0, 5).forEach((group, idx) => {
      console.log(`   ${idx + 1}. ${group.map(s => s.name).join(', ')}`);
      console.log(`      YC Link: ${group[0].yc_link}`);
      console.log(`      LinkedIn: ${group[0].founder_linkedin}`);
    });
    if (remainingDuplicates.length > 5) {
      console.log(`   ... and ${remainingDuplicates.length - 5} more`);
    }
  }
  
  // 2. Check for startups missing all three fields
  console.log('\n2️⃣  Checking for startups missing industry, description, and location...');
  const missingAllThree = allStartups.filter(s => {
    const hasIndustry = s.industry && s.industry.trim() !== '';
    const hasDescription = s.description && s.description.trim() !== '';
    const hasLocation = s.location && s.location.trim() !== '';
    return !hasIndustry && !hasDescription && !hasLocation;
  });
  
  console.log(`   Found ${missingAllThree.length} startups missing all three fields`);
  
  if (missingAllThree.length > 0) {
    console.log(`\n   ⚠️  Startups missing all fields:`);
    missingAllThree.slice(0, 10).forEach((startup, idx) => {
      console.log(`   ${idx + 1}. ${startup.name} (ID: ${startup.id})`);
      console.log(`      YC Link: ${startup.yc_link || 'N/A'}`);
      console.log(`      Created: ${startup.created_at || 'N/A'}`);
    });
    if (missingAllThree.length > 10) {
      console.log(`   ... and ${missingAllThree.length - 10} more`);
    }
  }
  
  // 3. Check for startups with bad location data (contains footer text)
  console.log('\n3️⃣  Checking for startups with bad location data...');
  const badLocations = allStartups.filter(s => {
    if (!s.location) return false;
    const loc = s.location.toLowerCase();
    return loc.includes('footer') || 
           loc.includes('y combinator') || 
           loc.includes('programs') ||
           loc.includes('startup school');
  });
  
  console.log(`   Found ${badLocations.length} startups with potentially bad location data`);
  
  if (badLocations.length > 0) {
    console.log(`\n   ⚠️  Startups with bad locations:`);
    badLocations.slice(0, 10).forEach((startup, idx) => {
      console.log(`   ${idx + 1}. ${startup.name}`);
      console.log(`      Location: "${startup.location}"`);
    });
    if (badLocations.length > 10) {
      console.log(`   ... and ${badLocations.length - 10} more`);
    }
  }
  
  // 4. Check for startups missing keywords
  console.log('\n4️⃣  Checking for startups missing keywords...');
  const missingKeywords = allStartups.filter(s => {
    // Check if keywords field exists and is empty
    return !s.keywords || (typeof s.keywords === 'string' && s.keywords.trim() === '');
  });
  
  console.log(`   Found ${missingKeywords.length} startups missing keywords`);
  
  // Save analysis to file
  const analysisReport = {
    totalStartups: allStartups.length,
    remainingDuplicates: remainingDuplicates.length,
    missingAllThreeFields: missingAllThree.length,
    badLocations: badLocations.length,
    missingKeywords: missingKeywords.length,
    duplicateGroups: remainingDuplicates.map(g => ({
      names: g.map(s => s.name),
      ids: g.map(s => s.id),
      yc_link: g[0].yc_link,
      founder_linkedin: g[0].founder_linkedin,
    })),
    missingFieldsStartups: missingAllThree.slice(0, 50).map(s => ({
      id: s.id,
      name: s.name,
      yc_link: s.yc_link,
      created_at: s.created_at,
    })),
    badLocationStartups: badLocations.slice(0, 50).map(s => ({
      id: s.id,
      name: s.name,
      location: s.location,
    })),
  };
  
  const reportPath = `yc_companies/recovery_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(analysisReport, null, 2));
  console.log(`\n💾 Analysis report saved to: ${reportPath}`);
  
  return analysisReport;
}

/**
 * Check Supabase for backup/point-in-time recovery options
 */
async function checkRecoveryOptions() {
  console.log('\n\n🔧 Recovery Options:\n');
  console.log('1. Check Supabase Dashboard for backups:');
  console.log('   - Go to your Supabase project dashboard');
  console.log('   - Check "Database" > "Backups" section');
  console.log('   - Look for point-in-time recovery or daily backups\n');
  
  console.log('2. If you have a backup:');
  console.log('   - Restore from the backup in Supabase dashboard');
  console.log('   - Or export the backup and import it\n');
  
  console.log('3. If no backup available:');
  console.log('   - Check if you have any exported data (CSV, JSON files)');
  console.log('   - Check git history for any data dumps');
  console.log('   - Contact Supabase support for recovery options\n');
}

// Run analysis
analyzeDatabase()
  .then((report) => {
    console.log('\n\n📋 Summary:');
    console.log(`   Total startups: ${report.totalStartups}`);
    console.log(`   Remaining duplicates: ${report.remainingDuplicates}`);
    console.log(`   Missing all fields: ${report.missingAllThreeFields}`);
    console.log(`   Bad locations: ${report.badLocations}`);
    console.log(`   Missing keywords: ${report.missingKeywords}`);
    
    return checkRecoveryOptions();
  })
  .then(() => {
    console.log('\n✨ Analysis completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the recovery report JSON file');
    console.log('   2. Check Supabase dashboard for backups');
    console.log('   3. If you have backups, restore from there');
    console.log('   4. If not, we can try to manually fix the issues');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  });

