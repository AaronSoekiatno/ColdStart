import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate, saveCandidate } from '@/lib/supabase';

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

    const { jobType, roleType } = await request.json();

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

    if (!roleType || !validRoleTypes.includes(roleType)) {
      return NextResponse.json(
        { error: 'Invalid role type' },
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
    let candidate = await getCandidate(user.email);
    
    if (!candidate) {
      // Create a new candidate record with basic info from auth
      const candidateName = user.user_metadata?.full_name || 
                           user.user_metadata?.name || 
                           user.email?.split('@')[0] || 
                           'User';
      
      candidate = await saveCandidate({
        email: user.email,
        name: candidateName,
        summary: '',
        skills: '',
        job_type: jobType,
        role_type: roleType,
      });
      
      console.log('Created new candidate during onboarding:', {
        id: candidate.id,
        email: candidate.email,
        jobType,
        roleType,
      });
    } else {
      // Update existing candidate's job_type and role_type
      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update({ 
          job_type: jobType,
          role_type: roleType,
        })
        .eq('email', user.email);

      if (updateError) {
        console.error('Error updating onboarding preferences:', updateError);
        return NextResponse.json(
          { error: 'Failed to update preferences' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      jobType,
      roleType,
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

