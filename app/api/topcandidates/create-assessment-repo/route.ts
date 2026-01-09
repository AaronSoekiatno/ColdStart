import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate } from '@/lib/supabase';
// @ts-ignore
// @ts-ignore
import sodium from 'sodium-javascript';

/**
 * Upload a secret to a GitHub repository
 */
async function uploadSecret(
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string,
  token: string
) {
  try {
    // 1. Get the public key for the repository
    const publicKeyResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!publicKeyResponse.ok) {
      throw new Error(`Failed to get public key: ${await publicKeyResponse.text()}`);
    }

    const { key_id, key } = await publicKeyResponse.json();

    // 2. Encrypt the secret
    const binkey = Buffer.from(key, 'base64');
    const binsec = Buffer.from(secretValue);
    const encBytes = Buffer.alloc(binsec.length + sodium.crypto_box_SEALBYTES);
    sodium.crypto_box_seal(encBytes, binsec, binkey);
    const encrypted_value = encBytes.toString('base64');

    // 3. Create or update the secret
    const secretResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          encrypted_value,
          key_id,
        }),
      }
    );

    if (!secretResponse.ok) {
      throw new Error(`Failed to create secret ${secretName}: ${await secretResponse.text()}`);
    }

    return true;
  } catch (error) {
    console.error(`[Secret Injection] Error injecting ${secretName}:`, error);
    return false;
  }
}



/**
 * Upload a file to a GitHub repository with retry logic and update support
 */
