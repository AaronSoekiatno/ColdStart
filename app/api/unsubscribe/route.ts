import { NextRequest, NextResponse } from 'next/server';
import { getEmailPreferences } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const email = requestUrl.searchParams.get('email');
  const token = requestUrl.searchParams.get('token');

  // Validate required parameters
  if (!email || !token) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing required parameters. Both email and token are required.' 
      },
      { status: 400 }
    );
  }

  // Validate email format
  if (!email.includes('@') || !email.includes('.')) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid email format.' 
      },
      { status: 400 }
    );
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error' 
        },
        { status: 500 }
      );
    }

    // Get email preferences to validate token
    const preferences = await getEmailPreferences(email);

    if (!preferences) {
      console.error('[Unsubscribe] Email preferences not found:', { email });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email preferences not found. You may already be unsubscribed or the email is not in our system.' 
        },
        { status: 404 }
      );
    }

    // Validate token matches
    if (preferences.unsubscribe_token !== token) {
      console.error('[Unsubscribe] Token mismatch:', { 
        email, 
        providedToken: token?.substring(0, 10) + '...', 
        storedToken: preferences.unsubscribe_token?.substring(0, 10) + '...',
        tokensMatch: preferences.unsubscribe_token === token
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid unsubscribe token. Please use the link from your email.' 
        },
        { status: 403 }
      );
    }

    console.log('[Unsubscribe] Token validated successfully:', { email });

    // Check if already unsubscribed
    if (preferences.unsubscribed_at) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'You are already unsubscribed from welcome emails.',
          already_unsubscribed: true
        },
        { status: 200 }
      );
    }

    // Update preferences to unsubscribe
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('email_preferences')
      .update({
        welcome_emails_enabled: false,
        marketing_emails_enabled: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', email)
      .eq('unsubscribe_token', token) // Double-check token matches
      .select();

    if (updateError) {
      console.error('[Unsubscribe] Error updating preferences:', updateError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process unsubscribe request. Please try again later.' 
        },
        { status: 500 }
      );
    }

    // Verify the update actually affected a row
    if (!updateData || updateData.length === 0) {
      console.error('[Unsubscribe] Update query did not affect any rows:', { email, token });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process unsubscribe request. No matching record found.' 
        },
        { status: 404 }
      );
    }

    console.log('[Unsubscribe] Successfully updated preferences:', { 
      email, 
      unsubscribed_at: updateData[0].unsubscribed_at,
      welcome_emails_enabled: updateData[0].welcome_emails_enabled 
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'You have been successfully unsubscribed from welcome emails.' 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Unsubscribe] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred. Please try again later.' 
      },
      { status: 500 }
    );
  }
}

// Also support POST for form submissions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email;
    const token = body.token;

    // Validate required parameters
    if (!email || !token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters. Both email and token are required.' 
        },
        { status: 400 }
      );
    }

    // Create a new request URL with query params for reuse
    const url = new URL(request.url);
    url.searchParams.set('email', email);
    url.searchParams.set('token', token);

    // Reuse GET handler logic
    return GET(new NextRequest(url));
  } catch (error) {
    console.error('[Unsubscribe POST] Error parsing request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request format.' 
      },
      { status: 400 }
    );
  }
}

