import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const redirectTo = requestUrl.searchParams.get('redirect') || '/onboarding';
    const step = requestUrl.searchParams.get('step') || '6';

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

    // Handle OAuth errors (user cancelled, etc.)
    if (error) {
      console.error('GitHub OAuth error:', error);
      const errorUrl = new URL(redirectTo, requestUrl.origin);
      errorUrl.searchParams.set('github_error', error);
      errorUrl.searchParams.set('step', step); // Preserve the step parameter
      return NextResponse.redirect(errorUrl);
    }

    // Exchange code for session
    if (code) {
      console.log('🔄 Exchanging GitHub code for session...');
      const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('❌ GitHub OAuth exchange error:', exchangeError);
        const errorUrl = new URL(redirectTo, requestUrl.origin);
        errorUrl.searchParams.set('github_error', 'exchange_failed');
        errorUrl.searchParams.set('step', step); // Preserve the step parameter
        return NextResponse.redirect(errorUrl);
      }

      console.log('✅ Session created:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        accessToken: session?.access_token ? 'present' : 'missing'
      });

      if (!session?.user?.email) {
        console.error('❌ No user email in session');
        const errorUrl = new URL(redirectTo, requestUrl.origin);
        errorUrl.searchParams.set('github_error', 'no_email');
        errorUrl.searchParams.set('step', step); // Preserve the step parameter
        return NextResponse.redirect(errorUrl);
      }

      // Get GitHub access token from the session
      // Note: Supabase stores OAuth provider tokens in the session
      // The provider_token is available after OAuth exchange
      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;

      // If provider_token is not in session, try to get it from the user's metadata
      // Sometimes Supabase stores it differently
      let accessToken = providerToken;
      if (!accessToken && session.user?.app_metadata?.provider_token) {
        accessToken = session.user.app_metadata.provider_token;
      }

      if (!accessToken) {
        console.error('No GitHub token in session. Session data:', {
          hasProviderToken: !!providerToken,
          hasUserMetadata: !!session.user?.app_metadata,
        });
        const errorUrl = new URL(redirectTo, requestUrl.origin);
        errorUrl.searchParams.set('github_error', 'no_token');
        errorUrl.searchParams.set('step', step); // Preserve the step parameter
        return NextResponse.redirect(errorUrl);
      }

      // Fetch GitHub user info to get username
      let githubUsername = null;
      try {
        const githubResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (githubResponse.ok) {
          const githubUser = await githubResponse.json();
          githubUsername = githubUser.login;
        } else {
          console.error('GitHub API error:', await githubResponse.text());
        }
      } catch (error) {
        console.error('Error fetching GitHub user info:', error);
      }

      // Store GitHub tokens and info in candidates table
      if (supabaseAdmin && session.user.email) {
        try {
          // Get candidate ID first
          const { data: candidateData } = await supabaseAdmin
            .from('candidates')
            .select('id')
            .eq('email', session.user.email)
            .single();

          const updateData: any = {
            github_access_token: accessToken,
            github_connected_at: new Date().toISOString(),
          };

          if (providerRefreshToken) {
            updateData.github_refresh_token = providerRefreshToken;
          }

          if (githubUsername) {
            updateData.github_username = githubUsername;
          }

          // Note: GitHub OAuth tokens don't expire unless revoked by the user
          // We don't set an expiry - the token remains valid until the user disconnects

          const { error: updateError } = await supabaseAdmin
            .from('candidates')
            .update(updateData)
            .eq('email', session.user.email);

          if (updateError) {
            console.error('Error updating candidate with GitHub info:', updateError);
          } else {
            console.log(`GitHub connected for user: ${session.user.email}`);
            
            // Optionally trigger repository fetch in the background (non-blocking)
            // This can also be called manually via /api/candidate/github/repositories if needed
            if (candidateData?.id) {
              // Trigger async fetch (don't await - let it run in background)
              // Note: This requires the user's session cookie, which should be available
              fetch(`${requestUrl.origin}/api/candidate/github/repositories`, {
                method: 'GET',
                headers: {
                  'Cookie': request.headers.get('Cookie') || '',
                },
              })
                .then((response) => {
                  if (response.ok) {
                    console.log(`[GitHub] Repository fetch triggered for ${session.user.email}`);
                  } else {
                    console.warn(`[GitHub] Repository fetch failed: ${response.status}`);
                  }
                })
                .catch((error) => {
                  console.error('[GitHub] Error triggering repository fetch:', error);
                });
            }
          }
        } catch (error) {
          console.error('Error storing GitHub tokens:', error);
        }
      }

      // Redirect back to onboarding with success parameter
      const successUrl = new URL(redirectTo, requestUrl.origin);
      successUrl.searchParams.set('github_connected', 'true');
      successUrl.searchParams.set('step', step); // Use the step from query params
      return NextResponse.redirect(successUrl);
    }

    // No code provided
    const errorUrl = new URL(redirectTo, requestUrl.origin);
    errorUrl.searchParams.set('github_error', 'no_code');
    errorUrl.searchParams.set('step', step); // Preserve the step parameter
    return NextResponse.redirect(errorUrl);
  } catch (error) {
    console.error('GitHub callback error:', error);
    const requestUrl = new URL(request.url);
    const redirectTo = requestUrl.searchParams.get('redirect') || '/onboarding';
    const step = requestUrl.searchParams.get('step') || '7';
    const errorUrl = new URL(redirectTo, requestUrl.origin);
    errorUrl.searchParams.set('github_error', 'internal_error');
    errorUrl.searchParams.set('step', step); // Preserve the step parameter
    return NextResponse.redirect(errorUrl);
  }
}

