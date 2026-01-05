import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

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

    // MOCK CONNECTION LOGIC
    // Instead of redirecting to GitHub, we directly update the database and return
    console.log('[Mock GitHub] Starting mock connection for:', user.email);

    if (supabaseAdmin) {
      // 1. Get candidate ID
      const { data: candidateData } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('email', user.email)
        .single();

      if (candidateData) {
        // 2. Update candidate with mock GitHub info
        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update({
            github_access_token: 'mock_gh_access_token_' + Date.now(),
            github_username: 'mock_developer',
            github_connected_at: new Date().toISOString(),
          })
          .eq('email', user.email);

        if (updateError) {
          console.error('[Mock GitHub] Error updating candidate:', updateError);
        } else {
             // 3. Insert mock repositories
             const mockRepos = [
                {
                    candidate_id: candidateData.id,
                    github_repo_id: 101, 
                    name: 'nextjs-dashboard',
                    full_name: 'mock_developer/nextjs-dashboard',
                    html_url: 'https://github.com/mock_developer/nextjs-dashboard',
                    description: 'A dashboard built with Next.js and Supabase',
                    language: 'TypeScript',
                    stargazers_count: 120,
                    forks_count: 15,
                    is_private: false,
                    updated_at: new Date().toISOString(),
                    synced_at: new Date().toISOString()
                },
                {
                    candidate_id: candidateData.id,
                    github_repo_id: 102, 
                    name: 'react-components',
                    full_name: 'mock_developer/react-components',
                    html_url: 'https://github.com/mock_developer/react-components',
                    description: 'Reusable React components',
                    language: 'JavaScript',
                    stargazers_count: 85,
                    forks_count: 8,
                    is_private: false,
                    updated_at: new Date().toISOString(),
                    synced_at: new Date().toISOString()
                },
                {
                    candidate_id: candidateData.id,
                    github_repo_id: 103, 
                    name: 'python-scripts',
                    full_name: 'mock_developer/python-scripts',
                    html_url: 'https://github.com/mock_developer/python-scripts',
                    description: 'Useful Python automation scripts',
                    language: 'Python',
                    stargazers_count: 42,
                    forks_count: 5,
                    is_private: true, // Mock a private repo
                    updated_at: new Date().toISOString(),
                    synced_at: new Date().toISOString()
                }
             ];

             const { error: repoError } = await supabaseAdmin
                .from('github_repositories')
                .upsert(mockRepos, { onConflict: 'candidate_id,github_repo_id' });
            
             if (repoError) {
                console.error('[Mock GitHub] Error inserting mock repos:', repoError);
             } else {
                console.log('[Mock GitHub] Successfully inserted mock repos');
             }
        }
      }
    } else {
        console.warn('[Mock GitHub] supabaseAdmin not available, skipping DB updates');
    }


    // Redirect back to onboarding with success parameter
    // We behave exactly as the callback would have
    const successUrl = new URL(redirectTo, requestUrl.origin);
    successUrl.searchParams.set('github_connected', 'true');
    successUrl.searchParams.set('step', onboardingStep);
    
    console.log('[Mock GitHub] Redirecting to success URL:', successUrl.toString());
    return NextResponse.redirect(successUrl);

  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
