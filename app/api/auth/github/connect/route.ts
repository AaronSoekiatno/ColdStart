import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      );
    }

    // Get redirect URL from query params (for onboarding flow)
    const requestUrl = new URL(request.url);
    const redirectTo = requestUrl.searchParams.get('redirect') || '/onboarding';
    const onboardingStep = requestUrl.searchParams.get('step') || '6';

    // Use Supabase's built-in GitHub OAuth provider
    // This will redirect to GitHub for authorization
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${requestUrl.origin}/api/auth/github/callback?redirect=${encodeURIComponent(redirectTo)}&step=${onboardingStep}`,
        scopes: 'repo read:user', // Request repository access and user info
      },
    });

    if (error) {
      console.error('GitHub OAuth connect error:', error);
      return NextResponse.json(
        { error: 'Failed to initiate GitHub connection' },
        { status: 500 }
      );
    }

    // Redirect to GitHub OAuth page
    if (data?.url) {
      return NextResponse.redirect(data.url);
    }

    return NextResponse.json(
      { error: 'No redirect URL received from OAuth provider' },
      { status: 500 }
    );
  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

