import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { syncCandidateRepositories } from '@/lib/github-sync';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const redirectTo = requestUrl.searchParams.get('redirect') || '/onboarding';
    const step = requestUrl.searchParams.get('step') || '1';

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

      // Fetch GitHub user info to get username and profile data
      let githubUserData = null;
      try {
        const githubResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (githubResponse.ok) {
          githubUserData = await githubResponse.json();
          console.log('✅ GitHub user data fetched:', {
            id: githubUserData.id,
            login: githubUserData.login,
            name: githubUserData.name,
            email: githubUserData.email,
          });
        } else {
          console.error('GitHub API error:', await githubResponse.text());
        }
      } catch (error) {
        console.error('Error fetching GitHub user info:', error);
      }

      // Store GitHub tokens and info in candidates table
      if (supabaseAdmin && session.user.email) {
        try {
          // Build GitHub data to save
          const githubData: any = {
            github_access_token: accessToken,
            github_connected_at: new Date().toISOString(),
          };

          if (providerRefreshToken) {
            githubData.github_refresh_token = providerRefreshToken;
          }

          // Store all GitHub profile data
          if (githubUserData) {
            if (githubUserData.login) {
              githubData.github_username = githubUserData.login;
            }
            if (githubUserData.id) {
              githubData.github_user_id = githubUserData.id;
            }
            if (githubUserData.name) {
              githubData.github_name = githubUserData.name;
            }
            if (githubUserData.avatar_url) {
              githubData.github_avatar_url = githubUserData.avatar_url;
            }
            if (githubUserData.html_url) {
              githubData.github_profile_url = githubUserData.html_url;
            }
            if (githubUserData.email) {
              githubData.github_email = githubUserData.email;
            }
          }

          console.log(`[GitHub Callback] Saving GitHub data for ${session.user.email}`, {
            hasToken: !!accessToken,
            hasUsername: !!githubUserData?.login,
            hasUserId: !!githubUserData?.id,
          });

          // Note: GitHub OAuth tokens don't expire unless revoked by the user
          // We don't set an expiry - the token remains valid until the user disconnects

          // Use upsert to create candidate if doesn't exist, or update if exists
          // This ensures GitHub sign-in users get their GitHub data saved even on first sign-in
          const upsertData = {
            email: session.user.email,
            name: githubUserData?.name || session.user.user_metadata?.name || session.user.email.split('@')[0],
            ...githubData,
          };

          const { data: candidateData, error: upsertError } = await supabaseAdmin
            .from('candidates')
            .upsert(upsertData, {
              onConflict: 'email',
              ignoreDuplicates: false,
            })
            .select('id')
            .single();

          if (upsertError) {
            console.error('❌ Error upserting candidate with GitHub info:', upsertError);
          } else if (candidateData?.id) {
            console.log(`✅ GitHub connected for user: ${session.user.email} (candidate ID: ${candidateData.id})`);

            // Trigger background sync
            console.log(`[GitHub Callback] Triggering background repository sync for ${session.user.email}`);
            syncCandidateRepositories(candidateData.id, accessToken, true)
              .then((result) => {
                if (result.success) {
                  console.log(`[GitHub] Repository sync success for ${session.user.email}: ${result.count} repos`);
                } else {
                  console.warn(`[GitHub] Repository sync failed for ${session.user.email}`, result.error);
                }
              })
              .catch((error) => {
                console.error('[GitHub] Error triggering repository fetch:', error);
              });
          } else {
            console.error('❌ Upsert succeeded but no candidate ID returned for:', session.user.email);
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

