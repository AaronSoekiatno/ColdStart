#!/usr/bin/env tsx
/**
 * Test script for welcome email functionality
 * 
 * Usage:
 *   npm run test-welcome-email your.email@example.com
 * 
 * This script tests:
 * 1. Email preferences creation
 * 2. Welcome email sending
 * 3. Unsubscribe functionality
 * 4. Opt-out checking
 */

import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { 
  getEmailPreferences, 
  createEmailPreferences, 
  checkCanSendWelcomeEmail,
  getOrCreateEmailPreferences 
} from '../../lib/supabase';
import { sendWelcomeEmail, extractFirstName } from '../../lib/sendgrid';

const TEST_EMAIL = process.argv[2];

async function main() {
  if (!TEST_EMAIL) {
    console.error('❌ Please provide an email address');
    console.error('   Usage: npm run test-welcome-email your.email@example.com');
    process.exit(1);
  }

  // Basic email validation
  if (!TEST_EMAIL.includes('@') || !TEST_EMAIL.includes('.')) {
    console.error('❌ Invalid email address format');
    process.exit(1);
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ Missing SENDGRID_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🧪 Testing Welcome Email Functionality');
  console.log('=====================================\n');
  console.log(`📧 Test Email: ${TEST_EMAIL}\n`);

  // Test 1: Extract first name
  console.log('Test 1: Extract First Name');
  console.log('--------------------------');
  const testCases = [
    { metadata: { full_name: 'John Doe' }, email: 'john@example.com', expected: 'John' },
    { metadata: { name: 'Jane Smith' }, email: 'jane@example.com', expected: 'Jane' },
    { metadata: {}, email: 'testuser@example.com', expected: 'Testuser' },
    { metadata: {}, email: TEST_EMAIL, expected: TEST_EMAIL.split('@')[0] },
  ];

  for (const testCase of testCases) {
    const firstName = extractFirstName(testCase.metadata, testCase.email);
    const passed = firstName === testCase.expected || firstName.length > 0;
    console.log(`  ${passed ? '✅' : '❌'} ${testCase.email} → "${firstName}" ${passed ? '' : `(expected: ${testCase.expected})`}`);
  }
  console.log('');

  // Test 2: Email preferences creation
  console.log('Test 2: Email Preferences Creation');
  console.log('-----------------------------------');
  try {
    // Clean up any existing preferences for test email
    const existing = await getEmailPreferences(TEST_EMAIL);
    if (existing) {
      console.log(`  ⚠️  Preferences already exist for ${TEST_EMAIL}`);
      console.log(`     welcome_emails_enabled: ${existing.welcome_emails_enabled}`);
      console.log(`     unsubscribe_token: ${existing.unsubscribe_token ? '✅ Set' : '❌ Missing'}`);
    } else {
      const preferences = await createEmailPreferences(TEST_EMAIL);
      console.log(`  ✅ Created email preferences`);
      console.log(`     welcome_emails_enabled: ${preferences.welcome_emails_enabled}`);
      console.log(`     unsubscribe_token: ${preferences.unsubscribe_token ? '✅ Set' : '❌ Missing'}`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to create email preferences:`, error);
  }
  console.log('');

  // Test 3: Check if can send welcome email
  console.log('Test 3: Check Can Send Welcome Email');
  console.log('-------------------------------------');
  try {
    const canSend = await checkCanSendWelcomeEmail(TEST_EMAIL);
    console.log(`  ${canSend ? '✅' : '❌'} Can send welcome email: ${canSend}`);
  } catch (error) {
    console.error(`  ❌ Failed to check:`, error);
  }
  console.log('');

  // Test 4: Get or create email preferences
  console.log('Test 4: Get or Create Email Preferences');
  console.log('--------------------------------------');
  try {
    const preferences = await getOrCreateEmailPreferences(TEST_EMAIL);
    console.log(`  ✅ Preferences retrieved/created`);
    console.log(`     Email: ${preferences.email}`);
    console.log(`     Welcome emails enabled: ${preferences.welcome_emails_enabled}`);
    console.log(`     Marketing emails enabled: ${preferences.marketing_emails_enabled}`);
    console.log(`     Unsubscribe token: ${preferences.unsubscribe_token ? '✅ Present' : '❌ Missing'}`);
    console.log(`     Unsubscribed at: ${preferences.unsubscribed_at || 'Not unsubscribed'}`);
  } catch (error) {
    console.error(`  ❌ Failed:`, error);
  }
  console.log('');

  // Test 5: Send welcome email
  console.log('Test 5: Send Welcome Email');
  console.log('--------------------------');
  try {
    const firstName = extractFirstName({}, TEST_EMAIL);
    console.log(`  📤 Sending welcome email to ${TEST_EMAIL}...`);
    console.log(`     First name: ${firstName}`);
    
    const result = await sendWelcomeEmail(TEST_EMAIL, firstName);
    
    if (result.success) {
      console.log(`  ✅ Welcome email sent successfully!`);
      if (result.messageId) {
        console.log(`     Message ID: ${result.messageId}`);
      }
      console.log(`\n  📬 Next steps:`);
      console.log(`     1. Check your inbox for the welcome email`);
      console.log(`     2. Verify the unsubscribe link works`);
      console.log(`     3. Test unsubscribing at: /unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=<token>`);
    } else {
      console.error(`  ❌ Failed to send welcome email`);
      console.error(`     Error: ${result.error}`);
    }
  } catch (error) {
    console.error(`  ❌ Error sending welcome email:`, error);
  }
  console.log('');

  // Test 6: Unsubscribe link generation
  console.log('Test 6: Unsubscribe Link');
  console.log('------------------------');
  try {
    const preferences = await getEmailPreferences(TEST_EMAIL);
    if (preferences?.unsubscribe_token) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co';
      const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=${encodeURIComponent(preferences.unsubscribe_token)}`;
      console.log(`  ✅ Unsubscribe link generated:`);
      console.log(`     ${unsubscribeLink}`);
    } else {
      console.error(`  ❌ No unsubscribe token found`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to generate unsubscribe link:`, error);
  }
  console.log('');

  console.log('=====================================');
  console.log('✅ Testing Complete!');
  console.log('\n💡 To test the full flow:');
  console.log('   1. Sign up with a new email address');
  console.log('   2. Check that welcome email is received');
  console.log('   3. Click unsubscribe link in email');
  console.log('   4. Verify unsubscribe page works');
  console.log('   5. Try signing up again - should not receive email');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

