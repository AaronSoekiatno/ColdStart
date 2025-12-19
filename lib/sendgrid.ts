// @ts-ignore
import sgMail from '@sendgrid/mail';

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
      'hello@joinhermes.co';

    const hasHtml = !!htmlContent && htmlContent.trim().length > 0;
    const hasText = !!textContent && textContent.trim().length > 0;

    const msg = {
      to: email,
      from: {
        email: from,
        name: process.env.SENDGRID_FROM_NAME || 'Hermes',
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


