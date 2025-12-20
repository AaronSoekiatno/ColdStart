/**
 * Quick script to apply the role_type migration directly
 * Run with: npx tsx scripts/apply-role-type-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

async function applyMigration() {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  
  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '022_add_role_type_to_candidates.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('Applying migration: 022_add_role_type_to_candidates.sql');
  console.log('SQL:', migrationSQL);
  
  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // If rpc doesn't work, try direct query
      console.log('RPC method failed, trying direct execution...');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        // Note: Supabase JS client doesn't support raw SQL execution
        // You'll need to run this in the Supabase dashboard SQL editor
      }
      
      console.error('Error:', error);
      console.log('\n⚠️  Cannot execute SQL directly via JS client.');
      console.log('Please apply this migration manually:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the SQL from:', migrationPath);
      console.log('4. Run the query');
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('Failed to apply migration:', error);
    console.log('\n⚠️  Please apply this migration manually:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL from:', migrationPath);
    console.log('4. Run the query');
    process.exit(1);
  }
}

applyMigration();

