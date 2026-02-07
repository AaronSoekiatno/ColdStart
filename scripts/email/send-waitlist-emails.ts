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
import { sendWaitlistEmail } from '../../lib/resend';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const resendFailed = args.includes('--resend-failed');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Email content - customize these for your launch announcement
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai';
const EMAIL_SUBJECT = process.env.WAITLIST_EMAIL_SUBJECT || 'Agencity is Now Live';
const EMAIL_HTML = process.env.WAITLIST_EMAIL_HTML || `
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
                          <img src="${APP_URL}/images/hermes.png" alt="Agencity Logo" width="64" height="64" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 64px; height: auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 36px; font-weight: 600; color: #f5f5f7; letter-spacing: -0.5px; line-height: 1.2;">
                      Agencity
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 4px; color: #d4a853;">
                      Is Now Live
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
        <p style="text-align: center; font-size: 18px; line-height: 1.7; color: #f5f5f7; margin: 0 0 40px;">
          We're thrilled to announce that <span style="font-weight: 600; color: #d4a853;">Agencity</span> has officially launched! Connect directly with YC founders and land your dream startup internship with AI-powered cold emails.
        </p>

        <!-- Features Section -->
        <div style="margin-top: 40px;">
          <h2 style="text-align: center; font-size: 24px; font-weight: 500; color: #f5f5f7; margin: 0 0 24px;">
            What's Inside
          </h2>
          
          <!-- Feature 1 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">⚡</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">AI-Powered Cold Emails</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Generate personalized cold emails tailored to each founder and startup. Three distinct personas to match your style.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 2 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Y_Combinator_logo.svg/1200px-Y_Combinator_logo.svg.png" alt="YC Logo" style="width: 26px; height: 26px; object-fit: contain; display: inline-block; vertical-align: middle;" />
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">YC Founder Database</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Access verified contact information for hundreds of YC startup founders actively hiring interns.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 3 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">🤝</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">Smart Matching</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Upload your resume and get matched with startups that align with your skills, interests, and experience.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 4 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;" align="center">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 22px; line-height: 40px; display: inline-block;">📧</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">Email Tracking</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Track your outreach progress and manage all your startup communications in one place.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="margin-top: 40px; text-align: center;">
          <a href="https://agencity.co" 
             style="display: inline-block; background: linear-gradient(135deg, #d4a853 0%, #c9a356 100%); color: #0f0f1a; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 10px 25px rgba(212, 168, 83, 0.25);">
            Get Started Now
          </a>
          <p style="margin: 16px 0 0; font-size: 14px; color: #a1a1aa;">
            Free to start • Premium features available
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #2a2a4a; background-color: rgba(15, 15, 26, 0.6); padding: 32px;">
        <div style="text-align: center;">
          <div style="margin: 0 auto 16px; width: 40px; height: 40px; background-color: #0f0f1a; border-radius: 12px; overflow: hidden;">
            <img src="${APP_URL}/images/hermes.png" alt="Agencity" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <p style="margin: 0; font-size: 14px; color: #a1a1aa;">
            © 2025 Agencity. All rights reserved.
          </p>
          <div style="margin-top: 16px;">
            <a href="${APP_URL}/privacy" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Privacy Policy</a>
            <a href="${APP_URL}/terms" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Terms of Service</a>
            <a href="${APP_URL}/unsubscribe?email={{email}}" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Unsubscribe</a>
          </div>
          <p style="margin: 12px 0 0; font-size: 11px; color: rgba(161, 161, 170, 0.6);">
            You're receiving this email because you signed up for Agencity updates.
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `
AGENCITY IS NOW LIVE
==================

We're thrilled to announce that Agencity has officially launched! Connect directly with YC founders and land your dream startup internship with AI-powered cold emails.

WHAT'S INSIDE
-------------

⚡ AI-Powered Cold Emails
Generate personalized cold emails tailored to each founder and startup. Three distinct personas to match your style.

🎯 YC Founder Database
Access verified contact information for hundreds of YC startup founders actively hiring interns.

📊 Smart Matching
Upload your resume and get matched with startups that align with your skills, interests, and experience.

📧 Email Tracking
Track your outreach progress and manage all your startup communications in one place.

GET STARTED: ${APP_URL}

Free to start • Premium features available

---
© 2025 Agencity. All rights reserved.

Agencity

Privacy Policy: ${APP_URL}/privacy
Terms of Service: ${APP_URL}/terms
Unsubscribe: ${APP_URL}/unsubscribe?email={{email}}

You're receiving this email because you signed up for Agencity updates.
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
