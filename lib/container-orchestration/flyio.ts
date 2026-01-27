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
    // Truncating IDs to keep hostname length reasonable (Fly.io limit: 63 chars)
    // Strip "session_" prefix and replace underscores with dashes (Fly.io requires lowercase letters, numbers, and dashes only)
    // Also remove leading/trailing dashes resulting from replacement or truncation
    let sessionPart = config.sessionId.replace('session_', '').replace(/_/g, '-').slice(0, 16);
    // Remove trailing dash if present
    if (sessionPart.endsWith('-')) {
        sessionPart = sessionPart.slice(0, -1);
    }
    
    // Ensure candidateId part is safe too
    const candidatePart = config.candidateId.slice(0, 8).replace(/_/g, '-');
    
    const appName = `assess-${candidatePart}-${sessionPart}`.toLowerCase();
    const orgSlug = 'personal'; // Using personal org (Aidan Nguyen-Tran)

    // Use GitHub Container Registry image (automatically built by GitHub Actions)
    // Use SHA-based tag from environment variable for better caching, fallback to :latest
    const image = process.env.HERMES_ASSESSMENT_IMAGE
        || `ghcr.io/hermes-startup/hermes-assessment:latest`;

    console.log(`[Fly.io] Provisioning app: ${appName}`);
    console.log(`[Fly.io] Using image: ${image}`);

    // GHCR image is public - no authentication required for pulling
    console.log(`[Fly.io] Using public image from GHCR`);

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

        // Allocate shared IPv4 address (required for public accessibility)
        // Shared IPs are free, dedicated IPs cost $2/mo
        try {
            await executeFlyCommand(`ips allocate-v4 --shared --app ${appName}`, { json: false });
            console.log(`[Fly.io] Allocated shared IPv4 address`);
        } catch (error: any) {
            // Log but don't fail - app might already have an IP
            console.warn('[Fly.io] Failed to allocate IPv4 (might already have one):', error.message);
        }

        // 3. Create and start a Machine via CLI
        const envVars: Record<string, string> = {
            PASSWORD: config.password,
            SESSION_ID: config.sessionId,
            CANDIDATE_ID: config.candidateId,
            TELEMETRY_URL: config.telemetryUrl,
            NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
            SUPABASE_URL: config.supabaseUrl, // Required for telemetry scripts
            NEXT_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey,
            SUPABASE_JWT: config.supabaseJwt,
            // Critical for telemetry logging
            SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        };

        if (process.env.ANTHROPIC_API_KEY) {
            envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        } else {
            console.warn('[Fly.io] ANTHROPIC_API_KEY is missing in environment! Claude will not work.');
        }

        const envFlags = Object.entries(envVars)
            .map(([k, v]) => `--env ${k}=${JSON.stringify(v)}`)
            .join(' ');

        const region = 'sjc';

        console.log(`[Fly.io] Starting machine in ${region}...`);
        console.log(`[Fly.io] Image will be pulled fresh from GHCR: ${image}`);

        const runCommand = `machine run ${image} --app ${appName} --region ${region} --vm-size performance-2x --memory 4096 --port 443:8080/tcp:tls:http --port 80:8080/tcp:http --port 3000:3000/tcp:tls:http --port 5173:5173/tcp:tls:http --autostart --detach=false ${envFlags}`;

        const runOutput = await executeFlyCommand(runCommand, { json: false });
        console.log(`[Fly.io] Machine provisioning output:`, runOutput);

        // Get machine details to verify image digest
        try {
            const machines = await executeFlyCommand(`machine list --app ${appName}`);
            if (machines && machines.length > 0) {
                const machine = machines[0];
                console.log(`[Fly.io] Machine ID: ${machine.id}`);
                console.log(`[Fly.io] Image digest: ${machine.image_ref?.digest || 'N/A'}`);
                console.log(`[Fly.io] Machine created at: ${machine.created_at}`);
            }
        } catch (e) {
            console.warn('[Fly.io] Could not fetch machine details:', e);
        }

        // Machine is now running
        const url = `https://${appName}.fly.dev`;
        console.log(`[Fly.io] Machine started and running. URL: ${url}`);

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
