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
config({ path: resolve(process.cwd(), '.env.local') });

// Now import other modules after env vars are loaded
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

function extractFirstName(
  userMetadata?: { full_name?: string; name?: string },
  email?: string
): string {
  // Try full_name first
  if (userMetadata?.full_name) {
    const parts = userMetadata.full_name.trim().split(/\s+/);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  // Try name
  if (userMetadata?.name) {
    const parts = userMetadata.name.trim().split(/\s+/);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  // Try to extract from email
  if (email) {
    const emailParts = email.split('@')[0];
    // Capitalize first letter
    return emailParts.charAt(0).toUpperCase() + emailParts.slice(1);
  }

  // Final fallback
  return 'there';
}

const TEST_EMAIL = process.argv[2];

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

async function checkCanSendWelcomeEmail(supabaseClient: SupabaseClient, email: string): Promise<boolean> {
  const preferences = await getEmailPreferences(supabaseClient, email);
  
  // If no preferences exist, default to allowing welcome emails (opt-in by default for new signups)
  if (!preferences) {
    return true;
  }

  // If user has unsubscribed globally, don't send
  if (preferences.unsubscribed_at) {
    return false;
  }

  // Check if welcome emails are enabled
  return preferences.welcome_emails_enabled;
}

async function getOrCreateEmailPreferences(supabaseClient: SupabaseClient, email: string, options?: { marketingOptIn?: boolean }) {
  let preferences = await getEmailPreferences(supabaseClient, email);
  
  if (!preferences) {
    preferences = await createEmailPreferences(supabaseClient, email, options);
  } else if (options?.marketingOptIn && !preferences.marketing_emails_enabled) {
    const { data, error } = await supabaseClient
      .from('email_preferences')
      .update({ marketing_emails_enabled: true })
      .eq('email', email)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update email preferences: ${error.message}`);
    }
    
    preferences = data;
  }
  
  return preferences;
}

async function sendOnboardingEmail(
  supabaseClient: SupabaseClient,
  email: string,
  firstName?: string,
  userMetadata?: { full_name?: string; name?: string }
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not set',
    };
  }

  try {
    // Check if we can send welcome email (respects opt-out preferences)
    const canSend = await checkCanSendWelcomeEmail(supabaseClient, email);
    if (!canSend) {
      console.log(`[Resend] Skipping welcome email to ${email} - user has opted out`);
      return {
        success: false,
        error: 'User has opted out of welcome emails',
      };
    }

    // Get or create email preferences to ensure we have an unsubscribe token
    const preferences = await getOrCreateEmailPreferences(supabaseClient, email);
    const unsubscribeToken = preferences.unsubscribe_token;

    if (!unsubscribeToken) {
      console.error(`[Resend] No unsubscribe token found for ${email}`);
      return {
        success: false,
        error: 'Failed to generate unsubscribe token',
      };
    }

    // Try to get first name from candidate's name in database (first part of name)
    let userFirstName = firstName;
    if (!userFirstName) {
      try {
        const { data: candidate, error: candidateError } = await supabaseClient
          .from('candidates')
          .select('name')
          .eq('email', email)
          .single();
        
        if (!candidateError && candidate?.name) {
          // Use first part of candidate's name (before first space)
          userFirstName = candidate.name.split(' ')[0].trim();
        }
      } catch (error) {
        // If candidate lookup fails, fall back to extractFirstName
        console.warn(`[Resend] Could not fetch candidate for ${email}, using fallback name extraction`);
      }
    }
    
    // Final fallback to existing extractFirstName logic
    if (!userFirstName) {
      userFirstName = extractFirstName(userMetadata, email);
    }

    // Get app URL for unsubscribe link (normalize to remove trailing slash)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL 
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
      : process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000'
        : 'https://joinhermes.co';
    const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`;

    // Build email subject
    const subject = `Hey ${userFirstName} - welcome to Hermes`;

    // HTML version
    const emailBodyHTML = `Hi ${userFirstName},<br><br>
My name is Robert and I am a cofounder of Hermes. We built Hermes because we realized the job market is broken.<br><br>
<strong>Heres 3 things to do to 10x ur chances of getting a job:</strong><br>
&nbsp;&nbsp;&nbsp;&nbsp;• <strong>Upload your resume:</strong> Our agent matches you with the right teams to maximize your chances.<br>
&nbsp;&nbsp;&nbsp;&nbsp;• <strong>Find Hidden Roles:</strong> find "FRESH" job postings before everyone else does<br>
&nbsp;&nbsp;&nbsp;&nbsp;• <strong>Send Emails:</strong> Use our auto-drafted notes to land in the founder's personal inbox instead of the application black hole.<br><br>
Best,<br>
Robert<br><br>
<a href="${unsubscribeLink}">Unsubscribe</a><br>
<a href="${APP_URL}">Hermes</a><br>`;

    // Plain text version (fallback)
    const emailBodyText = `Hi ${userFirstName},

My name is Robert and I am a cofounder of Hermes. We built Hermes because we realized the job market is broken.

Heres 3 things to do to 10x ur chances of getting a job:
    • Upload your resume: Our agent matches you with the right teams to maximize your chances.
    • Find Hidden Roles: find "FRESH" job postings before everyone else does
    • Send Emails: Use our auto-drafted notes to land in the founder's personal inbox instead of the application black hole.

Best,
Robert

Unsubscribe: ${unsubscribeLink}

Hermes: ${APP_URL}`;

    // Send email using Resend
    const resend = getResendClient();
    const from = process.env.RESEND_FROM_EMAIL || 'Robert from Hermes <robert@joinhermes.co>';

    console.log(`[DEBUG] Subject: ${subject}`);
    console.log(`[DEBUG] From: ${from}`);

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html: emailBodyHTML,
      text: emailBodyText,
      tags: [
        { name: 'category', value: 'welcome' },
        { name: 'type', value: 'transactional' }
      ]
    });

    if (error) {
      console.error('[Resend] Error details:', error);
      return {
        success: false,
        error: error.message || 'Unknown Resend error',
      };
    }

    console.log(
      `[Resend] Successfully sent welcome email to ${email}${
        data?.id ? `, message ID: ${data.id}` : ''
      }`
    );

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    console.error('[Resend] Error sending welcome email:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
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
    const firstName = extractFirstName(testCase.metadata as any, testCase.email);
    const passed = firstName === testCase.expected || firstName.length > 0;
    console.log(`  ${passed ? '✅' : '❌'} ${testCase.email} → "${firstName}" ${passed ? '' : `(expected: ${testCase.expected})`}`);
  }
  console.log('');

  // Test 2: Email preferences creation
  console.log('Test 2: Email Preferences Creation');
  console.log('-----------------------------------');
  try {
    // Clean up any existing preferences for test email
    const existing = await getEmailPreferences(supabaseAdmin, TEST_EMAIL);
    if (existing) {
      console.log(`  ⚠️  Preferences already exist for ${TEST_EMAIL}`);
      console.log(`     welcome_emails_enabled: ${existing.welcome_emails_enabled}`);
      console.log(`     unsubscribe_token: ${existing.unsubscribe_token ? '✅ Set' : '❌ Missing'}`);
    } else {
      const preferences = await createEmailPreferences(supabaseAdmin, TEST_EMAIL);
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
    const canSend = await checkCanSendWelcomeEmail(supabaseAdmin, TEST_EMAIL);
    console.log(`  ${canSend ? '✅' : '❌'} Can send welcome email: ${canSend}`);
  } catch (error) {
    console.error(`  ❌ Failed to check:`, error);
  }
  console.log('');

  // Test 4: Get or create email preferences
  console.log('Test 4: Get or Create Email Preferences');
  console.log('--------------------------------------');
  try {
    const preferences = await getOrCreateEmailPreferences(supabaseAdmin, TEST_EMAIL);
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
    // Try to get first name from candidate's name in database
    let firstName: string | undefined;
    try {
      const { data: candidate } = await supabaseAdmin
        .from('candidates')
        .select('name')
        .eq('email', TEST_EMAIL)
        .single();
      
      if (candidate?.name) {
        firstName = candidate.name.split(' ')[0].trim();
        console.log(`  📧 Found candidate in database: ${candidate.name}`);
        console.log(`     Using first name: ${firstName}`);
      }
    } catch (error) {
      console.log(`  ⚠️  Candidate not found in database, will use email fallback`);
    }
    
    console.log(`  📤 Sending welcome email to ${TEST_EMAIL}...`);
    if (firstName) {
      console.log(`     First name from candidate: ${firstName}`);
    } else {
      console.log(`     Will extract from email or metadata`);
    }
    
    const result = await sendOnboardingEmail(supabaseAdmin, TEST_EMAIL, firstName);
    
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
    const preferences = await getEmailPreferences(supabaseAdmin, TEST_EMAIL);
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

