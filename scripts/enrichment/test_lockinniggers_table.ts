import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable() {
  console.log('Checking lockinniggers table...\n');

  // First, let's check if the table exists and get a sample row
  const { data, error } = await supabase.from('lockinniggers').select('*').limit(5);

  if (error) {
    console.log('❌ Error:', error.message);
    console.log('Full error:', JSON.stringify(error, null, 2));
    return;
  }

  console.log(`✅ Found ${data?.length || 0} row(s)\n`);

  if (data && data.length > 0) {
    console.log('Sample row structure:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nColumn names:', Object.keys(data[0]));
    
    // Check for rows needing enrichment
    const allRows = await supabase.from('lockinniggers').select('*');
    console.log(`\nTotal rows in table: ${allRows.data?.length || 0}`);
    
    // Count rows with missing founder data
    const rowsNeedingEnrichment = (allRows.data || []).filter(row => {
      const hasFounderName = row.founder_name && row.founder_name.trim();
      const hasFounderEmail = row.founder_email && row.founder_email.trim();
      const hasWebsite = row.website && row.website.trim();
      const hasCompanyName = row['company - name'] && row['company - name'].trim();
      
      return (!hasFounderName || !hasFounderEmail) && hasWebsite && hasCompanyName;
    });
    
    console.log(`Rows needing enrichment: ${rowsNeedingEnrichment.length}`);
    
    if (rowsNeedingEnrichment.length > 0) {
      console.log('\nFirst few rows needing enrichment:');
      rowsNeedingEnrichment.slice(0, 3).forEach((row, i) => {
        console.log(`\n${i + 1}. Company: ${row['company - name']}`);
        console.log(`   Website: ${row.website}`);
        console.log(`   Founder name: ${row.founder_name || 'NULL'}`);
        console.log(`   Founder email: ${row.founder_email || 'NULL'}`);
      });
    }
  } else {
    console.log('⚠️  Table exists but has no data');
  }
}

testTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

