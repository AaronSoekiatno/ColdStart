import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
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
        { needsOnboarding: false },
        { status: 200 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { needsOnboarding: false },
        { status: 200 }
      );
    }

    // Check if candidate exists and has both job_type and role_type set
    const { data: candidate, error } = await supabaseAdmin
      .from('candidates')
      .select('job_type, role_type')
      .eq('email', user.email)
      .single();

    if (error || !candidate) {
      // If candidate doesn't exist or error, they need onboarding
      return NextResponse.json({ needsOnboarding: true });
    }

    // If job_type or role_type is null or empty array, they need onboarding
    return NextResponse.json({
      needsOnboarding: !candidate.job_type || !candidate.role_type || 
                       (Array.isArray(candidate.role_type) && candidate.role_type.length === 0),
    });
  } catch (error) {
    console.error('Exception checking onboarding status:', error);
    return NextResponse.json(
      { needsOnboarding: false },
      { status: 200 }
    );
  }
}
