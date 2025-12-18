#!/usr/bin/env tsx
/**
 * Script to send launch announcement emails to all waitlist users via SendGrid API
 *
 * Usage:
 *   npm run send-waitlist:sendgrid -- --dry-run              # Preview what would be sent
 *   npm run send-waitlist:sendgrid -- --limit=10             # Send to first 10 emails (testing)
 *   npm run send-waitlist:sendgrid                           # Send to all pending emails
 *   npm run send-waitlist:sendgrid -- --resend-failed        # Retry emails that previously failed
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { sendWaitlistEmail } from '../../lib/sendgrid';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const resendFailed = args.includes('--resend-failed');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Email content - copied from scripts/send-waitlist-emails.ts so the message is identical
const APP_URL = 'https://joinhermes.co';
const EMAIL_SUBJECT = process.env.WAITLIST_EMAIL_SUBJECT || 'Hermes is Now Live';

// Plain-text waitlist email (no HTML template)
const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `Hey there,

You signed up for the Hermes waitlist a little while ago. I'm Robert, a founder of Hermes, and I've been building a simple way for students to reach YC founders directly with smarter, more targeted cold emails.

Hermes is now live, and I'd love for you to try it and tell me what feels confusing or missing.

Your early feedback is super valuable.

You can check it out here: ${APP_URL}

If you have 1–2 minutes, just hit reply and share:
- What you're looking for in a startup internship
- How you're currently reaching out to founders (if at all)

Best,
Robert

Hermes

If you don't want to hear about Hermes anymore, you can unsubscribe here:
${APP_URL}/unsubscribe?email={{email}}
`;

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  sent_at: string | null;
  sent_status: 'pending' | 'sent' | 'failed' | null;
  error_message: string | null;
}

async function main() {
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

  console.log('📧 Waitlist Email Sender (SendGrid)');
  console.log('==================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent\n');
  }

  if (resendFailed) {
    console.log('🔄 Resending failed emails\n');
  }

  if (limit) {
    console.log(`📊 Limiting to ${limit} emails\n`);
  }

  // Fetch waitlist entries
  let query = supabaseAdmin
    .from('waitlist')
    .select('id, email, created_at, sent_at, sent_status, error_message')
    .order('created_at', { ascending: true });

  if (resendFailed) {
    // Only fetch failed emails
    query = query.eq('sent_status', 'failed');
  } else {
    // Fetch emails that haven't been sent yet
    query = query.or('sent_status.is.null,sent_status.eq.pending');
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
      console.log('   All waitlist emails have already been sent.');
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

    // Replace email placeholder in unsubscribe link (text-only)
    const textContent = EMAIL_TEXT.replace(/\{\{email\}\}/g, encodeURIComponent(entry.email));

    // Update status to 'pending' before sending
    await supabaseAdmin
      .from('waitlist')
      .update({ sent_status: 'pending' })
      .eq('id', entry.id);

    // Send email
    const result = await sendWaitlistEmail(
      entry.email,
      EMAIL_SUBJECT,
      '',
      textContent
    );

    if (result.success) {
      // Update database with success
      const { error: updateError } = await supabaseAdmin
        .from('waitlist')
        .update({
          sent_at: new Date().toISOString(),
          sent_status: 'sent',
          error_message: null,
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
          sent_status: 'failed',
          error_message: result.error || 'Unknown error',
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
  console.log('\n==================================');
  console.log('📊 Summary (SendGrid)');
  console.log('==================================');
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


