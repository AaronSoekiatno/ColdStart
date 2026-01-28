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

    // Get redirect URL from query params
    const requestUrl = new URL(request.url);
    const redirectTo = requestUrl.searchParams.get('redirect') || '/matches'; // Default to matches after sign in

    // Initiate GitHub OAuth flow
    // We redirect to our callback route, which will then redirect to the final destination
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${requestUrl.origin}/api/auth/github/callback?redirect=${encodeURIComponent(redirectTo)}`,
        scopes: 'repo,rad:user',
      },
    });

    if (error) {
      console.error('GitHub OAuth error:', error);
      throw error;
    }

    if (!data.url) {
      throw new Error('No redirect URL returned from Supabase');
    }

    // Redirect user to GitHub for authentication
    return NextResponse.redirect(data.url);

  } catch (error) {
    console.error('GitHub signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
