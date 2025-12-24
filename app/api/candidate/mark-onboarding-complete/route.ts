import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    }

    // Update candidate record - mark onboarding complete
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({ onboarding_completed: true })
      .eq('email', user.email);

    if (updateError) {
      console.error('Error marking onboarding complete:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark onboarding complete' },
        { status: 500 }
      );
    }

    // Upgrade user_type from 'lead' to 'user' in waitlist table when onboarding is completed
    // This ensures they receive user campaigns instead of lead campaigns
    await supabaseAdmin
      .from('waitlist')
      .update({ user_type: 'user' })
      .eq('email', user.email.toLowerCase().trim())
      .eq('user_type', 'lead'); // Only update if currently 'lead' (idempotent)

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception marking onboarding complete:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
