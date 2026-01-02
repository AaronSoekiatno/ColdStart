#!/usr/bin/env tsx
/**
 * Script to send founding engineer opportunity emails to all waitlist users via SendGrid API
 *
 * Usage:
 *   npm run send-founding-engineer:sendgrid -- --dry-run              # Preview what would be sent
 *   npm run send-founding-engineer:sendgrid -- --limit=10             # Send to first 10 emails (testing)
 *   npm run send-founding-engineer:sendgrid                           # Send to all pending emails
 *   npm run send-founding-engineer:sendgrid -- --resend-failed        # Retry emails that previously failed
 */

// Load .env.local file FIRST - This MUST happen before any other imports
// that might transitively import supabase.ts
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env.local file from project root
// Try multiple paths to find .env.local
const currentDir = process.cwd();
const possiblePaths = [
  join(currentDir, '.env.local'),                    // Current directory
  join(currentDir, '..', '.env.local'),              // Parent directory
  join(currentDir, '..', '..', '.env.local'),        // Two levels up
  join(currentDir, '..', '..', '..', '.env.local'),  // Three levels up
];

let envLoaded = false;
let loadedPath = '';
for (const envPath of possiblePaths) {
  const resolvedPath = resolve(envPath);
  
  // Check if file exists
  if (!existsSync(resolvedPath)) {
    continue;
  }
  
  // Try to load it
  const result = config({ path: resolvedPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    console.log(`✅ Environment variables loaded from: ${resolvedPath}`);
    envLoaded = true;
    loadedPath = resolvedPath;
    break;
  }
}

if (!envLoaded) {
  console.error('❌ No environment variables loaded!');
  console.error(`   Checked paths:`);
  possiblePaths.forEach(p => {
    const resolved = resolve(p);
    const exists = existsSync(resolved);
    console.error(`     - ${resolved} ${exists ? '(exists)' : '(not found)'}`);
  });
  console.error(`   Current working directory: ${currentDir}`);
  console.error(`   Please ensure .env.local exists in the project root.`);
  process.exit(1);
}

// Verify critical environment variables are loaded before importing modules
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || supabaseUrl.trim() === '') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set or is empty after loading .env.local');
  console.error(`   Loaded from: ${loadedPath}`);
  
  // Try to read the file and show what's in it
  try {
    const fileContent = readFileSync(loadedPath, 'utf-8');
    const hasVar = fileContent.includes('NEXT_PUBLIC_SUPABASE_URL');
    console.error(`   File contains NEXT_PUBLIC_SUPABASE_URL: ${hasVar ? 'YES' : 'NO'}`);
    if (hasVar) {
      const lines = fileContent.split('\n');
      const varLine = lines.find(l => l.includes('NEXT_PUBLIC_SUPABASE_URL'));
      console.error(`   Line found: ${varLine?.trim()}`);
    }
  } catch (e) {
    console.error(`   Could not read file: ${e}`);
  }
  
  console.error(`   Current SUPABASE env vars: ${Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ') || 'none'}`);
  process.exit(1);
}

// Now import modules that depend on environment variables
// Note: We'll dynamically import sendNewsletterEmail inside main() to avoid
// loading lib/supabase.ts before env vars are set
import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const resendFailed = args.includes('--resend-failed');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
const emailArg = args.find(arg => arg.startsWith('--email='));
const testEmail = emailArg ? emailArg.split('=')[1] : undefined;

// Email content
const EMAIL_SUBJECT = process.env.FOUNDING_ENGINEER_EMAIL_SUBJECT || 'Founding Engineer Opportunities';

// Plain-text founding engineer email
const EMAIL_TEXT = process.env.FOUNDING_ENGINEER_EMAIL_TEXT || `Hey 

FurtherAI, Absurd YC25, and other top startups are looking for full-time and remote internship roles based in the United States! 

We think you can fit this role and we want to highlight your ability to ship real code and stand out to YC founders.

Here are some of the job listings: 
https://www.workatastartup.com/companies/absurd
https://www.ycombinator.com/companies/afterquery/jobs
https://www.ycombinator.com/companies/furtherai/jobs


If this interests you please sign up for a 30-minute meeting where we can onboard you. 

https://calendly.com/aidan-nt76/coldreach-aidan-nguyen-tran`;

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  founding_engineer_email_sent_at: string | null;
  founding_engineer_email_sent_status: 'pending' | 'sent' | 'failed' | null;
  founding_engineer_email_error: string | null;
}

