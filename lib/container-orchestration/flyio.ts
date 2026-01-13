import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FlyMachineConfig {
    candidateId: string;
    sessionId: string;
    password: string;
    telemetryUrl: string;
    // Supabase credentials for the container
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseJwt: string; // The candidate-specific JWT
}

async function executeFlyCommand(command: string, options: { json?: boolean } = { json: true }): Promise<any> {
    const token = process.env.FLY_API_TOKEN;
    if (!token) {
        throw new Error('FLY_API_TOKEN is not configured');
    }

    // Ensure JSON output for easier parsing, unless disabled
    const fullCommand = options.json ? `flyctl ${command} --json` : `flyctl ${command}`;

    try {
        const { stdout, stderr } = await execAsync(fullCommand, {
            env: {
                ...process.env,
                FLY_API_TOKEN: token,
            },
        });

        if (options.json) {
            try {
                return JSON.parse(stdout);
            } catch (parseError) {
                console.warn('[Fly.io] Failed to parse JSON output:', stdout);
                return stdout;
            }
        }
        return stdout;
    } catch (error: any) {
        console.error('[Fly.io] Command failed:', error.message);
        if (error.stderr) {
            console.error('[Fly.io] Stderr:', error.stderr);
        }
        throw error;
    }
}

export async function provisionFlyMachine(config: FlyMachineConfig): Promise<{ url: string }> {
    // Using explicit app name to ensure uniqueness/traceability
    // Truncating IDs to keep hostname length reasonable
    const appName = `assessment-${config.candidateId.slice(0, 12)}-${config.sessionId.slice(0, 6)}`.toLowerCase();
    const orgSlug = 'personal'; // Using personal org (Aidan Nguyen-Tran)
    
    // Use GitHub Container Registry image (built by CI)
    // Format: ghcr.io/owner/repo:tag
    const ghcrOwner = process.env.GITHUB_REPOSITORY_OWNER || 'hermes-startup';
    const image = `ghcr.io/${ghcrOwner.toLowerCase()}/hermes:latest`;

    console.log(`[Fly.io] Provisioning app: ${appName}`);
    console.log(`[Fly.io] Using image: ${image}`);

    // GitHub Container Registry authentication is REQUIRED for private packages
    const ghcrToken = process.env.GITHUB_CONTAINER_REGISTRY_TOKEN;
    const ghcrUsername = process.env.GITHUB_USERNAME || ghcrOwner;
    
    if (!ghcrToken) {
        console.warn('[Fly.io] GITHUB_CONTAINER_REGISTRY_TOKEN not set. Private image pulls will fail!');
        throw new Error('GITHUB_CONTAINER_REGISTRY_TOKEN is required to pull private images from GHCR');
    }

    try {
        // 1. Create App (delete existing if needed)
        try {
            await executeFlyCommand(`apps create ${appName} --org ${orgSlug}`);
        } catch (error: any) {
            // If error is "taken", delete the old app and try again
            if (error.stderr?.includes('taken') || error.message?.includes('taken')) {
                console.log(`[Fly.io] App ${appName} already exists, deleting and recreating...`);
                try {
                    await executeFlyCommand(`apps destroy ${appName} --yes`, { json: false });
                    // Wait a moment for deletion to complete
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // Try creating again
                    await executeFlyCommand(`apps create ${appName} --org ${orgSlug}`);
                } catch (retryError: any) {
                    console.error('[Fly.io] Failed to recreate app after deletion:', retryError);
                    throw retryError;
                }
            } else {
                throw error;
            }
        }

        // Docker authentication: SKIPPED - Image is public
        // No need to set DOCKER_AUTH_CONFIG since ghcr.io/hermes-startup/hermes is public

        // 2. Launch Machine (using 'machine run' instead of 'deploy' for speed/single-instance)
        // We construct the env vars list
        const envVars = [
            `CANDIDATE_ID=${config.candidateId}`,
            `SESSION_ID=${config.sessionId}`,
            `PASSWORD=${config.password}`,
            `TELEMETRY_URL=${config.telemetryUrl}`,
            `AUTO_COMMIT_INTERVAL=120`,
            `SUPABASE_URL=${config.supabaseUrl}`,
            `SUPABASE_ANON_KEY=${config.supabaseAnonKey}`,
            `SUPABASE_PRIVATE_KEY=${config.supabaseJwt}`,
            `SUPABASE_SERVICE_ROLE_KEY=${config.supabaseJwt}`, // Alias for compatibility
            `GEMINI_BASE_URL=${config.telemetryUrl}/api/proxy/gemini`,
            `GOOGLE_BASE_URL=${config.telemetryUrl}/api/proxy/gemini`,
            `GOOGLE_API_KEY=managed-by-proxy`, // Indicates proxy-managed API key
            `QUARTERMASTER_API_URL=${config.telemetryUrl}/api/topcandidates/provision`,
        ].map(v => `--env "${v}"`).join(' ');

        const region = 'sjc'; // Default region (San Jose)

        // We use --detach to not wait specifically for health checks if we want speed,
        // but waiting is safer.
        const runCommand = `machine run ${image} \
      --app ${appName} \
      --region ${region} \
      ${envVars} \
      --port 443:8080/tcp:http:tls \
      --port 80:8080/tcp:http \
      --vm-cpu-kind shared --vm-cpus 1 --vm-memory 2048 \
      --autostart --autostop`;

        const machineValues = await executeFlyCommand(runCommand, { json: false });

        // Machine run returns the machine object
        const url = `https://${appName}.fly.dev`;
        console.log(`[Fly.io] Machine launched. URL: ${url}`);

        return { url };

    } catch (error) {
        console.error('[Fly.io] Provisioning procedure failed:', error);
        // Cleanup on failure?
        // await destroyFlyMachine(appName); // risky if it was a "taken" error from someone else
        throw error;
    }
}

export async function destroyFlyMachine(appName: string) {
    console.log(`[Fly.io] Destroying app ${appName}`);
    await executeFlyCommand(`apps destroy ${appName} --yes`, { json: false });
}
