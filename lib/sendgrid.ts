// @ts-ignore
import sgMail from '@sendgrid/mail';
import { checkCanSendWelcomeEmail, checkCanSendNewsletterEmail, getOrCreateEmailPreferences, getCandidate } from './supabase';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let isInitialized = false;

function getSendGridClient() {
  if (isInitialized) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }

  sgMail.setApiKey(apiKey);
  isInitialized = true;
}

/**
 * Sends an email via SendGrid API
 * @param email - Recipient email address
 * @param subject - Email subject line
 * @param htmlContent - HTML content of the email
 * @param textContent - Optional plain text version (fallback for non-HTML clients)
 * @param fromEmail - Optional sender email (defaults to hello@joinhermes.co)
 * @returns Result object with success status and message ID or error
 */
export async function sendWaitlistEmail(
  email: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  fromEmail?: string
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY environment variable is not set',
    };
  }

  try {
    getSendGridClient();

    const from =
      fromEmail ||
      process.env.SENDGRID_FROM_EMAIL ||
      'robert@joinhermes.co';

    const hasHtml = !!htmlContent && htmlContent.trim().length > 0;
    const hasText = !!textContent && textContent.trim().length > 0;

    const msg = {
      to: email,
      from: {
        email: from,
        name: process.env.SENDGRID_FROM_NAME || 'Robert Flores',
      },
      subject,
      // Conditionally include parts to support text-only or HTML+text emails
      ...(hasHtml ? { html: htmlContent } : {}),
      ...(hasText
        ? { text: textContent }
        : hasHtml
        ? { text: htmlContent.replace(/<[^>]*>/g, '') }
        : {}),
      // Rough equivalent of tags in Resend
      categories: ['waitlist'],
      customArgs: {
        category: 'waitlist',
      },
      // Disable click tracking so links are not rewritten to SendGrid tracking URLs
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
        // Keep open tracking off by default to mirror your Resend strategy
        openTracking: {
          enable: false,
        },
      },
    } as sgMail.MailDataRequired;

    const [response] = await sgMail.send(msg);

    const headers = response.headers as Record<string, string>;
    const messageId =
      headers['x-message-id'] ||
      headers['X-Message-Id'] ||
      headers['x-message-id'.toLowerCase()];

    console.log(
      `[SendGrid] Successfully sent email to ${email}${
        messageId ? `, message ID: ${messageId}` : ''
      }`
    );

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    const sgErrorBody = error?.response?.body;
    if (sgErrorBody?.errors) {
      console.error('[SendGrid] Error details:', sgErrorBody.errors);
    } else {
      console.error('[SendGrid] Error sending email:', error);
    }

    const errorMessage =
      sgErrorBody?.errors?.map((e: any) => e.message).join(', ') ||
      error?.message ||
      'Unknown SendGrid error';

    return {
      success: false,
      error: errorMessage,
    };
  }
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
 * Sends a welcome email to a new user via SendGrid API
 * Includes opt-out compliance features (unsubscribe link, footer requirements)
 * This is a TRANSACTIONAL email (welcome_emails_enabled)
 * @param email - Recipient email address
 * @param firstName - User's first name (will be extracted if not provided)
 * @param userMetadata - Optional user metadata for name extraction
 * @returns Result object with success status and message ID or error
 */
export async function sendWelcomeEmail(
  email: string,
  firstName?: string,
  userMetadata?: { full_name?: string; name?: string }
): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY environment variable is not set',
    };
  }

  try {
    // Check if we can send welcome email (respects opt-out preferences)
    const canSend = await checkCanSendWelcomeEmail(email);
    if (!canSend) {
      console.log(`[SendGrid] Skipping welcome email to ${email} - user has opted out`);
      return {
        success: false,
        error: 'User has opted out of welcome emails',
      };
    }

    // Get or create email preferences to ensure we have an unsubscribe token
    const preferences = await getOrCreateEmailPreferences(email);
    const unsubscribeToken = preferences.unsubscribe_token;

    if (!unsubscribeToken) {
      console.error(`[SendGrid] No unsubscribe token found for ${email}`);
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
        console.warn(`[SendGrid] Could not fetch candidate for ${email}, using fallback name extraction`);
      }
    }
    
    // Final fallback to existing extractFirstName logic
    if (!userFirstName) {
      userFirstName = extractFirstName(userMetadata, email);
    }

    // Get app URL for unsubscribe link (normalize to remove trailing slash)
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co').replace(/\/+$/, '');

    // Build email subject
    const subject = `Hey ${userFirstName} - welcome to Hermes`;

    // Build email body
    const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`;
    const privacyLink = `${APP_URL}/privacy`;
    const termsLink = `${APP_URL}/terms`;
    
    // HTML version
    const emailBodyHTML = `Hi ${userFirstName},<br><br>

My name is Robert and i am a cofounder of Hermes. We built Hermes because we realized the job market is broken.<br><br>

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

My name is Robert and i am a cofounder of Hermes. We built Hermes because we realized the job market is broken.

Heres 3 things to do to 10x ur chances of getting a job:
    • Upload your resume: Our agent matches you with the right teams to maximize your chances.
    • Find Hidden Roles: find "FRESH" job postings before everyone else does
    • Send Emails: Use our auto-drafted notes to land in the founder's personal inbox instead of the application black hole.

