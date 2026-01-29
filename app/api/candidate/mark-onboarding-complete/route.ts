import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
import { sendOnboardingEmail, extractFirstName, SendEmailResult } from '@/lib/resend';
import { deleteCache } from '@/lib/redis-cache';

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

    // Send welcome/onboarding email after completion (non-blocking)
    try {
      const candidate = await getCandidate(user.email);
      if (candidate) {
        // Prefer name from candidate record, fall back to metadata/email extraction
        const firstName = candidate.name?.trim()?.split(' ')[0] || 
                         extractFirstName(user.user_metadata, user.email);
        
        // sendOnboardingEmail handles preference checks internally
        sendOnboardingEmail(user.email, firstName, user.user_metadata)
          .then((result: SendEmailResult) => {
            if (result.success) {
              console.log(`[Mark Onboarding Complete] Onboarding email sent to ${user.email}`);
            } else {
              console.warn(`[Mark Onboarding Complete] Failed to send onboarding email:`, result.error);
            }
          })
          .catch((error: any) => {
            console.error(`[Mark Onboarding Complete] Error sending onboarding email:`, error);
          });
      }
    } catch (error) {
      // Log error but don't block response
      console.error('[Mark Onboarding Complete] Error setting up onboarding email:', error);
    }

    // Invalidate matches cache since job_type and years_of_experience affect filtering
    try {
      const matchesCacheKey = `matches:${user.email}:ALL`;
      await deleteCache(matchesCacheKey);
      console.log('[Mark Onboarding Complete] Invalidated matches cache:', matchesCacheKey);
    } catch (error) {
      // Log error but don't block response
      console.error('[Mark Onboarding Complete] Error invalidating cache:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception marking onboarding complete:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
