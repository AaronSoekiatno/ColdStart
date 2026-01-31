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
      // If not authenticated, they definitely need onboarding (or to sign in first)
      return NextResponse.json(
        { needsOnboarding: true },
        { status: 200 }
      );
    }

    if (!supabaseAdmin) {
      // If database unavailable, assume they need onboarding to be safe
      return NextResponse.json(
        { needsOnboarding: true },
        { status: 200 }
      );
    }

    // Check if candidate exists and has completed onboarding
    const { data: candidate, error } = await supabaseAdmin
      .from('candidates')
      .select('job_type, role_type, objectives, years_of_experience, onboarding_completed')
      .eq('email', user.email)
      .single();

    if (error || !candidate) {
      // If candidate doesn't exist or error, they need onboarding
      return NextResponse.json({ needsOnboarding: true });
    }

    // Check if all required onboarding fields are present and valid
    const hasJobType = candidate.job_type && 
                       typeof candidate.job_type === 'string' && 
                       candidate.job_type.trim() !== '';
    
    const hasRoleType = candidate.role_type && 
                       Array.isArray(candidate.role_type) && 
                       candidate.role_type.length > 0;
    
    const hasObjectives = candidate.objectives && 
                         Array.isArray(candidate.objectives) && 
                         candidate.objectives.length > 0;
    
    const hasYearsOfExperience = candidate.years_of_experience && 
                                typeof candidate.years_of_experience === 'string' && 
                                candidate.years_of_experience.trim() !== '';
    
    const onboardingCompleted = candidate.onboarding_completed === true;

    // User needs onboarding if:
    // 1. Any required field is missing, OR
    // 2. onboarding_completed is not true
    // This ensures GitHub OAuth users still go through onboarding even if the flag is set
    const needsOnboarding = !hasJobType || !hasRoleType || !hasObjectives || 
                           !hasYearsOfExperience || !onboardingCompleted;
    
    return NextResponse.json({
      needsOnboarding,
    });
  } catch (error) {
    console.error('Exception checking onboarding status:', error);
    return NextResponse.json(
      { needsOnboarding: true },
      { status: 200 }
    );
  }
}
