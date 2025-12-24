import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate, saveCandidate } from '@/lib/supabase';
import { sendWelcomeEmail, extractFirstName } from '@/lib/sendgrid';
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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { objectives, jobType, roleTypes, yearsOfExperience } = await request.json();

    if (!jobType || !['full-time', 'part-time', 'internship'].includes(jobType)) {
      return NextResponse.json(
        { error: 'Invalid job type. Must be full-time, part-time, or internship' },
        { status: 400 }
      );
    }

    const validRoleTypes = [
      'PM', 'SWE', 'SDE', 'ML', 'AI', 'Data Science', 'DevOps', 
      'Frontend', 'Backend', 'Full Stack', 'Mobile', 'Security', 
      'QA', 'Design', 'Product Design', 'Other'
    ];

    if (!roleTypes || !Array.isArray(roleTypes) || roleTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one role type must be selected' },
        { status: 400 }
      );
    }

    // Validate all role types
    const invalidRoleTypes = roleTypes.filter(rt => !validRoleTypes.includes(rt));
    if (invalidRoleTypes.length > 0) {
      return NextResponse.json(
        { error: `Invalid role types: ${invalidRoleTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Check if candidate exists, create if not
    let candidate: Awaited<ReturnType<typeof getCandidate>> = await getCandidate(user.email);

    if (!candidate) {
      // Create a new candidate record with basic info from auth
      const candidateName = user.user_metadata?.full_name ||
                           user.user_metadata?.name ||
                           user.email?.split('@')[0] ||
                           'User';
      
      const savedCandidate = await saveCandidate({
        email: user.email,
        name: candidateName,
        skills: '',
        objectives: objectives,
        job_type: jobType,
        role_type: roleTypes,
        years_of_experience: yearsOfExperience,
        onboarding_completed: true,
      });

      // Refetch the candidate to get the complete type with required fields
      candidate = await getCandidate(user.email);

      if (!candidate) {
        return NextResponse.json(
          { error: 'Failed to create candidate' },
          { status: 500 }
        );
      }
      
      console.log('Created new candidate during onboarding:', {
        id: candidate.id,
        email: candidate.email,
        jobType,
        roleTypes,
      });

      // Send welcome email after onboarding completion (non-blocking)
      // This ensures users get the welcome email even if they complete onboarding before the auth callback runs
      try {
        const firstName = candidate.name?.split(' ')[0]?.trim() || 
                         extractFirstName(user.user_metadata, user.email);
        
        sendWelcomeEmail(user.email, firstName, user.user_metadata)
          .then((result) => {
            if (result.success) {
              console.log(`[Onboarding] Welcome email sent to ${user.email}`);
            } else {
              console.warn(`[Onboarding] Failed to send welcome email to ${user.email}:`, result.error);
            }
          })
          .catch((error) => {
            console.error(`[Onboarding] Error sending welcome email to ${user.email}:`, error);
          });
      } catch (error) {
        // Log error but don't block onboarding completion
        console.error('[Onboarding] Error setting up welcome email:', error);
      }
    } else {
      // Update existing candidate's job_type and role_type
      await saveCandidate({
        email: user.email,
        name: candidate.name,
        skills: candidate.skills || '',
        objectives: objectives,
        job_type: jobType,
        role_type: roleTypes,
        years_of_experience: yearsOfExperience,
        onboarding_completed: true,
        // Preserve existing fields
        location: candidate.location,
        education_level: candidate.education_level,
        university: candidate.university,
        experience: candidate.experience,
        technical_projects: candidate.technical_projects,
      });
      
      // Refetch the candidate to get updated data
      candidate = await getCandidate(user.email);
      
      if (!candidate) {
        return NextResponse.json(
          { error: 'Failed to update candidate' },
          { status: 500 }
        );
      }
    }

    // Invalidate matches cache since job_type and years_of_experience affect filtering
    const matchesCacheKey = `matches:${user.email}:ALL`;
    await deleteCache(matchesCacheKey);
    console.log('[Complete Onboarding] Invalidated matches cache:', matchesCacheKey);

    return NextResponse.json({ 
      success: true, 
      jobType,
      roleTypes,
      candidateId: candidate.id,
    });
  } catch (error) {
    console.error('Exception completing onboarding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

