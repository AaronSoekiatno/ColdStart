import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_GMAIL_CLIENT_ID,
  process.env.GOOGLE_GMAIL_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`
);

export async function GET(request: NextRequest) {
  // Gmail OAuth disabled - automatic email sending is no longer supported
  // Restricted scope gmail.send has been removed from OAuth consent screen
  return NextResponse.json(
    { error: 'Gmail OAuth is no longer available. Automatic email sending has been disabled.' },
    { status: 410 } // 410 Gone - indicates the feature is permanently removed
  );
}

