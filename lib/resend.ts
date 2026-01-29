import { Resend } from 'resend';
import { 
  checkCanSendWelcomeEmail, 
  checkCanSendNewsletterEmail, 
  getOrCreateEmailPreferences, 
  getCandidate 
} from './supabase';

// Lazy-load Resend client to ensure env vars are loaded first
let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Extract first name from user metadata or email
 * @param userMetadata - User metadata from Supabase auth
 * @param email - User email address
 * @returns First name or fallback
 */
export function extractFirstName(
  userMetadata?: { full_name?: string; name?: string },
  email?: string
): string {
  // Try to get first name from full_name
  if (userMetadata?.full_name) {
    const parts = userMetadata.full_name.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      return parts[0];
    }
  }

  // Try to get first name from name field
  if (userMetadata?.name) {
    const parts = userMetadata.name.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      return parts[0];
    }
  }

  // Fallback to email prefix (before @)
  if (email) {
    const emailPrefix = email.split('@')[0];
    // Capitalize first letter
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }

  // Final fallback
  return 'there';
}

/**
 * Sends an email via Resend API
 * @param email - Recipient email address
 * @param subject - Email subject line
 * @param htmlContent - HTML content of the email
 * @param textContent - Optional plain text version (fallback for non-HTML clients)
 * @param fromEmail - Optional sender email (defaults to Resend domain)
 * @param tags - Optional tags for classification
 * @returns Result object with success status and message ID or error
 */
export async function sendWaitlistEmail(
  email: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  fromEmail?: string,
  tags?: { name: string; value: string }[]
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not set',
    };
  }

  try {
    // Use default from email if not provided
    // Resend requires verified domain - use joinhermes.co for DMARC compliance
    const from = fromEmail || process.env.RESEND_FROM_EMAIL || 'Robert from Hermes <robert@joinhermes.co>';

    const resend = getResendClient();

    // Build payload dynamically so we can support text-only emails (no HTML part)
    const payload: any = {
      from,
      to: email,
      subject,
      tags: tags || [
        {
          name: 'category',
          value: 'waitlist',
        },
      ],
    };

    const hasHtml = !!htmlContent && htmlContent.trim().length > 0;

    if (hasHtml) {
      payload.html = htmlContent;
      payload.text =
        textContent && textContent.trim().length > 0
          ? textContent
          : htmlContent.replace(/<[^>]*>/g, ''); // Strip HTML tags for text fallback
    } else if (textContent && textContent.trim().length > 0) {
      // Text-only email – no HTML part
      payload.text = textContent;
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error(`[Resend] Error sending email to ${email}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown Resend API error',
      };
    }

    if (!data || !data.id) {
      return {
        success: false,
        error: 'Resend API returned no message ID',
      };
    }

    console.log(`[Resend] Successfully sent email to ${email}, message ID: ${data.id}`);
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Resend] Exception sending email to ${email}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends an onboarding welcome email to a user via Resend API
 * This is typically sent after signup or onboarding completion
 * Includes opt-out compliance features (unsubscribe link, footer requirements)
 * This is a TRANSACTIONAL email (welcome_emails_enabled)
 * @param email - Recipient email address
 * @param firstName - User's first name
 * @param userMetadata - Optional user metadata
 * @returns Result
 */
export async function sendOnboardingEmail(
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
    const canSend = await checkCanSendWelcomeEmail(email);
    if (!canSend) {
      console.log(`[Resend] Skipping welcome email to ${email} - user has opted out`);
      return {
        success: false,
        error: 'User has opted out of welcome emails',
      };
    }

    // Get or create email preferences to ensure we have an unsubscribe token
    const preferences = await getOrCreateEmailPreferences(email);
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
        const candidate = await getCandidate(email);
        if (candidate?.name) {
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

    // Build email subject
    const subject = `Hey ${userFirstName} - welcome to Hermes`;

    // Build email body
    const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`;
    
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

Unsubscribe: ${unsubscribeLink}`;

    // Send email using Resend
    const resend = getResendClient();
    const from = process.env.RESEND_FROM_EMAIL || 'Robert from Hermes <robert@joinhermes.co>';

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html: emailBodyHTML,
      text: emailBodyText,
      tags: [
        { name: 'category', value: 'onboarding' },
        { name: 'type', value: 'transactional' }
      ]
    });

    if (error) {
      console.error(`[Resend] Error sending onboarding email to ${email}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown Resend API error',
      };
    }

    console.log(`[Resend] Successfully sent onboarding email to ${email}, message ID: ${data?.id}`);
    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Resend] Exception sending onboarding email to ${email}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends a newsletter/marketing email via Resend API
 * This is a MARKETING email (marketing_emails_enabled)
 * Checks marketing email preferences before sending
 * @param email - Recipient email address
 * @param subject - Email subject line
 * @param htmlContent - HTML content of the email
 * @param textContent - Optional plain text version
 * @param fromEmail - Optional sender email
 * @returns Result object with success status and message ID or error
 */
export async function sendNewsletterEmail(
  email: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  fromEmail?: string
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not set',
    };
  }

  try {
    // Check if we can send newsletter email (respects marketing email preferences)
    const canSend = await checkCanSendNewsletterEmail(email);
    if (!canSend) {
      console.log(`[Resend] Skipping newsletter email to ${email} - user has not opted in or has opted out`);
      return {
        success: false,
        error: 'User has not opted in to marketing emails or has opted out',
      };
    }

    // Get or create email preferences to ensure we have an unsubscribe token
    const preferences = await getOrCreateEmailPreferences(email);
    const unsubscribeToken = preferences.unsubscribe_token;

    if (!unsubscribeToken) {
      console.error(`[Resend] No unsubscribe token found for ${email}`);
      return {
        success: false,
        error: 'Failed to generate unsubscribe token',
      };
    }

    // Get app URL for unsubscribe link
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL 
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
      : process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000'
        : 'https://joinhermes.co';
    const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`;

    // Add unsubscribe link to email content if not already present
    const hasUnsubscribeLink = htmlContent.includes('unsubscribe') || textContent?.includes('unsubscribe');
    
    let finalHtmlContent = htmlContent;
    let finalTextContent = textContent;

    if (!hasUnsubscribeLink) {
      const unsubscribeFooter = `
---
You're receiving this because you subscribed to our newsletter.

Unsubscribe: ${unsubscribeLink}

Privacy Policy: ${APP_URL}/privacy
Terms of Service: ${APP_URL}/terms`;
      
      finalHtmlContent = htmlContent + unsubscribeFooter.replace(/\n/g, '<br>');
      finalTextContent = (textContent || htmlContent.replace(/<[^>]*>/g, '')) + unsubscribeFooter;
    }

    return await sendWaitlistEmail(
      email,
      subject,
      finalHtmlContent,
      finalTextContent,
      fromEmail,
      [
        { name: 'category', value: 'newsletter' },
        { name: 'type', value: 'marketing' }
      ]
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Resend] Exception sending newsletter email to ${email}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
