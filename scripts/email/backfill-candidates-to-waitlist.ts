#!/usr/bin/env tsx
/**
 * Script to backfill active candidates into the waitlist table
 * 
 * This script finds all active candidates (those who have completed onboarding, have active subscriptions,
 * or have uploaded resumes) who are not in the waitlist table and adds them with user_type='user'.
 * It also upgrades existing 'lead' entries to 'user' if they correspond to active candidates.
 * 
 * The waitlist table uses the user_type column to distinguish between:
 * - 'lead': People who signed up for the waitlist but haven't become active users yet
 * - 'user': Active candidates who are using the platform
 * 
 * This allows for different messaging to leads vs users in email campaigns.
 * 
 * Usage:
 *   npm run backfill-candidates-waitlist -- --dry-run    # Preview what would be added/upgraded
 *   npm run backfill-candidates-waitlist                 # Actually add/upgrade candidates in waitlist
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function main() {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔄 Backfilling Active Candidates to Waitlist');
  console.log('==============================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Step 1: Find all active candidates
  // Active candidates are those who:
  // - Have completed onboarding (onboarding_completed = true), OR
  // - Have an active subscription (subscription_status = 'active' or 'trialing'), OR
  // - Have a resume uploaded (have structured_resume_data or resume_path)
  console.log('📋 Fetching active candidates...');
  
  // Get all candidates (we'll filter in JavaScript for more flexibility)
  const { data: allCandidates, error: candidatesError } = await supabaseAdmin
    .from('candidates')
    .select('id, email, name, onboarding_completed, subscription_status, created_at, structured_resume_data')
    .not('email', 'is', null);

  if (candidatesError) {
    console.error('❌ Error fetching candidates:', candidatesError);
    process.exit(1);
  }

  // Get all candidate IDs that have resumes in the resumes table
  const { data: candidatesWithResumes, error: resumesError } = await supabaseAdmin
    .from('resumes')
    .select('candidate_id')
    .eq('is_active', true);

  if (resumesError) {
    console.warn('⚠️  Warning: Could not fetch resumes data:', resumesError.message);
    console.warn('   Continuing without resume check...\n');
  }

  const candidateIdsWithResumes = new Set(
    (candidatesWithResumes || []).map(r => r.candidate_id)
  );

  // Filter to active candidates: those with onboarding completed, active subscription, or resume uploaded
  const activeCandidates = (allCandidates || []).filter(candidate => {
    if (!candidate.email) return false;
    
    // Consider active if:
    // 1. Completed onboarding
    if (candidate.onboarding_completed === true) return true;
    
    // 2. Has active/trialing subscription
    if (candidate.subscription_status === 'active' || candidate.subscription_status === 'trialing') return true;
    
    // 3. Has resume data (indicates they've used the service)
    // Check structured_resume_data and resumes table
    if (candidate.structured_resume_data) return true;
    if (candidate.id && candidateIdsWithResumes.has(candidate.id)) return true;
    
    return false;
  });

  if (!activeCandidates || activeCandidates.length === 0) {
    console.log('✅ No active candidates found!');
    process.exit(0);
  }

  console.log(`   Found ${activeCandidates.length} active candidate(s)\n`);

  // Step 2: Get existing emails from waitlist
  console.log('📋 Fetching existing waitlist emails...');
  
  const existingEmails = new Set<string>();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .select('email')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching waitlist emails:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => existingEmails.add(row.email.toLowerCase().trim()));
      hasMore = data.length === pageSize;
      page++;
    }
  }

  console.log(`   Found ${existingEmails.size} existing email(s) in waitlist\n`);

  // Step 3: Filter candidates not in waitlist
  // Check if user_type column exists by trying a simple test query (gracefully handle if it doesn't exist)
  let hasUserTypeColumn = false;
  let existingWaitlistMap = new Map<string, string>();
  
  // First, try to check if user_type column exists by attempting to select it
  try {
    const testQuery = await supabaseAdmin
      .from('waitlist')
      .select('email, user_type')
      .limit(1);
    
    // If no error, column exists
    if (!testQuery.error) {
      hasUserTypeColumn = true;
      
      // Now fetch user_type for active candidates that are already in waitlist
      const candidateEmails = activeCandidates
        .map(c => c.email?.toLowerCase().trim())
        .filter(Boolean) as string[];
      
      if (candidateEmails.length > 0) {
        const { data: existingWaitlistEntries, error: allEntriesError } = await supabaseAdmin
          .from('waitlist')
          .select('email, user_type')
          .in('email', candidateEmails);

        if (!allEntriesError && existingWaitlistEntries) {
          existingWaitlistEntries.forEach(entry => {
            existingWaitlistMap.set(entry.email.toLowerCase().trim(), entry.user_type || 'lead');
          });
        }
      }
    }
  } catch (error: any) {
    // Column doesn't exist or other error - continue without user_type features
    hasUserTypeColumn = false;
  }
  
  if (!hasUserTypeColumn) {
    console.log('ℹ️  user_type column does not exist - run migration 033_add_user_type_to_waitlist.sql to enable lead/user distinction');
    console.log('   Will add candidates without user_type distinction\n');
  }

  const candidatesToAdd = activeCandidates.filter(
    candidate => candidate.email && !existingEmails.has(candidate.email.toLowerCase().trim())
  );

  const candidatesToUpgrade = hasUserTypeColumn 
    ? activeCandidates.filter(candidate => {
        if (!candidate.email) return false;
        const email = candidate.email.toLowerCase().trim();
        const currentType = existingWaitlistMap.get(email);
        return currentType === 'lead'; // Upgrade leads to users
      })
    : []; // Can't upgrade if column doesn't exist

  console.log(`📊 Analysis:`);
  console.log(`   Total active candidates: ${activeCandidates.length}`);
  if (hasUserTypeColumn) {
    console.log(`   Already in waitlist (as users): ${activeCandidates.length - candidatesToAdd.length - candidatesToUpgrade.length}`);
    console.log(`   Need to be added: ${candidatesToAdd.length}`);
    console.log(`   Need to be upgraded (lead → user): ${candidatesToUpgrade.length}\n`);
  } else {
    console.log(`   Already in waitlist: ${activeCandidates.length - candidatesToAdd.length}`);
    console.log(`   Need to be added: ${candidatesToAdd.length}\n`);
  }

  if (candidatesToAdd.length === 0 && (!hasUserTypeColumn || candidatesToUpgrade.length === 0)) {
    const message = hasUserTypeColumn 
      ? '✅ All active candidates are already in the waitlist as users!'
      : '✅ All active candidates are already in the waitlist!';
    console.log(message);
    process.exit(0);
  }

  // Step 4: Show preview of what will be added
  console.log('📝 Candidates to be added (as users):');
  candidatesToAdd.slice(0, 10).forEach((candidate, index) => {
    let reason = '';
    if (candidate.onboarding_completed) {
      reason = 'onboarding completed';
    } else if (candidate.subscription_status === 'active' || candidate.subscription_status === 'trialing') {
      reason = 'active subscription';
    } else if (candidate.structured_resume_data || (candidate.id && candidateIdsWithResumes.has(candidate.id))) {
      reason = 'has resume';
    } else {
      reason = 'active user';
    }
    console.log(`   ${index + 1}. ${candidate.email} (${reason})`);
  });
  if (candidatesToAdd.length > 10) {
    console.log(`   ... and ${candidatesToAdd.length - 10} more\n`);
  } else {
    console.log('');
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN - No changes will be made');
    console.log(`   Would add ${candidatesToAdd.length} candidate(s) to waitlist`);
    if (hasUserTypeColumn) {
      console.log(`   Would upgrade ${candidatesToUpgrade.length} lead(s) to user(s)`);
    }
    process.exit(0);
  }

  // Step 5: Upgrade existing leads to users first (only if user_type column exists)
  if (hasUserTypeColumn && candidatesToUpgrade.length > 0) {
    console.log(`🔄 Upgrading ${candidatesToUpgrade.length} lead(s) to user(s)...\n`);
    
    const upgradeBatchSize = 100;
    for (let i = 0; i < candidatesToUpgrade.length; i += upgradeBatchSize) {
      const batch = candidatesToUpgrade.slice(i, i + upgradeBatchSize);
      const batchEmails = batch.map(c => c.email.toLowerCase().trim());
      
      const { error: upgradeError } = await supabaseAdmin
        .from('waitlist')
        .update({ user_type: 'user' })
        .in('email', batchEmails)
        .eq('user_type', 'lead'); // Only update if currently 'lead'
      
      if (upgradeError) {
        console.error(`   ❌ Error upgrading batch:`, upgradeError.message);
      } else {
        console.log(`   ✅ Upgraded ${batch.length} lead(s) to user(s)`);
      }
    }
    console.log('');
  }

  // Step 6: Insert new candidates into waitlist in batches
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  if (candidatesToAdd.length > 0) {
    console.log(`💾 Adding ${candidatesToAdd.length} candidate(s) to waitlist...\n`);
  
  const batchSize = 100;

  for (let i = 0; i < candidatesToAdd.length; i += batchSize) {
    const batch = candidatesToAdd.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(candidatesToAdd.length / batchSize);

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} candidates)...`);

    // Prepare batch data
    const batchData: any = batch.map(candidate => ({
      email: candidate.email.toLowerCase().trim(),
      // Set created_at to candidate's created_at if available, otherwise use now
      created_at: candidate.created_at || new Date().toISOString(),
      // Leave sent_status, sent_at, error_message as null (they haven't received emails yet)
    }));

    // Only add user_type if the column exists
    if (hasUserTypeColumn) {
      batchData.forEach((item: any) => {
        item.user_type = 'user';
      });
    }

    // Use upsert to handle any race conditions or duplicates gracefully
    // If email exists, update user_type to 'user' (upgrade lead to user)
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('waitlist')
      .upsert(batchData, {
        onConflict: 'email',
        ignoreDuplicates: false, // We want to update user_type if exists
      })
      .select();

    if (insertError) {
      console.error(`   ❌ Error inserting batch ${batchNumber}:`, insertError.message);
      errors += batch.length;
      continue;
    }

    const insertedInBatch = insertData?.length || 0;
    inserted += insertedInBatch;
    skipped += batch.length - insertedInBatch;

    console.log(`   ✅ Inserted ${insertedInBatch} candidate(s) in batch ${batchNumber}`);
  }

    console.log('');
  }

  // Summary
  console.log('\n========================');
  console.log('📊 Summary');
  console.log('========================');
  console.log(`Total active candidates: ${activeCandidates.length}`);
  if (hasUserTypeColumn) {
    console.log(`Already in waitlist (as users): ${activeCandidates.length - candidatesToAdd.length - candidatesToUpgrade.length}`);
    console.log(`✅ Successfully upgraded: ${candidatesToUpgrade.length}`);
  } else {
    console.log(`Already in waitlist: ${activeCandidates.length - candidatesToAdd.length}`);
  }
  console.log(`✅ Successfully added: ${inserted}`);
  console.log(`⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  const totalProcessed = inserted + (hasUserTypeColumn ? candidatesToUpgrade.length : 0);
  if (totalProcessed > 0) {
    console.log(`\n✅ Successfully backfilled ${totalProcessed} active candidate(s) into waitlist!`);
    if (!hasUserTypeColumn) {
      console.log(`\n💡 Tip: Run migration 033_add_user_type_to_waitlist.sql to distinguish leads from users`);
    }
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

