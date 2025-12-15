#!/usr/bin/env tsx
/**
 * Script to send launch announcement emails to all waitlist users via Resend API
 * 
 * Usage:
 *   npm run send-waitlist -- --dry-run              # Preview what would be sent
 *   npm run send-waitlist -- --limit 10             # Send to first 10 emails (testing)
 *   npm run send-waitlist                           # Send to all pending emails
 *   npm run send-waitlist -- --resend-failed        # Retry emails that previously failed
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { sendWaitlistEmail } from '../lib/resend';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const resendFailed = args.includes('--resend-failed');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Email content - customize these for your launch announcement
const EMAIL_SUBJECT = process.env.WAITLIST_EMAIL_SUBJECT || 'ColdStart is Live! 🚀';
const EMAIL_HTML = process.env.WAITLIST_EMAIL_HTML || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">ColdStart is Live! 🚀</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Thank you for joining our waitlist! We're excited to announce that ColdStart is now live.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You can now start using ColdStart to connect with YC founders and land your dream internship.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
      If you have any questions, feel free to reach out to us.
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      You're receiving this email because you signed up for the ColdStart waitlist.
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}/unsubscribe?email={{email}}" style="color: #667eea;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
`;

const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `
ColdStart is Live! 🚀

Thank you for joining our waitlist! We're excited to announce that ColdStart is now live.

You can now start using ColdStart to connect with YC founders and land your dream internship.

Get started: ${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}

If you have any questions, feel free to reach out to us.

You're receiving this email because you signed up for the ColdStart waitlist.
Unsubscribe: ${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}/unsubscribe?email={{email}}
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
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!resendApiKey && !isDryRun) {
    console.error('❌ Missing RESEND_API_KEY environment variable');
    console.error('   Add RESEND_API_KEY to your .env.local file');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📧 Waitlist Email Sender');
  console.log('========================\n');

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
  const RATE_LIMIT_DELAY_MS = 100; // 100ms delay = ~10 emails/second (well under Resend's 100/second limit)

  for (let i = 0; i < emailsToSend.length; i++) {
    const entry = emailsToSend[i] as WaitlistEntry;
    const progress = `[${i + 1}/${actualCount}]`;

    if (isDryRun) {
      console.log(`${progress} Would send to: ${entry.email}`);
      skippedCount++;
      continue;
    }

    // Replace email placeholder in unsubscribe link
    const htmlContent = EMAIL_HTML.replace(/\{\{email\}\}/g, encodeURIComponent(entry.email));
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
      htmlContent,
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
  console.log('\n========================');
  console.log('📊 Summary');
  console.log('========================');
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
