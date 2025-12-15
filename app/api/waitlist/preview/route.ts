import { NextResponse } from 'next/server';

/**
 * API route to preview the waitlist email template
 * This allows the frontend to see how the email will look without actually sending it
 */
export async function GET() {
  // Get email content from environment variables or use defaults
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://coldstart.ai';
  const EMAIL_SUBJECT = process.env.WAITLIST_EMAIL_SUBJECT || 'ColdStart is Now Live';
  
  const EMAIL_HTML = process.env.WAITLIST_EMAIL_HTML || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f1a;">
  <div style="min-height: 100%; background-color: #0f0f1a; padding: 32px 16px;">
    <!-- Email Container -->
    <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a2e; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
      
      <!-- Header with Logo -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 50%, #1a1a2e 100%); padding: 48px 32px; text-align: center; position: relative;">
        <div style="position: relative;">
          <div style="margin: 0 auto 24px; width: 80px; height: 80px; background-color: #0f0f1a; border-radius: 16px; padding: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); border: 1px solid #2a2a4a; display: flex; align-items: center; justify-content: center;">
            <img src="${APP_URL}/images/hermes.png" alt="ColdStart Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <h1 style="margin: 0; font-size: 36px; font-weight: 600; color: #f5f5f7; letter-spacing: -0.5px;">
            ColdStart
          </h1>
          <p style="margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 4px; color: #d4a853;">
            Is Now Live
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div style="padding: 40px 32px;">
        <p style="text-align: center; font-size: 18px; line-height: 1.7; color: #f5f5f7; margin: 0 0 40px;">
          We're thrilled to announce that <span style="font-weight: 600; color: #d4a853;">ColdStart</span> has officially launched! Connect directly with YC founders and land your dream startup internship with AI-powered cold emails.
        </p>

        <!-- Features Section -->
        <div style="margin-top: 40px;">
          <h2 style="text-align: center; font-size: 24px; font-weight: 500; color: #f5f5f7; margin: 0 0 24px;">
            What's Inside
          </h2>
          
          <!-- Feature 1 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 18px;">⚡</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">AI-Powered Cold Emails</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Generate personalized cold emails tailored to each founder and startup. Three distinct personas to match your style.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 2 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px; display: flex; align-items: center; justify-content: center;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Y_Combinator_logo.svg/1200px-Y_Combinator_logo.svg.png" alt="YC Logo" style="width: 24px; height: 24px; object-fit: contain;" />
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">YC Founder Database</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Access verified contact information for hundreds of YC startup founders actively hiring interns.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 3 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 18px;">🤝</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">Smart Matching</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Upload your resume and get matched with startups that align with your skills, interests, and experience.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Feature 4 -->
          <div style="background-color: rgba(15, 15, 26, 0.4); border: 1px solid #2a2a4a; border-radius: 12px; padding: 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width: 48px; vertical-align: top;">
                  <div style="width: 40px; height: 40px; background-color: rgba(212, 168, 83, 0.1); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #d4a853; font-size: 18px;">📧</span>
                  </div>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <h3 style="margin: 0 0 4px; font-weight: 600; color: #f5f5f7; font-size: 16px;">Email Tracking</h3>
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Track your outreach progress and manage all your startup communications in one place.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="margin-top: 40px; text-align: center;">
          <a href="${APP_URL}" 
             style="display: inline-block; background: linear-gradient(135deg, #d4a853 0%, #c9a356 100%); color: #0f0f1a; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 10px 25px rgba(212, 168, 83, 0.25);">
            Get Started Now
          </a>
          <p style="margin: 16px 0 0; font-size: 14px; color: #a1a1aa;">
            Free to start • Premium features available
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #2a2a4a; background-color: rgba(15, 15, 26, 0.6); padding: 32px;">
        <div style="text-align: center;">
          <div style="margin: 0 auto 16px; width: 40px; height: 40px; background-color: #0f0f1a; border-radius: 12px; overflow: hidden;">
            <img src="${APP_URL}/images/hermes.png" alt="ColdStart" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <p style="margin: 0; font-size: 14px; color: #a1a1aa;">
            © 2025 ColdStart. All rights reserved.
          </p>
          <div style="margin-top: 16px;">
            <a href="${APP_URL}/privacy" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Privacy Policy</a>
            <a href="${APP_URL}/terms" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Terms of Service</a>
            <a href="${APP_URL}/unsubscribe?email={{email}}" style="font-size: 12px; color: #a1a1aa; text-decoration: none; margin: 0 12px;">Unsubscribe</a>
          </div>
          <p style="margin: 24px 0 0; font-size: 11px; color: rgba(161, 161, 170, 0.6);">
            You're receiving this email because you signed up for ColdStart updates.
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const EMAIL_TEXT = process.env.WAITLIST_EMAIL_TEXT || `
COLDSTART IS NOW LIVE
=====================

We're thrilled to announce that ColdStart has officially launched! Connect directly with YC founders and land your dream startup internship with AI-powered cold emails.

WHAT'S INSIDE
-------------

⚡ AI-Powered Cold Emails
Generate personalized cold emails tailored to each founder and startup. Three distinct personas to match your style.

🎯 YC Founder Database
Access verified contact information for hundreds of YC startup founders actively hiring interns.

📊 Smart Matching
Upload your resume and get matched with startups that align with your skills, interests, and experience.

📧 Email Tracking
Track your outreach progress and manage all your startup communications in one place.

GET STARTED: ${APP_URL}

Free to start • Premium features available

---
© 2025 ColdStart. All rights reserved.

Privacy Policy: ${APP_URL}/privacy
Terms of Service: ${APP_URL}/terms
Unsubscribe: ${APP_URL}/unsubscribe?email={{email}}

You're receiving this email because you signed up for ColdStart updates.
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
