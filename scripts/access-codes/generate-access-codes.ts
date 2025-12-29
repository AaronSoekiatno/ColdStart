/**
 * Script to generate beta access codes in the database
 * 
 * Usage:
 *   npx tsx scripts/access-codes/generate-access-codes.ts
 * 
 * Options:
 *   --count=N           Generate N codes (default: 1)
 *   --email=EMAIL       Restrict code to specific email (optional)
 *   --prefix=PREFIX     Prefix for generated codes (default: BETA)
 *   --description=TEXT  Internal note about what these codes are for
 * 
 * Examples:
 *   # Generate 10 codes for general distribution
 *   npx tsx scripts/access-codes/generate-access-codes.ts --count=10
 * 
 *   # Generate a code for a specific user
 *   npx tsx scripts/access-codes/generate-access-codes.ts --email=user@example.com
 * 
 *   # Generate codes with a custom prefix and description
 *   npx tsx scripts/access-codes/generate-access-codes.ts --prefix=VIP --count=5 --description="VIP beta testers"
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse command line arguments
function parseArgs(): {
  count: number;
  email: string | null;
  prefix: string;
  description: string | null;
} {
  const args = process.argv.slice(2);
  const result = {
    count: 1,
    email: null as string | null,
    prefix: 'BETA',
    description: null as string | null,
  };

  for (const arg of args) {
    const [key, value] = arg.replace('--', '').split('=');
    switch (key) {
      case 'count':
        result.count = parseInt(value, 10);
        break;
      case 'email':
        result.email = value;
        break;
      case 'prefix':
        result.prefix = value.toUpperCase();
        break;
      case 'description':
        result.description = value;
        break;
    }
  }

  return result;
}

// Generate a random code
function generateCode(prefix: string): string {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${randomPart}`;
}

async function main() {
  const options = parseArgs();

  console.log('\n🎟️  Beta Access Code Generator');
  console.log('==============================');
  console.log(`Generating ${options.count} code(s) with settings:`);
  console.log(`  Prefix: ${options.prefix}`);
  console.log(`  Restricted to: ${options.email || 'Anyone (first come, first served)'}`);
  console.log(`  Description: ${options.description || 'Beta access code'}`);
  console.log('');

  const codes: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < options.count; i++) {
    const code = generateCode(options.prefix);
    
    const { error } = await supabase
      .from('access_codes')
      .insert({
        code,
        restricted_to_email: options.email,
        description: options.description || 'Beta access code',
      });

    if (error) {
      // If code already exists, try again
      if (error.code === '23505') {
        i--; // Retry this iteration
        continue;
      }
      errors.push(`Failed to create code: ${error.message}`);
    } else {
      codes.push(code);
    }
  }

  // Print results
  if (codes.length > 0) {
    console.log('✅ Generated codes:');
    console.log('');
    codes.forEach((code, index) => {
      console.log(`  ${index + 1}. ${code}`);
    });
    console.log('');
    console.log('📋 Copy these codes and share them with your beta testers!');
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach(error => console.log(`  - ${error}`));
    console.log('');
  }

  console.log(`Summary: ${codes.length} created, ${errors.length} failed`);
}

main().catch(console.error);
