/**
 * Script to fix bad location data that contains footer/navigation text
 */

import { resolve, join } from 'path';
import { config } from 'dotenv';

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
  console.warn('⚠️  No environment variables loaded.');
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Clean location string to remove footer/navigation text
 */
function cleanLocation(location: string): string {
  let cleaned = location.trim();
  
  // Stop at common footer/navigation patterns and content patterns
  const stopPatterns = [
    /Footer/i,
    /Y Combinator/i,
    /Programs/i,
    /YC Program/i,
    /Startup School/i,
    /Work at a Startup/i,
    /Primary Partner/i,
    /Founders/i,
    /Founder/i,
    /\s+Co$/i,
    /\s+Company$/i,
    // Stop at capitalized words that look like names/roles (after location)
    /\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i, // Pattern like "San Francisco John Doe"
  ];
  
  for (const pattern of stopPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined && match.index > 0) {
      cleaned = cleaned.substring(0, match.index).trim();
      break;
    }
  }
  
  // Stop at common navigation/content words
  const stopWords = [
    'Footer', 'Y Combinator', 'Programs', 'YC Program', 'Startup School', 
    'Work at a Startup', 'Primary Partner', 'Primary', 'Partner',
    'Founders', 'Founder'
  ];
  for (const stopWord of stopWords) {
    const stopIndex = cleaned.indexOf(stopWord);
    if (stopIndex > 0) {
      cleaned = cleaned.substring(0, stopIndex).trim();
      break;
    }
  }
  
  // Additional cleanup: if location contains a pattern like "CityWord" (no space), 
  // try to split at capital letters (but keep common abbreviations like "CA", "NY")
  // This handles cases like "San FranciscoPrimary" -> "San Francisco"
  if (cleaned.match(/[a-z][A-Z]/)) {
    // Split at capital letters that aren't state abbreviations
    cleaned = cleaned.replace(/([a-z])([A-Z][a-z]+)/g, (match, p1, p2) => {
      // If p2 looks like a name/role word, stop before it
      const roleWords = ['Primary', 'Partner', 'Founder', 'Founders', 'Programs'];
      if (roleWords.some(word => p2.includes(word))) {
        return p1;
      }
      return match;
    });
  }
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  return cleaned;
}

