#!/usr/bin/env tsx
/**
 * Script to send user campaign emails to active users (user_type='user') via SendGrid
 * 
 * This campaign targets users who are active on the platform.
 * Goal: Drive re-engagement and encourage return visits.
 * 
 * Usage:
 *   npm run send-campaign:users -- --dry-run              # Preview what would be sent
 *   npm run send-campaign:users -- --limit=10             # Send to first 10 emails (testing)
 *   npm run send-campaign:users                           # Send to all pending emails
 *   npm run send-campaign:users -- --resend-failed        # Retry emails that previously failed
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { sendCampaignEmail } from '../../../lib/sendgrid';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const resendFailed = args.includes('--resend-failed');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Email content - customize these for your user re-engagement campaign
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co';
const EMAIL_SUBJECT = process.env.USER_CAMPAIGN_SUBJECT || 'You have new matches waiting | Hermes';

// TODO: Customize this HTML template for your user re-engagement campaign
const EMAIL_HTML = process.env.USER_CAMPAIGN_HTML || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f1a;">
  <div style="min-height: 100%; background-color: #0f0f1a; padding: 32px 16px;">
    <!-- Email Container -->
    <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a2e; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
      
      <!-- Header with Logo -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 50%, #1a1a2e 100%); padding: 48px 32px; text-align: center; position: relative;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" valign="middle">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" valign="middle" style="padding-bottom: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" valign="middle" style="width: 80px; height: 80px; background-color: #0f0f1a; border-radius: 16px; padding: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); border: 1px solid #2a2a4a;">
                          <img src="${APP_URL}/images/hermes.png" alt="Hermes Logo" width="64" height="64" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 64px; height: auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 36px; font-weight: 600; color: #f5f5f7; letter-spacing: -0.5px; line-height: 1.2;">
                      Come Back and Explore
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 4px; color: #d4a853;">
                      New Matches Waiting
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Content -->
      <div style="padding: 40px 32px;">
        <p style="font-size: 18px; line-height: 1.7; color: #f5f5f7; margin: 0 0 40px;">
          We've been working hard to find you great startup matches. There are new opportunities waiting for you on Hermes!
        </p>

        <!-- Re-engagement reasons -->
        <div style="margin-top: 40px;">
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">🎯</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">New Startup Matches</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Discover new YC startups that match your skills and interests. Our matching algorithm is always finding better fits.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">⚡</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">AI Email Generator</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Generate personalized cold emails in seconds. Try different personas to match your communication style.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">📊</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">Track Your Progress</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Keep track of your outreach and see which emails are getting responses. Your dashboard has all the insights you need.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="margin-top: 40px; text-align: center;">
          <a href="${APP_URL}/matches" 
             style="display: inline-block; background: linear-gradient(135deg, #d4a853 0%, #c9a356 100%); color: #0f0f1a; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 10px 25px rgba(212, 168, 83, 0.25);">
            View Matches
          </a>
          <p style="margin: 16px 0 0; font-size: 14px; color: #a1a1aa;">
            Continue your journey • See what's new
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #2a2a4a; background-color: rgba(15, 15, 26, 0.6); padding: 32px;">
        <div style="text-align: center;">
          <div style="margin: 0 auto 16px; width: 40px; height: 40px; background-color: #0f0f1a; border-radius: 12px; overflow: hidden;">
            <img src="${APP_URL}/images/hermes.png" alt="Hermes" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <p style="margin: 0; font-size: 14px; color: #a1a1aa;">
            © 2025 Hermes. All rights reserved.
          </p>
          <div style="margin-top: 16px;">
            <a href="${APP_URL}/privacy" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Privacy Policy</a>
            <a href="${APP_URL}/terms" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Terms of Service</a>
            <a href="${APP_URL}/unsubscribe?token={{unsubscribe_token}}" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Unsubscribe</a>
          </div>
          <p style="margin: 12px 0 0; font-size: 11px; color: rgba(161, 161, 170, 0.6);">
            You're receiving this email because you're an active Hermes user.
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const EMAIL_TEXT = process.env.USER_CAMPAIGN_TEXT || `
COME BACK AND EXPLORE

We've been working hard to find you great startup matches. There are new opportunities waiting for you on Hermes!

NEW STARTUP MATCHES
Discover new YC startups that match your skills and interests. Our matching algorithm is always finding better fits.

AI EMAIL GENERATOR
Generate personalized cold emails in seconds. Try different personas to match your communication style.

TRACK YOUR PROGRESS
Keep track of your outreach and see which emails are getting responses. Your dashboard has all the insights you need.

VIEW MATCHES: ${APP_URL}/matches

Continue your journey • See what's new

---
© 2025 Hermes. All rights reserved.

Privacy Policy: ${APP_URL}/privacy
Terms of Service: ${APP_URL}/terms
Unsubscribe: ${APP_URL}/unsubscribe?token={{unsubscribe_token}}

You're receiving this email because you're an active Hermes user.
`;

interface EmailPreferencesEntry {
  email: string;
  unsubscribe_token: string | null;
  marketing_emails_enabled: boolean;
  unsubscribed_at: string | null;
  user_campaign_status: 'pending' | 'sent' | 'failed' | null;
  user_campaign_sent_at: string | null;
  user_campaign_error: string | null;
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

  console.log('📧 User Campaign Email Sender (SendGrid)');
  console.log('=========================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent\n');
  }

  if (resendFailed) {
    console.log('🔄 Resending failed emails\n');
  }

  if (limit) {
    console.log(`📊 Limiting to ${limit} emails\n`);
  }

  // First, get all user emails from waitlist table
  const { data: waitlistUsers, error: waitlistError } = await supabaseAdmin
    .from('waitlist')
    .select('email')
    .eq('user_type', 'user');

  if (waitlistError) {
    console.error('❌ Error fetching waitlist users:', waitlistError);
    process.exit(1);
  }

  if (!waitlistUsers || waitlistUsers.length === 0) {
    console.log('✅ No active users found in waitlist!');
    process.exit(0);
  }

  const userEmails = waitlistUsers.map(w => w.email);

  // Now fetch email_preferences for these users with proper filters
  let query = supabaseAdmin
    .from('email_preferences')
    .select('email, unsubscribe_token, marketing_emails_enabled, unsubscribed_at, user_campaign_status, user_campaign_sent_at, user_campaign_error')
    .in('email', userEmails)
    .eq('marketing_emails_enabled', true)
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: true });

  if (resendFailed) {
    // Only fetch failed emails
    query = query.eq('user_campaign_status', 'failed');
  } else {
    // Fetch emails that haven't been sent yet
    query = query.or('user_campaign_status.is.null,user_campaign_status.eq.pending');
  }

  const { data: entries, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ Error fetching email preferences:', fetchError);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log('✅ No emails to send!');
    if (resendFailed) {
      console.log('   No failed emails found.');
    } else {
      console.log('   All user campaign emails have already been sent.');
    }
    process.exit(0);
  }

  const totalEmails = entries.length;
  const emailsToSend = limit ? entries.slice(0, limit) : entries;
  const actualCount = emailsToSend.length;

  console.log(`📋 Found ${totalEmails} ${resendFailed ? 'failed' : 'pending'} user campaign email(s)`);
  if (limit) {
    console.log(`   Processing ${actualCount} email(s) (limited)\n`);
  } else {
    console.log(`   Processing all ${actualCount} email(s)\n`);
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Process emails with rate limiting
  const RATE_LIMIT_DELAY_MS = 100; // 100ms delay = ~10 emails/second

  for (let i = 0; i < emailsToSend.length; i++) {
    const entry = emailsToSend[i] as EmailPreferencesEntry;
    const progress = `[${i + 1}/${actualCount}]`;

    if (isDryRun) {
      console.log(`${progress} Would send to: ${entry.email}`);
      skippedCount++;
      continue;
    }

    // Replace unsubscribe token placeholder in email content
    const unsubscribeToken = entry.unsubscribe_token || '';
    const htmlContent = EMAIL_HTML.replace(/\{\{unsubscribe_token\}\}/g, encodeURIComponent(unsubscribeToken));
    const textContent = EMAIL_TEXT.replace(/\{\{unsubscribe_token\}\}/g, encodeURIComponent(unsubscribeToken));

    // Update status to 'pending' before sending
    await supabaseAdmin
      .from('email_preferences')
      .update({ user_campaign_status: 'pending' })
      .eq('email', entry.email);

    // Send email
    const result = await sendCampaignEmail(
      entry.email,
      EMAIL_SUBJECT,
      htmlContent,
      textContent,
      'user'
    );

    if (result.success) {
      // Update database with success
      const { error: updateError } = await supabaseAdmin
        .from('email_preferences')
        .update({
          user_campaign_sent_at: new Date().toISOString(),
          user_campaign_status: 'sent',
          user_campaign_error: null,
        })
        .eq('email', entry.email);

      if (updateError) {
        console.error(`${progress} ⚠️  Sent to ${entry.email} but failed to update database:`, updateError);
      } else {
        console.log(`${progress} ✅ Sent to ${entry.email}`);
        sentCount++;
      }
    } else {
      // Update database with failure
      const { error: updateError } = await supabaseAdmin
        .from('email_preferences')
        .update({
          user_campaign_status: 'failed',
          user_campaign_error: result.error || 'Unknown error',
        })
        .eq('email', entry.email);

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

