import { Resend } from 'resend';

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
 * Sends an email via Resend API
 * @param email - Recipient email address
 * @param subject - Email subject line
 * @param htmlContent - HTML content of the email
 * @param textContent - Optional plain text version (fallback for non-HTML clients)
 * @param fromEmail - Optional sender email (defaults to Resend domain)
 * @returns Result object with success status and message ID or error
 */
export async function sendWaitlistEmail(
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
    // Use default from email if not provided
    // Resend requires verified domain - use joinhermes.co for DMARC compliance
    const from = fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@joinhermes.co';

    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML tags for text fallback
      tags: [
        {
          name: 'category',
          value: 'waitlist',
        },
      ],
    });

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
