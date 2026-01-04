import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';

/**
 * POST /api/topcandidates/create-assessment-repo
 * 
 * Creates a private GitHub repository from a seed template for the candidate's assessment.
 * Also calls the provisioning endpoint to create the database schema.
 * 
 * Returns:
 * - repoUrl: The GitHub repository URL
 * - cloneUrl: The git clone URL
 * - credentials: Database credentials (from provisioning endpoint)
 */
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
        { error: 'Unauthorized. Please sign in to start your assessment.' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate record not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // Check if repo already exists (idempotency)
    if (candidate.assessment_repo_url) {
      // Repo already exists, return existing repo info
      // Still call provisioning to ensure schema exists
      try {
        const provisionResponse = await fetch(
          `${request.nextUrl.origin}/api/topcandidates/provision`,
          {
            method: 'POST',
            headers: {
              'Cookie': request.headers.get('Cookie') || '',
            },
          }
        );

        if (provisionResponse.ok) {
          const credentials = await provisionResponse.json();
          return NextResponse.json({
            repoUrl: candidate.assessment_repo_url,
            cloneUrl: candidate.assessment_repo_url.replace('https://github.com/', 'https://github.com/').replace(/\/$/, '') + '.git',
            credentials,
            alreadyExists: true,
          });
        }
      } catch (error) {
        console.error('[Create Repo] Error calling provisioning:', error);
      }

      // Return existing repo even if provisioning fails
      return NextResponse.json({
        repoUrl: candidate.assessment_repo_url,
        cloneUrl: candidate.assessment_repo_url.replace('https://github.com/', 'https://github.com/').replace(/\/$/, '') + '.git',
        alreadyExists: true,
      });
    }

    // Check if GitHub is connected
    if (!candidate.github_access_token) {
      return NextResponse.json(
        { error: 'GitHub not connected. Please connect your GitHub account first.' },
        { status: 400 }
      );
    }

    // Get seed repo configuration from environment
    const seedRepoOwner = process.env.GITHUB_SEED_REPO_OWNER;
    const seedRepoName = process.env.GITHUB_SEED_REPO_NAME;

    if (!seedRepoOwner || !seedRepoName) {
      return NextResponse.json(
        { error: 'Seed repository not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Create repository from template using GitHub API
    const repoName = `hermes-assessment-${candidate.id.substring(0, 8)}`;
    
    try {
      // Try using template repository generation endpoint first
      const generateResponse = await fetch(
        `https://api.github.com/repos/${seedRepoOwner}/${seedRepoName}/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${candidate.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            name: repoName,
            private: true,
            description: 'Hermes 20-minute assessment workspace',
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        console.error('[Create Repo] GitHub template generation failed:', errorText);

        // If template generation fails, try creating an empty repo
        // (User will need to manually clone the template)
        const createResponse = await fetch(
          'https://api.github.com/user/repos',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${candidate.github_access_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
              name: repoName,
              private: true,
              description: 'Hermes 20-minute assessment workspace',
            }),
          }
        );

        if (!createResponse.ok) {
          const createErrorText = await createResponse.text();
          console.error('[Create Repo] GitHub repo creation failed:', createErrorText);
          
          if (createResponse.status === 401) {
            return NextResponse.json(
              { error: 'GitHub token expired. Please reconnect your GitHub account.' },
              { status: 401 }
            );
          }

          if (createResponse.status === 403) {
            return NextResponse.json(
              { error: 'GitHub API rate limit exceeded. Please try again later.' },
              { status: 429 }
            );
          }

          return NextResponse.json(
            { error: 'Failed to create GitHub repository', details: createErrorText },
            { status: 500 }
          );
        }

        const createdRepo = await createResponse.json();
        const repoUrl = createdRepo.html_url;
        const cloneUrl = createdRepo.clone_url;

        // Update candidate record
        await supabaseAdmin
          .from('candidates')
          .update({
            assessment_repo_url: repoUrl,
            assessment_repo_created_at: new Date().toISOString(),
          })
          .eq('id', candidate.id);

        // Call provisioning endpoint
        const provisionResponse = await fetch(
          `${request.nextUrl.origin}/api/topcandidates/provision`,
          {
            method: 'POST',
            headers: {
              'Cookie': request.headers.get('Cookie') || '',
            },
          }
        );

        let credentials = null;
        if (provisionResponse.ok) {
          credentials = await provisionResponse.json();
        }

        return NextResponse.json({
          repoUrl,
          cloneUrl,
          credentials,
        });
      }

      // Template generation succeeded
      const generatedRepo = await generateResponse.json();
      const repoUrl = generatedRepo.html_url;
      const cloneUrl = generatedRepo.clone_url;

      // Update candidate record
      await supabaseAdmin
        .from('candidates')
        .update({
          assessment_repo_url: repoUrl,
          assessment_repo_created_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);

      // Call provisioning endpoint
      const provisionResponse = await fetch(
        `${request.nextUrl.origin}/api/topcandidates/provision`,
        {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
          },
        }
      );

      let credentials = null;
      if (provisionResponse.ok) {
        credentials = await provisionResponse.json();
      } else {
        console.error('[Create Repo] Provisioning failed:', await provisionResponse.text());
      }

      return NextResponse.json({
        repoUrl,
        cloneUrl,
        credentials,
      });

    } catch (error) {
      console.error('[Create Repo] Unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to create repository', details: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Create Repo] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