async function main() {
  // Dynamically import email function AFTER env vars are verified
  // This prevents lib/supabase.ts from loading before env vars are set
  const { sendWaitlistEmail } = await import('../../../lib/sendgrid');
  
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!sendgridApiKey && !isDryRun) {
    console.error('❌ Missing SENDGRID_API_KEY environment variable');
    console.error('   Add SENDGRID_API_KEY to your .env.local file');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📧 Founding Engineer Email Sender (SendGrid)');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent\n');
  }

  if (resendFailed) {
    console.log('🔄 Resending failed emails\n');
  }

  if (limit) {
    console.log(`📊 Limiting to ${limit} emails\n`);
  }

  if (testEmail) {
    console.log(`🎯 Testing with email: ${testEmail}\n`);
  }

  // Fetch waitlist entries
  let query = supabaseAdmin
    .from('waitlist')
    .select('id, email, created_at, founding_engineer_email_sent_at, founding_engineer_email_sent_status, founding_engineer_email_error')
    .order('created_at', { ascending: true });

  // Filter by specific email if provided (for testing)
  if (testEmail) {
    query = query.eq('email', testEmail);
  }

  if (resendFailed) {
    // Only fetch failed emails
    query = query.eq('founding_engineer_email_sent_status', 'failed');
  } else {
    // Fetch emails that haven't been sent yet
    // Only get entries where founding_engineer_email_sent_status is NULL (never sent) or NULL founding_engineer_email_sent_at
    // Exclude 'pending' to avoid duplicates if script was interrupted
    // If testing with specific email, allow resending even if already sent
    if (!testEmail) {
      query = query.or('founding_engineer_email_sent_status.is.null,founding_engineer_email_sent_at.is.null');
    }
  }

  const { data: waitlistEntries, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ Error fetching waitlist:', fetchError);
    process.exit(1);
  }

  if (!waitlistEntries || waitlistEntries.length === 0) {
    console.log('✅ No emails to send!');
    if (resendFailed) {
      console.log('   No failed emails found.');
    } else {
      console.log('   All founding engineer emails have already been sent.');
    }
    process.exit(0);
  }

  const totalEmails = waitlistEntries.length;
  const emailsToSend = limit ? waitlistEntries.slice(0, limit) : waitlistEntries;
  const actualCount = emailsToSend.length;

  console.log(`📋 Found ${totalEmails} ${resendFailed ? 'failed' : 'pending'} email(s)`);
  if (limit) {
    console.log(`   Processing ${actualCount} email(s) (limited)\n`);
  } else {
    console.log(`   Processing all ${actualCount} email(s)\n`);
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Process emails with rate limiting
  const RATE_LIMIT_DELAY_MS = 100; // 100ms delay ~10 emails/second

  for (let i = 0; i < emailsToSend.length; i++) {
    const entry = emailsToSend[i] as WaitlistEntry;
    const progress = `[${i + 1}/${actualCount}]`;

    if (isDryRun) {
      console.log(`${progress} Would send to: ${entry.email}`);
      skippedCount++;
      continue;
    }

    // Double-check this entry hasn't been sent already (race condition protection)
    // Re-fetch the entry to ensure founding_engineer_email_sent_at is still null
    const { data: currentEntry } = await supabaseAdmin
      .from('waitlist')
      .select('founding_engineer_email_sent_at, founding_engineer_email_sent_status')
      .eq('id', entry.id)
      .single();
    
    if (currentEntry?.founding_engineer_email_sent_at) {
      console.log(`${progress} ⏭️  Skipping ${entry.email} - already sent at ${currentEntry.founding_engineer_email_sent_at}`);
      skippedCount++;
      continue;
    }

    // Replace email placeholder in unsubscribe link (text-only)
    const textContent = EMAIL_TEXT.replace(/\{\{email\}\}/g, encodeURIComponent(entry.email));

    // Update status to 'pending' before sending (atomic update to prevent race conditions)
    const { error: pendingError } = await supabaseAdmin
      .from('waitlist')
      .update({ founding_engineer_email_sent_status: 'pending' })
      .eq('id', entry.id)
      .is('founding_engineer_email_sent_at', null); // Only update if founding_engineer_email_sent_at is still null
    
    if (pendingError) {
      console.error(`${progress} ⚠️  Failed to set pending status for ${entry.email}:`, pendingError);
      skippedCount++;
      continue;
    }

    // Send email using sendWaitlistEmail (bypasses marketing email preference check)
    const result = await sendWaitlistEmail(
      entry.email,
      EMAIL_SUBJECT,
      '',  // No HTML content (plain text only)
      textContent
    );

    if (result.success) {
      // Update database with success
      const { error: updateError } = await supabaseAdmin
        .from('waitlist')
        .update({
          founding_engineer_email_sent_at: new Date().toISOString(),
          founding_engineer_email_sent_status: 'sent',
          founding_engineer_email_error: null,
          founding_engineer_email_sent: true,
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`${progress} ⚠️  Sent to ${entry.email} but failed to update database:`, updateError);
      } else {
        console.log(`${progress} ✅ Sent to ${entry.email}`);
        sentCount++;
      }
    } else {
      // Update database with failure
      const { error: updateError } = await supabaseAdmin
        .from('waitlist')
        .update({
          founding_engineer_email_sent_status: 'failed',
          founding_engineer_email_error: result.error || 'Unknown error',
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`${progress} ❌ Failed to send to ${entry.email} and failed to update database:`, updateError);
      } else {
        console.error(`${progress} ❌ Failed to send to ${entry.email}: ${result.error}`);
      }
      failedCount++;
    }

    // Rate limiting - delay between sends (except for last email)
    if (i < emailsToSend.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('📊 Summary (SendGrid)');
  console.log('==========================================');
  console.log(`Total processed: ${actualCount}`);
  console.log(`✅ Sent: ${sentCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  if (isDryRun) {
    console.log(`🔍 Skipped (dry run): ${skippedCount}`);
  }
  if (limit && totalEmails > limit) {
    console.log(`\n⚠️  Note: ${totalEmails - limit} more email(s) remain to be sent`);
    console.log(`   Run again without --limit to send remaining emails`);
  }
  if (failedCount > 0 && !resendFailed) {
    console.log(`\n💡 Tip: Run with --resend-failed to retry failed emails`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