async function uploadFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  token: string,
  message: string = 'Inject configuration'
): Promise<boolean> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[File Injection] Attempt ${attempt}/${maxRetries} for ${path}...`);
      
      // 1. Try to get the file SHA if it exists
      let sha: string | undefined = undefined;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
          console.log(`[File Injection] Existing file found for ${path}, SHA: ${sha}`);
        }
      } catch (e) {
        // Ignore errors fetching SHA (file might not exist)
      }

      // 2. Upload/Update the file
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            message,
            content: Buffer.from(content).toString('base64'),
            sha, // Provide SHA if we're updating
          }),
        }
      );

      if (response.ok) {
        console.log(`[File Injection] Successfully uploaded ${path}`);
        return true;
      }

      const errorText = await response.text();
      
      // If 409 Conflict or 404 Not Found (repo not ready), retry
      if ((response.status === 409 || response.status === 404) && attempt < maxRetries) {
        console.log(`[File Injection] Conflict/Repo not ready (${response.status}), waiting before retry...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      throw new Error(`Failed to upload file ${path}: ${response.status} ${errorText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        console.log(`[File Injection] Attempt ${attempt} failed, retrying in ${2000 * attempt}ms...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`[File Injection] All ${maxRetries} attempts failed for ${path}:`, lastError);
  return false;
}

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
    // Parse request body to get optional sessionId
    const body = await request.json().catch(() => ({}));
    const sessionId = body.sessionId as string | undefined;

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

    const candidate = await getCandidate(user.email, true); // Include assessment fields for top candidates

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate record not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // Check if repo already exists (idempotency)
    if (candidate.assessment_repo_url) {
      console.log(`[Create Repo] Repo already exists for candidate ${candidate.email}: ${candidate.assessment_repo_url}`);
      
      // Still attempt to inject .env if token exists, to ensure it's up to date
      // Also inject/update .hermes/config.json with sessionId if provided
      if (candidate.provisioning_token && candidate.github_access_token) {
        const repoPath = candidate.assessment_repo_url.replace('https://github.com/', '').split('/');
        const repoOwner = repoPath[0];
        const repoName = repoPath[1];
        
        if (repoOwner && repoName) {
           const origin = (process.env.QUARTERMASTER_API_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
           const envContent = `QUARTERMASTER_API_URL=${origin}/api/topcandidates/provision?token=${candidate.provisioning_token}\n`;
           
           // Fire and forget injection to not block response
           uploadFile(
             repoOwner,
             repoName,
             '.env',
             envContent,
             candidate.github_access_token,
             'Update assessment environment'
           ).catch(err => console.error('[Create Repo] async env update failed:', err));

           // Inject/update .hermes/config.json with sessionId if provided
           if (sessionId) {
             const apiBaseUrl = origin.replace('/api/topcandidates/provision', '') + '/api/interview';
             const configContent = JSON.stringify({
               sessionId: sessionId,
               apiBaseUrl: apiBaseUrl
             }, null, 2);

             uploadFile(
               repoOwner,
               repoName,
               '.hermes/config.json',
               configContent,
               candidate.github_access_token,
               'Update Hermes interview session configuration'
             ).catch(err => console.error('[Create Repo] async config update failed:', err));
           }
        }
      }

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
            provisioningToken: candidate.provisioning_token,
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
        provisioningToken: candidate.provisioning_token,
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
    let repoUrl = '';
    let cloneUrl = '';
    let repoOwnerName = '';
    
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
        repoUrl = createdRepo.html_url;
        cloneUrl = createdRepo.clone_url;
        repoOwnerName = createdRepo.owner.login;

      } else {
        // Template generation succeeded
        const generatedRepo = await generateResponse.json();
        repoUrl = generatedRepo.html_url;
        cloneUrl = generatedRepo.clone_url;
        repoOwnerName = generatedRepo.owner.login;
      }


      // Generate Provisioning Token
      const provisioningToken = crypto.randomUUID();

      // --- Secret Injection ---
      try {
        console.log(`[Create Repo] Injecting secrets into ${repoOwnerName}/${repoName}...`);
        
        // Inject ADMIN_TELEMETRY_URL
        await uploadSecret(
          repoOwnerName,
          repoName,
          'ADMIN_TELEMETRY_URL',
          request.nextUrl.origin,
          candidate.github_access_token
        );
        
        // Inject SUPABASE_ANON_KEY (from environment)
        if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          await uploadSecret(
            repoOwnerName,
            repoName,
            'SUPABASE_ANON_KEY',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            candidate.github_access_token
          );
        }

        // Inject SUPABASE_URL (from environment)
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          await uploadSecret(
            repoOwnerName,
            repoName,
            'SUPABASE_URL',
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            candidate.github_access_token
          );
        }

        // Inject HERMES_PROVISIONING_TOKEN
        await uploadSecret(
          repoOwnerName,
          repoName,
          'HERMES_PROVISIONING_TOKEN',
          provisioningToken,
          candidate.github_access_token
        );
        
      } catch (secretError) {
        console.error('[Create Repo] Error injecting secrets:', secretError);
        // Continue even if secrets fail, as the repo is created
      }

      // --- File Injection (.env and provision script) ---
      // Wait for GitHub to finish initializing the repository (template generation is async)
      console.log('[Create Repo] Waiting for repository to initialize...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time

      const origin = (process.env.QUARTERMASTER_API_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');

      // Inject .env file
      try {
        console.log(`[Create Repo] Injecting .env into ${repoOwnerName}/${repoName}...`);
        const envContent = `QUARTERMASTER_API_URL=${origin}/api/topcandidates/provision?token=${provisioningToken}\n`;
        
        const fileUploaded = await uploadFile(
          repoOwnerName,
          repoName,
          '.env',
          envContent,
          candidate.github_access_token,
          'Configure assessment environment'
        );

        if (!fileUploaded) {
          console.warn('[Create Repo] .env file injection failed - candidates will need to set QUARTERMASTER_API_URL manually');
        }
      } catch (fileError) {
        console.error('[Create Repo] Error injecting .env:', fileError);
      }

      // Inject production URL into provision script
      try {
        console.log(`[Create Repo] Injecting API URL into scripts/provision-key.js...`);
        
        // Fetch the current provision-key.js file
        const scriptPath = 'scripts/provision-key.js';
        const getScriptResponse = await fetch(
          `https://api.github.com/repos/${repoOwnerName}/${repoName}/contents/${scriptPath}`,
          {
            headers: {
              'Authorization': `Bearer ${candidate.github_access_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );

        if (getScriptResponse.ok) {
          const scriptData = await getScriptResponse.json();
          const currentContent = Buffer.from(scriptData.content, 'base64').toString('utf-8');
          
          // Replace placeholder URL with production URL
          const updatedContent = currentContent.replace(
            /https:\/\/api\.example\.com\/provision/g,
            `${origin}/api/topcandidates/provision`
          );

          // Only update if we actually made changes
          if (updatedContent !== currentContent) {
            const scriptUploaded = await uploadFile(
              repoOwnerName,
              repoName,
              scriptPath,
              updatedContent,
              candidate.github_access_token,
              'Inject production API URL'
            );

            if (scriptUploaded) {
              console.log('[Create Repo] Successfully injected API URL into provision script');
            } else {
              console.warn('[Create Repo] Failed to update provision script - candidates will need to override URL manually');
            }
          } else {
            console.log('[Create Repo] Provision script already has correct URL');
          }
        } else {
          console.warn(`[Create Repo] Could not fetch provision script: ${getScriptResponse.status}`);
        }
      } catch (scriptError) {
        console.error('[Create Repo] Error injecting script URL:', scriptError);
      }

      // Inject .hermes/config.json with sessionId if provided
      if (sessionId) {
        try {
          console.log(`[Create Repo] Injecting .hermes/config.json into ${repoOwnerName}/${repoName}...`);
          
          const apiBaseUrl = origin.replace('/api/topcandidates/provision', '') + '/api/interview';
          const configContent = JSON.stringify({
            sessionId: sessionId,
            apiBaseUrl: apiBaseUrl
          }, null, 2);
          
          const configUploaded = await uploadFile(
            repoOwnerName,
            repoName,
            '.hermes/config.json',
            configContent,
            candidate.github_access_token,
            'Add Hermes interview session configuration'
          );

          if (configUploaded) {
            console.log('[Create Repo] Successfully injected .hermes/config.json with sessionId');
          } else {
            console.warn('[Create Repo] Failed to inject .hermes/config.json');
          }
        } catch (configError) {
          console.error('[Create Repo] Error injecting .hermes/config.json:', configError);
          // Don't fail repo creation if config injection fails
        }
      } else {
        console.warn('[Create Repo] No sessionId provided - .hermes/config.json will need to be added manually');
      }

      // Update candidate record
      await supabaseAdmin
        .from('candidates')
        .update({
          assessment_repo_url: repoUrl,
          assessment_repo_created_at: new Date().toISOString(),
          provisioning_token: provisioningToken,
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
        provisioningToken,
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
