#!/usr/bin/env tsx
/**
 * Script to send beta assessment invitation campaign to waitlist via SendGrid
 * 
 * This campaign invites waitlist users to test the new AI-native coding assessment.
 * 
 * Usage:
 *   npm run send-campaign:beta -- --dry-run        # Preview what would be sent
 *   npm run send-campaign:beta -- --limit=10       # Send to first 10 emails (testing)
 *   npm run send-campaign:beta                     # Send to all waitlist emails
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

// Now import other modules after env is loaded
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import sgMail from '@sendgrid/mail';


// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
const emailArg = args.find(arg => arg.startsWith('--email='));
const targetEmail = emailArg ? emailArg.split('=')[1] : undefined;

// Email configuration
const CALENDLY_LINK = 'https://calendly.com/aidan-nt76/coldreach-aidan-nguyen-tran';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'robert@joinhermes.co';
const FROM_NAME = 'Robert from Hermes';

// Email subject
const SUBJECT = 'Beta Access: 20-Min AI Coding Assessment | Hermes';

// HTML email template
const EMAIL_HTML = (firstName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7; color: #1d1d1f;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="padding: 32px; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);">
      <div style="text-align: center;">
        <div style="margin: 0 auto 16px; width: 60px; height: 60px; background-color: #ffffff; border-radius: 12px; display: inline-block; padding: 8px;">
          <img src="${APP_URL}/images/hermes.png" alt="Hermes" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
          Hey ${firstName}
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: #d4a853; text-transform: uppercase; letter-spacing: 2px;">
          Beta Invitation
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #1d1d1f; margin: 0 0 20px;">
        Our mission at Hermes is to get you a job by introducing you to founders.
      </p>

      <p style="font-size: 16px; line-height: 1.6; color: #1d1d1f; margin: 0 0 24px;">
        We value your input as we launch a new product. We would like to offer you a seat in our beta test:
      </p>

      <!-- Features List -->
      <div style="background-color: #f5f5f7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 12px;">
          <span style="color: #d4a853; font-size: 18px; margin-right: 8px;">⏱️</span>
          <strong style="color: #1d1d1f;">20 min AI-native coding assessment</strong>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #d4a853; font-size: 18px; margin-right: 8px;">💻</span>
          <strong style="color: #1d1d1f;">Cursor required</strong>
        </div>
        <div>
          <span style="color: #d4a853; font-size: 18px; margin-right: 8px;">🚀</span>
          <strong style="color: #1d1d1f;">Profile shared with YC startups</strong>
        </div>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #1d1d1f; margin: 0 0 28px;">
        Schedule a call with us and we'll help you get setup:
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${CALENDLY_LINK}" 
           style="display: inline-block; background: linear-gradient(135deg, #d4a853 0%, #c9a356 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(212, 168, 83, 0.3);">
          Schedule Your Call
        </a>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #1d1d1f; margin: 0;">
        Thanks!<br>
        <strong>Robert</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e5e7; padding: 24px 32px; background-color: #fafafa; text-align: center;">
      <div style="margin-bottom: 12px;">
        <img src="${APP_URL}/images/hermes.png" alt="Hermes" style="width: 32px; height: 32px; display: inline-block;" />
      </div>
      <p style="margin: 0 0 8px; font-size: 12px; color: #86868b;">
        © 2025 Hermes. All rights reserved.
      </p>
      <div style="margin-top: 12px;">
        <a href="${APP_URL}" style="font-size: 12px; color: #06c; text-decoration: none; margin: 0 8px;">Hermes</a>
        <span style="color: #d2d2d7;">•</span>
        <a href="${APP_URL}/privacy" style="font-size: 12px; color: #06c; text-decoration: none; margin: 0 8px;">Privacy</a>
        <span style="color: #d2d2d7;">•</span>
        <a href="${APP_URL}/terms" style="font-size: 12px; color: #06c; text-decoration: none; margin: 0 8px;">Terms</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Plain text version
const EMAIL_TEXT = (firstName: string) => `
Hey ${firstName},

Our mission at Hermes is to get you a job by introducing you to founders.

We value your input as we launch a new product. We would like to offer you a seat in our beta test:

⏱️ 20 min AI-native coding assessment
💻 Cursor required
🚀 Profile shared with YC startups

Schedule a call with us and we'll help you get setup:
${CALENDLY_LINK}

Thanks!
Robert

---
© 2025 Hermes. All rights reserved.
${APP_URL}
`;

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

  console.log('🎯 Beta Assessment Invitation Campaign');
  console.log('=======================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent\n');
  }

  if (limit) {
    console.log(`📊 Limiting to ${limit} emails\n`);
  }

  if (targetEmail) {
    console.log(`🎯 Targeting specific email: ${targetEmail}\n`);
  }

  // Get all waitlist emails
  console.log('📋 Fetching waitlist emails...');
  
  let query = supabaseAdmin
    .from('waitlist')
    .select('email');

  // If targeting a specific email, filter by that email
  if (targetEmail) {
    query = query.eq('email', targetEmail);
  } else {
    query = query.order('created_at', { ascending: true });
  }

  const { data: waitlist, error: waitlistError } = await query;

  if (waitlistError) {
    console.error('❌ Error fetching waitlist:', waitlistError);
    process.exit(1);
  }

  if (!waitlist || waitlist.length === 0) {
    console.log('✅ No emails in waitlist!');
    process.exit(0);
  }

  const totalEmails = waitlist.length;
  const emailsToSend = limit ? waitlist.slice(0, limit) : waitlist;
  const actualCount = emailsToSend.length;

  console.log(`📋 Found ${totalEmails} email(s) in waitlist`);
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
    const entry = emailsToSend[i];
    const progress = `[${i + 1}/${actualCount}]`;
    const email = entry.email;

    // Extract first name from email
    const firstName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);

    if (isDryRun) {
      console.log(`${progress} Would send to: ${email} (as ${firstName})`);
      skippedCount++;
      continue;
    }

    // Initialize SendGrid (only once)
    if (!isDryRun && sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
    }

    // Send email using SendGrid directly
    try {
      const msg = {
        to: email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: SUBJECT,
        html: EMAIL_HTML(firstName),
        text: EMAIL_TEXT(firstName),
        categories: ['waitlist', 'beta-campaign'],
        customArgs: {
          category: 'beta-campaign',
        },
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
          openTracking: {
            enable: false,
          },
        },
      };

      await sgMail.send(msg);
      console.log(`${progress} ✅ Sent to ${email}`);
      sentCount++;
    } catch (error: any) {
      const errorMessage = error?.response?.body?.errors?.map((e: any) => e.message).join(', ') || error?.message || 'Unknown error';
      console.error(`${progress} ❌ Failed to send to ${email}: ${errorMessage}`);
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
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
