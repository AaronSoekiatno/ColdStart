#!/usr/bin/env tsx
/**
 * Simple script to send the Hermes waitlist email to yourself via SendGrid
 *
 * Usage:
 *   npm run test-email:sendgrid your.email@gmail.com
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { sendWaitlistEmail } from '../../../lib/sendgrid';

const APP_URL = 'https://joinhermes.co';
const EMAIL_SUBJECT =
  process.env.WAITLIST_EMAIL_SUBJECT || 'Quick question about Hermes';

// Plain-text personal message (no HTML template)
const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `Hey there,

You signed up for the Hermes waitlist a little while ago. I'm Robert, a founder of Hermes, and I've been building a simple way for students to reach YC founders directly with smarter, more personal cold emails.

Hermes is now live, and I'd love for you to try it and tell me what feels confusing or missing.

Your early feedback is super valuable.

You can check it out here: ${APP_URL}

If you have 1–2 minutes, just hit reply and share:
- What you're looking for in a startup internship
- How you're currently reaching out to founders (if at all)

Best,
Robert

Hermes.ai
`;

async function main() {
  const testEmail = process.argv[2];

  if (!testEmail) {
    console.error('❌ Please provide an email address');
    console.error('   Usage: npm run test-email:sendgrid your.email@gmail.com');
    process.exit(1);
  }

  // Basic email validation
  if (!testEmail.includes('@') || !testEmail.includes('.')) {
    console.error('❌ Invalid email address format');
    process.exit(1);
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ Missing SENDGRID_API_KEY environment variable');
    process.exit(1);
  }

  console.log('📧 Sending test email via SendGrid...');
  console.log(`   To: ${testEmail}`);
  console.log(`   From: ${process.env.SENDGRID_FROM_EMAIL || 'hello@joinhermes.co'}`);
  console.log(`   Subject: ${EMAIL_SUBJECT}\n`);

  const textContent = EMAIL_TEXT.replace(/\{\{email\}\}/g, encodeURIComponent(testEmail));

  const result = await sendWaitlistEmail(
    testEmail,
    EMAIL_SUBJECT,
    '',
    textContent
  );

  if (result.success) {
    console.log('✅ Email sent successfully!');
    if (result.messageId) {
      console.log(`   Message ID: ${result.messageId}\n`);
    }
    console.log('📬 Next steps:');
    console.log('   1. Check your inbox for the email');
    console.log('   2. If not in inbox, check your spam/junk folder');
    console.log('   3. If in spam, mark it as "Not Spam" to improve reputation');
    console.log('   4. Check the email headers to see authentication results\n');
    console.log('💡 To check email headers:');
    console.log('   Gmail: Open email → Three dots → Show original');
    console.log('   Outlook: Open email → File → Properties → Internet headers');
  } else {
    console.error('❌ Failed to send email');
    console.error(`   Error: ${result.error}\n`);

    if (result.error?.includes('permission') || result.error?.includes('authenticated')) {
      console.error('💡 Make sure your domain is authenticated in SendGrid:');
      console.error('   https://app.sendgrid.com/settings/sender_auth');
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


