#!/usr/bin/env tsx
/**
 * Backfill script to populate email_preferences table for existing users
 * 
 * This script creates email preferences for:
 * 1. All users in the candidates table (who don't have preferences yet)
 * 2. All users in auth.users (who don't have preferences yet)
 * 
 * Usage:
 *   npm run backfill-email-preferences                    # Backfill all users
 *   npm run backfill-email-preferences -- --dry-run       # Preview what would be created
 *   npm run backfill-email-preferences -- --limit=100      # Limit to first 100 users
 */

// Load .env.local file FIRST using require to ensure it's synchronous
// This is critical because lib/supabase.ts initializes clients at module load time
const { resolve } = require('path');
const { config } = require('dotenv');
config({ path: resolve(process.cwd(), '.env.local') });

// Now import other modules after env vars are loaded
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Helper functions (inlined to avoid importing from lib/supabase.ts which initializes clients at module load)
function generateUnsubscribeToken(): string {
  return randomBytes(32).toString('hex');
}

async function getEmailPreferences(supabaseClient: SupabaseClient, email: string) {
  const { data, error } = await supabaseClient
    .from('email_preferences')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get email preferences: ${error.message}`);
  }

  return data;
}

async function createEmailPreferences(supabaseClient: SupabaseClient, email: string, options?: { marketingOptIn?: boolean }) {
  const unsubscribeToken = generateUnsubscribeToken();

  const { data, error } = await supabaseClient
    .from('email_preferences')
    .insert({
      email,
      welcome_emails_enabled: true,
      marketing_emails_enabled: options?.marketingOptIn ?? false,
      unsubscribe_token: unsubscribeToken,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create email preferences: ${error.message}`);
  }

  return data;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📧 Email Preferences Backfill');
  console.log('==============================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No preferences will be created\n');
  }

  if (limit) {
    console.log(`📊 Limiting to ${limit} users\n`);
  }

  // Step 1: Get all unique emails from candidates table
  console.log('Step 1: Fetching emails from candidates table...');
  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from('candidates')
    .select('email')
    .not('email', 'is', null);

  if (candidatesError) {
    console.error('❌ Error fetching candidates:', candidatesError);
    process.exit(1);
  }

  const candidateEmails = new Set(
    (candidates || [])
      .map(c => c.email?.toLowerCase().trim())
      .filter((email): email is string => !!email && email.includes('@'))
  );

  console.log(`   Found ${candidateEmails.size} unique emails in candidates table\n`);

  // Step 2: Get all unique emails from auth.users (if accessible)
  console.log('Step 2: Fetching emails from auth.users...');
  let authUserEmails = new Set<string>();
  
  try {
    // Note: This requires service role key to access auth.users
    // Using RPC or direct query if available
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!authError && authUsers) {
      authUserEmails = new Set(
        authUsers.users
          .map(u => u.email?.toLowerCase().trim())
          .filter((email): email is string => !!email && email.includes('@'))
      );
      console.log(`   Found ${authUserEmails.size} unique emails in auth.users\n`);
    } else {
      console.log(`   ⚠️  Could not access auth.users (this is okay)\n`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not access auth.users: ${error}\n`);
  }

  // Step 3: Combine all emails
  const allEmails = new Set([...candidateEmails, ...authUserEmails]);
  console.log(`Step 3: Total unique emails to process: ${allEmails.size}\n`);

  // Step 4: Check existing preferences
  console.log('Step 4: Checking existing email preferences...');
  const { data: existingPreferences, error: prefError } = await supabaseAdmin
    .from('email_preferences')
    .select('email');

  if (prefError) {
    console.error('❌ Error fetching existing preferences:', prefError);
    process.exit(1);
  }

  const existingEmails = new Set(
    (existingPreferences || []).map(p => p.email?.toLowerCase().trim()).filter(Boolean)
  );

  console.log(`   Found ${existingEmails.size} existing email preferences\n`);

  // Step 5: Find emails that need preferences
  const emailsToProcess = Array.from(allEmails).filter(
    email => !existingEmails.has(email.toLowerCase())
  );

  console.log(`Step 5: Emails needing preferences: ${emailsToProcess.length}\n`);

  if (emailsToProcess.length === 0) {
    console.log('✅ All users already have email preferences!\n');
    process.exit(0);
  }

  // Step 6: Process emails
  const emailsToCreate = limit ? emailsToProcess.slice(0, limit) : emailsToProcess;
  const actualCount = emailsToCreate.length;

  console.log(`Step 6: Processing ${actualCount} email(s)...\n`);

  let createdCount = 0;
  let failedCount = 0;
  const failedEmails: string[] = [];

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 10;
  const batches: string[][] = [];

  for (let i = 0; i < emailsToCreate.length; i += BATCH_SIZE) {
    batches.push(emailsToCreate.slice(i, i + BATCH_SIZE));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)...`);

    const batchPromises = batch.map(async (email) => {
      if (isDryRun) {
        console.log(`  [DRY RUN] Would create preferences for: ${email}`);
        return { email, success: true };
      }

      try {
        // Check if preferences already exist (race condition protection)
        const existing = await getEmailPreferences(supabaseAdmin, email);
        if (existing) {
          console.log(`  ⚠️  Preferences already exist for ${email} (skipping)`);
          return { email, success: true, skipped: true };
        }

        await createEmailPreferences(supabaseAdmin, email);
        console.log(`  ✅ Created preferences for: ${email}`);
        return { email, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed to create preferences for ${email}: ${errorMessage}`);
        return { email, success: false, error: errorMessage };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          if (!result.value.skipped) {
            createdCount++;
          }
        } else {
          failedCount++;
          failedEmails.push(result.value.email);
        }
      } else {
        failedCount++;
        console.error('  ❌ Batch item failed:', result.reason);
      }
    });

    // Small delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n==============================');
  console.log('📊 Summary');
  console.log('==============================');
  console.log(`Total emails processed: ${actualCount}`);
  console.log(`✅ Created: ${createdCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  if (isDryRun) {
    console.log(`🔍 Would create: ${actualCount}`);
  }
  if (limit && emailsToProcess.length > limit) {
    console.log(`\n⚠️  Note: ${emailsToProcess.length - limit} more email(s) need preferences`);
    console.log(`   Run again without --limit to process remaining emails`);
  }
  if (failedCount > 0) {
    console.log(`\n❌ Failed emails:`);
    failedEmails.forEach(email => console.log(`   - ${email}`));
  }
  console.log('');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

