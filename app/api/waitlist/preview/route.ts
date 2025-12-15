import { NextResponse } from 'next/server';

/**
 * API route to preview the waitlist email template
 * This allows the frontend to see how the email will look without actually sending it
 */
export async function GET() {
  // Get email content from environment variables or use defaults
  const EMAIL_SUBJECT = process.env.WAITLIST_EMAIL_SUBJECT || 'ColdStart is Live! 🚀';
  
  const EMAIL_HTML = process.env.WAITLIST_EMAIL_HTML || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">ColdStart is Live! 🚀</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Thank you for joining our waitlist! We're excited to announce that ColdStart is now live.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You can now start using ColdStart to connect with YC founders and land your dream internship.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
      If you have any questions, feel free to reach out to us.
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      You're receiving this email because you signed up for the ColdStart waitlist.
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}/unsubscribe?email={{email}}" style="color: #667eea;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
`;

  const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `
ColdStart is Live! 🚀

Thank you for joining our waitlist! We're excited to announce that ColdStart is now live.

You can now start using ColdStart to connect with YC founders and land your dream internship.

Get started: ${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}

If you have any questions, feel free to reach out to us.

You're receiving this email because you signed up for the ColdStart waitlist.
Unsubscribe: ${process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai'}/unsubscribe?email={{email}}
`;

  // Check if Resend API key is configured
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const apiKeyStatus = hasApiKey 
    ? 'Ready to send emails' 
    : 'API key not configured - emails cannot be sent';

  return NextResponse.json({
    subject: EMAIL_SUBJECT,
    html: EMAIL_HTML,
    text: EMAIL_TEXT,
    hasApiKey,
    apiKeyStatus,
  });
}