Best,
Robert

Unsubscribe: ${unsubscribeLink}`;

    // Send email directly using SendGrid (not reusing sendWaitlistEmail to set correct category)
    getSendGridClient();

    const from =
      process.env.SENDGRID_FROM_EMAIL ||
      'robert@joinhermes.co';

    const msg = {
      to: email,
      from: {
        email: from,
        name: process.env.SENDGRID_FROM_NAME || 'Robert Flores',
      },
      subject,
      html: emailBodyHTML,
      text: emailBodyText,
      // Category for welcome emails (transactional)
      categories: ['welcome'],
      customArgs: {
        category: 'welcome',
      },
      // Add List-Unsubscribe header for better inbox placement (RFC compliance)
      headers: {
        'List-Unsubscribe': `<${unsubscribeLink}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Auto-Response-Suppress': 'All', // Suppress auto-responses for transactional emails
      },
      // Disable click tracking so links are not rewritten to SendGrid tracking URLs
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
        openTracking: {
          enable: false,
        },
      },
      // Mail settings to help with deliverability
      mailSettings: {
        // Don't bypass list management (we want to respect unsubscribes)
        // But enable footer suppression since we handle unsubscribe manually
        footer: {
          enable: false, // We're adding our own footer
        },
      },
    } as sgMail.MailDataRequired;

    const [response] = await sgMail.send(msg);

    const headers = response.headers as Record<string, string>;
    const messageId =
      headers['x-message-id'] ||
      headers['X-Message-Id'] ||
      headers['x-message-id'.toLowerCase()];

    console.log(
      `[SendGrid] Successfully sent welcome email to ${email}${
        messageId ? `, message ID: ${messageId}` : ''
      }`
    );

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    const sgErrorBody = error?.response?.body;
    if (sgErrorBody?.errors) {
      console.error('[SendGrid] Error details:', sgErrorBody.errors);
    } else {
      console.error('[SendGrid] Error sending welcome email:', error);
    }

    const errorMessage =
      sgErrorBody?.errors?.map((e: any) => e.message).join(', ') ||
      error?.message ||
      'Unknown SendGrid error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends a newsletter/marketing email via SendGrid API
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
  if (!process.env.SENDGRID_API_KEY) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY environment variable is not set',
    };
  }

  try {
    // Check if we can send newsletter email (respects marketing email preferences)
    const canSend = await checkCanSendNewsletterEmail(email);
    if (!canSend) {
      console.log(`[SendGrid] Skipping newsletter email to ${email} - user has not opted in or has opted out`);
      return {
        success: false,
        error: 'User has not opted in to marketing emails or has opted out',
      };
    }

    // Get or create email preferences to ensure we have an unsubscribe token
    const preferences = await getOrCreateEmailPreferences(email);
    const unsubscribeToken = preferences.unsubscribe_token;

    if (!unsubscribeToken) {
      console.error(`[SendGrid] No unsubscribe token found for ${email}`);
      return {
        success: false,
        error: 'Failed to generate unsubscribe token',
      };
    }

    // Get app URL for unsubscribe link (normalize to remove trailing slash)
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co').replace(/\/+$/, '');
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

    getSendGridClient();

    const from =
      fromEmail ||
      process.env.SENDGRID_FROM_EMAIL ||
      'robert@joinhermes.co';

    const hasHtml = !!finalHtmlContent && finalHtmlContent.trim().length > 0;
    const hasText = !!finalTextContent && finalTextContent.trim().length > 0;

    const msg = {
      to: email,
      from: {
        email: from,
        name: process.env.SENDGRID_FROM_NAME || 'Robert Flores',
      },
      subject,
      // Conditionally include parts to support text-only or HTML+text emails
      ...(hasHtml ? { html: finalHtmlContent } : {}),
      ...(hasText
        ? { text: finalTextContent }
        : hasHtml
        ? { text: finalHtmlContent.replace(/<[^>]*>/g, '') }
        : {}),
      // Category for newsletter/marketing emails
      categories: ['newsletter'],
      customArgs: {
        category: 'newsletter',
      },
      // Disable click tracking so links are not rewritten to SendGrid tracking URLs
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
        openTracking: {
          enable: false,
        },
      },
    } as sgMail.MailDataRequired;

    const [response] = await sgMail.send(msg);

    const headers = response.headers as Record<string, string>;
    const messageId =
      headers['x-message-id'] ||
      headers['X-Message-Id'] ||
      headers['x-message-id'.toLowerCase()];

    console.log(
      `[SendGrid] Successfully sent newsletter email to ${email}${
        messageId ? `, message ID: ${messageId}` : ''
      }`
    );

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    const sgErrorBody = error?.response?.body;
    if (sgErrorBody?.errors) {
      console.error('[SendGrid] Error details:', sgErrorBody.errors);
    } else {
      console.error('[SendGrid] Error sending newsletter email:', error);
    }

    const errorMessage =
      sgErrorBody?.errors?.map((e: any) => e.message).join(', ') ||
      error?.message ||
      'Unknown SendGrid error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}