async function fixBadLocations(dryRun: boolean = false) {
  console.log('🔧 Fixing bad location data...\n');
  
  // First, check specific IDs from recovery report if they exist
  const recoveryReportIds = [
    '33b3f51e-a06e-431a-a99f-e4ea97be13e6', // Alpha Vantage
    'f845aec3-d799-4312-9fed-9f17918ea7ea', // Sapling Ai
    'cc71d5ed-17da-45ce-80a3-25c0a0d85e43', // Mdalgorithms Inc
  ];
  
  console.log('   Checking specific IDs from recovery report...');
  const { data: specificRecords } = await supabase
    .from('startups3')
    .select('id, name, location')
    .in('id', recoveryReportIds);
  
  if (specificRecords && specificRecords.length > 0) {
    console.log(`   Found ${specificRecords.length} records from recovery report:`);
    specificRecords.forEach(r => {
      console.log(`   - ${r.name}: "${r.location}"`);
    });
    console.log('');
  } else {
    console.log('   ⚠️  None of the recovery report IDs found (may have been deleted)\n');
  }
  
  // Fetch all startups with location
  let allStartups: any[] = [];
  let pageNum = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('startups3')
      .select('id, name, location')
      .not('location', 'is', null)
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
    
    if (error) throw new Error(`Failed to fetch: ${error.message}`);
    
    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      allStartups = allStartups.concat(pageData);
      hasMore = pageData.length === pageSize;
      pageNum++;
    }
  }
  
  console.log(`   Found ${allStartups.length} startups with location data\n`);
  
  // Debug: Show a few sample locations
  if (allStartups.length > 0) {
    console.log('   Sample locations (first 5):');
    allStartups.slice(0, 5).forEach((s, idx) => {
      console.log(`   ${idx + 1}. ${s.name}: "${s.location}"`);
    });
    console.log('');
  }
  
  // Find bad locations - check for various bad patterns
  const badLocations = allStartups.filter(s => {
    if (!s.location) return false;
    const loc = s.location; // Keep original case for pattern matching
    const locLower = loc.toLowerCase();
    
    // Check for footer/navigation patterns (case insensitive)
    // Also check for concatenated versions like "FooterY", "ProgramsYC", etc.
    const badPatterns = [
      'footer',
      'y combinator',
      'programs',
      'startup school',
      'work at a startup',
      'yc program',
      'footery', // concatenated
      'programsyc', // concatenated
      'ycombinator', // concatenated
    ];
    
    for (const pattern of badPatterns) {
      if (locLower.includes(pattern)) {
        return true;
      }
    }
    
    // Check for role words that shouldn't be in location
    if (locLower.includes('primary partner') ||
        (locLower.includes('primary') && locLower.includes('partner')) ||
        (locLower.includes('founders') && !locLower.match(/founder.*(?:of|at|from)/)) ||
        (locLower.includes('founder') && !locLower.match(/founder.*(?:of|at|from)/) && loc.split(/\s+/).length > 3)) {
      return true;
    }
    
    // Check for patterns like "CityWord" (no space between city and word)
    // e.g., "San FranciscoPrimary" or "San FranciscoFounders"
    if (loc.match(/[a-z][A-Z]/)) {
      // Check if it's followed by role words
      const roleWords = ['Primary', 'Partner', 'Founder', 'Founders', 'Programs'];
      const match = loc.match(/[a-z]([A-Z][a-z]+)/);
      if (match && match[1]) {
        if (roleWords.some(word => match[1].includes(word))) {
          return true;
        }
      }
    }
    
    // Check for multiple consecutive capitalized words (likely names/roles)
    // e.g., "San Francisco John Doe" or "San Francisco Julia Zheng"
    // But exclude valid locations like "New York" or "San Francisco"
    const namePattern = /\s+[A-Z][a-z]+\s+[A-Z][a-z]+/;
    if (namePattern.test(loc)) {
      // Check if it looks like a name (not a valid location format)
      // Valid locations usually have commas: "City, State" or "City, Country"
      // If there's no comma and multiple capitalized words, it might be a name
      const parts = loc.split(/\s+/);
      const capitalizedParts = parts.filter(p => /^[A-Z][a-z]+$/.test(p));
      if (capitalizedParts.length > 2 && !loc.includes(',')) {
        // More than 2 capitalized words without comma = likely has names
        return true;
      }
      // Also check if it contains common name patterns
      if (loc.match(/\s+(Julia|John|Jane|Mike|Sarah|David|Emily|Chris|Alex|Maria)\s+/i)) {
        return true;
      }
    }
    
    // Check for concatenated words without spaces (like "FooterY" or "ProgramsYC")
    // Pattern: lowercase letter followed by uppercase letter(s) followed by more uppercase
    if (loc.match(/[a-z][A-Z][a-z]*[A-Z]/) || loc.match(/[A-Z][a-z]+[A-Z][a-z]*[A-Z]/)) {
      // This pattern indicates concatenated words like "FooterY" or "ProgramsYC"
      return true;
    }
    
    // Check for locations that are too long (likely contain extra text)
    // Normal locations are usually under 50 characters
    if (loc.length > 50) {
      return true;
    }
    
    return false;
  });
  
  console.log(`   Found ${badLocations.length} startups with bad location data\n`);
  
  if (badLocations.length === 0) {
    console.log('✅ No bad locations found!');
    return;
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be updated\n');
    console.log('   Startups that would be fixed:');
    badLocations.slice(0, 20).forEach((s, idx) => {
      const cleaned = cleanLocation(s.location);
      console.log(`   ${idx + 1}. ${s.name}`);
      console.log(`      Current: "${s.location}"`);
      console.log(`      Fixed:   "${cleaned}"`);
    });
    if (badLocations.length > 20) {
      console.log(`   ... and ${badLocations.length - 20} more`);
    }
    return;
  }
  
  // Fix locations
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const startup of badLocations) {
    const cleaned = cleanLocation(startup.location);
    
    if (cleaned !== startup.location && cleaned.length > 0) {
      const { error } = await supabase
        .from('startups3')
        .update({ location: cleaned })
        .eq('id', startup.id);
      
      if (error) {
        console.error(`   ❌ Error fixing ${startup.name}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Fixed: ${startup.name}`);
        console.log(`      "${startup.location}" → "${cleaned}"`);
        fixedCount++;
      }
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Errors: ${errorCount}`);
}

const dryRun = process.argv.includes('--dry-run');

fixBadLocations(dryRun)
  .then(() => {
    console.log('\n✨ Fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

