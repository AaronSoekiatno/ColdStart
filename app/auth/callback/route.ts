import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail, extractFirstName } from '@/lib/sendgrid';
import { getOrCreateEmailPreferences } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const origin = requestUrl.origin;
  
  // Log for debugging - helps identify if callback is being called from wrong domain
  console.log('[Auth Callback] Request origin:', origin, 'Full URL:', requestUrl.toString());
  
  // Check for Supabase OAuth errors first
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  if (error) {
    console.error('OAuth error from Supabase:', error, errorDescription);
    // Redirect to home with error details
    const errorUrl = new URL('/', origin);
    errorUrl.searchParams.set('error', 'auth_failed');
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(errorUrl);
  }

  // Import cookies dynamically
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
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Cookie setting might fail in route handlers - this is okay
            console.warn('Failed to set cookies:', error);
          }
        },
      },
    }
  );

  // Handle OAuth callback (Google, etc.)
  if (code) {
    // Exchange code for session first to detect provider
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Auth callback error:', exchangeError);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    // Get user from session
    const user = sessionData?.session?.user;
    
    // Check if this is a GitHub OAuth callback by checking for provider_token in session
    // GitHub OAuth sessions will have a provider_token after exchange
    if (sessionData?.session?.provider_token && user?.email) {
      // This is GitHub OAuth - handle it directly here since we've already exchanged the code
      // Import supabaseAdmin for database operations
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      const providerToken = sessionData.session.provider_token;
      const providerRefreshToken = sessionData.session.provider_refresh_token;
      
      // Fetch GitHub user info to get username
      let githubUsername = null;
      try {
        const githubResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${providerToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (githubResponse.ok) {
          const githubUser = await githubResponse.json();
          githubUsername = githubUser.login;
        }
      } catch (error) {
        console.error('Error fetching GitHub user info:', error);
      }

      // Store GitHub tokens and info in candidates table
      if (supabaseAdmin) {
        try {
          const updateData: any = {
            github_access_token: providerToken,
            github_connected_at: new Date().toISOString(),
          };

          if (providerRefreshToken) {
            updateData.github_refresh_token = providerRefreshToken;
          }

          if (githubUsername) {
            updateData.github_username = githubUsername;
          }

          await supabaseAdmin
            .from('candidates')
            .update(updateData)
            .eq('email', user.email);
          
          console.log(`[Auth Callback] GitHub connected for user: ${user.email}`);
        } catch (error) {
          console.error('Error storing GitHub tokens:', error);
        }
      }

      // Redirect back to the original page with success parameter
      // Since Supabase doesn't preserve query params through OAuth, we default to /onboarding
      // but try to extract from the callback URL if available (though it likely won't be)
      // Default to /onboarding for GitHub OAuth
      const redirectPath = '/onboarding';
      const redirectUrl = new URL(redirectPath, origin);
      redirectUrl.searchParams.set('github_connected', 'true');
      redirectUrl.searchParams.set('step', '7');
      console.log('[Auth Callback] GitHub OAuth handled, redirecting to:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    }
    
    let isNewSignUp = false;
    
    if (user?.email) {
      // Check if user has a candidate record
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', user.email)
        .single();
      
      // If no candidate record exists, this is likely a new sign-up
      isNewSignUp = !candidate;

      // Create/update email preferences - opt into marketing emails (consent given by continuing)
      // This applies to both new signups and existing users signing in via Google
      if (user.email) {
        try {
          // Opt user into marketing emails since they consented by continuing
          await getOrCreateEmailPreferences(user.email, { marketingOptIn: true });
        } catch (error) {
          // Log error but don't block auth flow
          console.error('[Auth Callback] Error updating email preferences:', error);
        }
      }

      // Send welcome email for new signups (non-blocking)
      if (isNewSignUp && user.email) {
        try {
          // Extract first name from user metadata
          const firstName = extractFirstName(user.user_metadata, user.email);
          
          // Send welcome email (don't block redirect on failure)
          sendWelcomeEmail(user.email, firstName, user.user_metadata)
            .then((result) => {
              if (result.success) {
                console.log(`[Auth Callback] Welcome email sent to ${user.email}`);
              } else {
                console.warn(`[Auth Callback] Failed to send welcome email to ${user.email}:`, result.error);
              }
            })
            .catch((error) => {
              console.error(`[Auth Callback] Error sending welcome email to ${user.email}:`, error);
            });
        } catch (error) {
          // Log error but don't block signup flow
          console.error('[Auth Callback] Error setting up welcome email:', error);
        }
      }
    }

    // Check for redirect parameter
    const redirectTo = requestUrl.searchParams.get('redirect');
    
    // For OAuth sign-in, determine redirect path
    let redirectPath: string;
    if (redirectTo) {
      redirectPath = redirectTo;
    } else if (isNewSignUp) {
      // New sign-up - redirect to home with uploadResume flag
      redirectPath = '/?uploadResume=true';
    } else {
      // Existing user - redirect to matches
      redirectPath = '/matches';
    }
    
    // Ensure redirect path is relative (starts with /)
    if (!redirectPath.startsWith('/')) {
      redirectPath = '/' + redirectPath;
    }
    
    // If redirectPath contains a full URL, extract just the pathname
    // This prevents redirecting to production when on localhost
    if (redirectPath.includes('://')) {
      try {
        const parsedUrl = new URL(redirectPath);
        redirectPath = parsedUrl.pathname + parsedUrl.search;
      } catch {
        // If parsing fails, default to just the path part
        const pathMatch = redirectPath.match(/\/\/[^\/]+(\/.*)/);
        if (pathMatch) {
          redirectPath = pathMatch[1];
        } else {
          redirectPath = '/';
        }
      }
    }
    
    // Always construct URL using the request origin (localhost in dev, production in prod)
    // Force use of request origin to prevent Supabase from redirecting to production
    const redirectUrl = new URL(redirectPath, origin);
    
    // Double-check: if we're on localhost but redirectUrl is pointing to production, fix it
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      if (!redirectUrl.hostname.includes('localhost') && !redirectUrl.hostname.includes('127.0.0.1')) {
        // Force localhost origin
        redirectUrl.hostname = origin.includes('127.0.0.1') ? '127.0.0.1' : 'localhost';
        redirectUrl.port = origin.includes(':') ? origin.split(':')[2] || '3000' : '3000';
        redirectUrl.protocol = 'http:';
      }
    }
    
    if (isNewSignUp && !redirectTo) {
      redirectUrl.searchParams.set('new_signup', 'true');
    }
    
    console.log('[Auth Callback] Redirecting to:', redirectUrl.toString(), 'from origin:', origin);
    return NextResponse.redirect(redirectUrl);
  }

  // Handle magic link callback (email sign-in/sign-up)
  if (token && type) {
    // If it's a recovery (password reset) type, redirect to reset password page
    if (type === 'recovery') {
      // The token will be in the hash fragment, redirect to reset password page
      return NextResponse.redirect(new URL('/auth/reset-password', origin));
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as any,
    });

    if (error) {
      console.error('Magic link verification error:', error);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    // Check if this is a new signup for email/password signups
    const { data: { user: magicLinkUser } } = await supabase.auth.getUser();
    let isNewSignUpMagicLink = false;
    
    if (magicLinkUser?.email) {
      // Check if user has a candidate record
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', magicLinkUser.email)
        .single();
      
      // If no candidate record exists, this is likely a new sign-up
      isNewSignUpMagicLink = !candidate;

      // Create/update email preferences - opt into marketing emails (consent given by continuing)
      // This applies to both new signups and existing users signing in via magic link
      if (magicLinkUser.email) {
        try {
          // Opt user into marketing emails since they consented by continuing
          await getOrCreateEmailPreferences(magicLinkUser.email, { marketingOptIn: true });
        } catch (error) {
          // Log error but don't block auth flow
          console.error('[Auth Callback] Error updating email preferences:', error);
        }
      }

      // Send welcome email for new signups (non-blocking)
      if (isNewSignUpMagicLink && magicLinkUser.email) {
        try {
          // Extract first name from user metadata
          const firstName = extractFirstName(magicLinkUser.user_metadata, magicLinkUser.email);
          
          // Send welcome email (don't block redirect on failure)
          sendWelcomeEmail(magicLinkUser.email, firstName, magicLinkUser.user_metadata)
            .then((result) => {
              if (result.success) {
                console.log(`[Auth Callback] Welcome email sent to ${magicLinkUser.email}`);
              } else {
                console.warn(`[Auth Callback] Failed to send welcome email to ${magicLinkUser.email}:`, result.error);
              }
            })
            .catch((error) => {
              console.error(`[Auth Callback] Error sending welcome email to ${magicLinkUser.email}:`, error);
            });
        } catch (error) {
          // Log error but don't block signup flow
          console.error('[Auth Callback] Error setting up welcome email:', error);
        }
      }
    }

    // Check for redirect parameter
    const redirectTo = requestUrl.searchParams.get('redirect');
    
    // Redirect to specified URL or home page after successful authentication
    // Always use the request origin to ensure localhost works correctly
    let redirectPath = redirectTo || '/';
    
    // Ensure redirect path is relative (starts with /)
    if (!redirectPath.startsWith('/')) {
      redirectPath = '/' + redirectPath;
    }
    
    // If redirectPath contains a full URL, extract just the pathname
    // This prevents redirecting to production when on localhost
    if (redirectPath.includes('://')) {
      try {
        const parsedUrl = new URL(redirectPath);
        redirectPath = parsedUrl.pathname + parsedUrl.search;
      } catch {
        // If parsing fails, default to just the path part
        const pathMatch = redirectPath.match(/\/\/[^\/]+(\/.*)/);
        if (pathMatch) {
          redirectPath = pathMatch[1];
        } else {
          redirectPath = '/';
        }
      }
    }
    
    // Always construct URL using the request origin (localhost in dev, production in prod)
    const redirectUrl = new URL(redirectPath, origin);
    
    // Double-check: if we're on localhost but redirectUrl is pointing to production, fix it
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      if (!redirectUrl.hostname.includes('localhost') && !redirectUrl.hostname.includes('127.0.0.1')) {
        // Force localhost origin
        redirectUrl.hostname = origin.includes('127.0.0.1') ? '127.0.0.1' : 'localhost';
        redirectUrl.port = origin.includes(':') ? origin.split(':')[2] || '3000' : '3000';
        redirectUrl.protocol = 'http:';
      }
    }
    
    console.log('[Auth Callback] Magic link redirecting to:', redirectUrl.toString(), 'from origin:', origin);
    return NextResponse.redirect(redirectUrl);
  }

  // Check for hash fragments (password reset links use hash fragments)
  const hash = requestUrl.hash;
  if (hash && hash.includes('type=recovery')) {
    return NextResponse.redirect(new URL('/auth/reset-password' + hash, origin));
  }

  // If no code or token, redirect to home
  return NextResponse.redirect(new URL('/', origin));
}

