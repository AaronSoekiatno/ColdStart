import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get the access code from request body
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    // Normalize the code (trim whitespace, case-insensitive comparison)
    const normalizedCode = code.trim();

    if (normalizedCode.length === 0) {
      return NextResponse.json(
        { error: 'Access code cannot be empty' },
        { status: 400 }
      );
    }

    // Check if the code matches the hardcoded access code (case-insensitive)
    const VALID_ACCESS_CODE = 'hermes25top';
    if (normalizedCode.toLowerCase() !== VALID_ACCESS_CODE.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid access code. Please check and try again.' },
        { status: 404 }
      );
    }

    // Create Supabase client to get the current user
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'You must be signed in to redeem an access code' },
        { status: 401 }
      );
    }

    const userEmail = user.email;

    // Use admin client to update candidate
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Check if candidate record exists
    const { data: existingCandidate } = await supabaseAdmin
      .from('candidates')
      .select('id, email, name')
      .eq('email', userEmail)
      .single();

    if (existingCandidate) {
      // Update existing candidate
      const { error: updateCandidateError } = await supabaseAdmin
        .from('candidates')
        .update({
          beta_access: true,
        })
        .eq('email', userEmail);

      if (updateCandidateError) {
        console.error('Error granting beta access:', updateCandidateError);
        return NextResponse.json(
          { error: 'Failed to grant beta access' },
          { status: 500 }
        );
      }
    } else {
      // Candidate record doesn't exist yet - create it with beta access
      // This can happen if user redeems code before completing onboarding
      const candidateName = user.user_metadata?.full_name ||
                           user.user_metadata?.name ||
                           userEmail?.split('@')[0] ||
                           'User';

      const { error: createCandidateError } = await supabaseAdmin
        .from('candidates')
        .insert({
          email: userEmail,
          name: candidateName,
          skills: '',
          beta_access: true,
        });

      if (createCandidateError) {
        console.error('Error creating candidate with beta access:', createCandidateError);
        return NextResponse.json(
          { error: 'Failed to grant beta access' },
          { status: 500 }
        );
      }
    }

    console.log(`Beta access granted to ${userEmail} via access code`);

    return NextResponse.json({
      success: true,
      message: 'Welcome to the beta! You now have full access.',
    });

  } catch (error) {
    console.error('Error redeeming access code:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
