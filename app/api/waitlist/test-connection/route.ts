import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * API route to test the Resend API connection
 * This verifies that the API key is valid and can connect to Resend
 */
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'RESEND_API_KEY environment variable is not set',
        hasApiKey: false,
      },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(apiKey);

    // Try to fetch domains to verify API key is valid
    // This is a lightweight operation that doesn't send emails
    const { data, error } = await resend.domains.list();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to connect to Resend API',
          hasApiKey: true,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
        },
        { status: 400 }
      );
    }

    // Successfully connected
    return NextResponse.json({
      success: true,
      hasApiKey: true,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      message: 'Successfully connected to Resend API',
      domains: data?.data || [],
      // Note: We don't expose the full API key for security
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Connection error: ${errorMessage}`,
        hasApiKey: true,
        apiKeyPrefix: apiKey.substring(0, 10) + '...',
      },
      { status: 500 }
    );
  }
}
