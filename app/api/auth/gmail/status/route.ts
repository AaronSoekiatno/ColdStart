import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  // Gmail OAuth disabled - automatic email sending is no longer supported
  // Restricted scope gmail.send has been removed from OAuth consent screen
      return NextResponse.json(
    { connected: false, error: 'Gmail OAuth is no longer available. Automatic email sending has been disabled.' },
    { status: 410 } // 410 Gone - indicates the feature is permanently removed
  );
}

