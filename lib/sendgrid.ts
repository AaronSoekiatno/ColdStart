// @ts-ignore
import sgMail from '@sendgrid/mail';
import { checkCanSendWelcomeEmail, checkCanSendNewsletterEmail, getOrCreateEmailPreferences } from './supabase';

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

    // Extract first name if not provided
    const userFirstName = firstName || extractFirstName(userMetadata, email);

    // Get app URL for unsubscribe link
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co';

    // Build email subject
    const subject = `Hey ${userFirstName} - welcome to Hermes`;

    // Build email body with message
    const emailBody = `Hi ${userFirstName},

We built Hermes because we realized the job market is broken. 

We're here to help you discover hidden roles at hot startups and reach out directly to the founders. 
One thing to do today: Upload your resume so our agent can start matching you with companies and use that to write your outreach for you.

Best,
Robert`;

    // Build email footer with compliance requirements
    const unsubscribeLink = `${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsubscribeToken)}`;
    
    const footer = `

---
You're receiving this email because you signed up for Hermes.

Unsubscribe: ${unsubscribeLink}

Privacy Policy: ${APP_URL}/privacy
Terms of Service: ${APP_URL}/terms

Hermes
${APP_URL}`;

    const fullTextContent = emailBody + footer;

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
      text: fullTextContent,
      // Category for welcome emails (transactional)
      categories: ['welcome'],
      customArgs: {
        category: 'welcome',
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

    // Get app URL for unsubscribe link
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinhermes.co';
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
