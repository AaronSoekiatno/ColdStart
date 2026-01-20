import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Use a single persistent app with ephemeral machines
const POOL_APP_NAME = 'hermes-assessment-pool';

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
        const { stdout } = await execAsync(fullCommand, {
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
    // Generate unique machine name (not app name!)
    // Strip prefixes and ensure fly.io DNS compliance
    let sessionPart = config.sessionId.replace('session_', '').replace(/_/g, '-').slice(0, 12);
    if (sessionPart.endsWith('-')) {
        sessionPart = sessionPart.slice(0, -1);
    }

    const candidatePart = config.candidateId.slice(0, 8).replace(/_/g, '-');
    const machineName = `assess-${candidatePart}-${sessionPart}`.toLowerCase();

    // Use GitHub Container Registry image
    const image = `ghcr.io/hermes-startup/hermes-assessment:latest`;

    console.log(`[Fly.io] Provisioning machine: ${machineName} in app: ${POOL_APP_NAME}`);
    console.log(`[Fly.io] Using image: ${image}`);

    try {
        // Check if machine already exists
        try {
            const machines = await executeFlyCommand(`machine list --app ${POOL_APP_NAME}`);
            const existingMachine = machines.find((m: any) => m.name === machineName);

            if (existingMachine) {
                console.log(`[Fly.io] Machine ${machineName} already exists, destroying first...`);
                await executeFlyCommand(`machine destroy ${machineName} --app ${POOL_APP_NAME} --force`, { json: false });
                // Brief wait for cleanup
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (listError) {
            // App might not exist yet - that's okay
            console.log('[Fly.io] Could not list existing machines (app may not exist)');
        }

        // Build environment variables
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

        console.log(`[Fly.io] Creating machine in ${region}...`);
        console.log(`[Fly.io] Image will be pulled fresh from GHCR: ${image}`);

        // Create machine directly in the pool app
        const runCommand = `machine run ${image} --app ${POOL_APP_NAME} --name ${machineName} --region ${region} --vm-size performance-2x --memory 4096 --port 443:8080/tcp:tls:http --port 80:8080/tcp:http --port 3000:3000/tcp:tls:http --port 5173:5173/tcp:tls:http --autostart --detach=false ${envFlags}`;

        const runOutput = await executeFlyCommand(runCommand, { json: false });
        console.log(`[Fly.io] Machine provisioning output:`, runOutput);

        // Get machine details to verify
        try {
            const machines = await executeFlyCommand(`machine list --app ${POOL_APP_NAME}`);
            const machine = machines.find((m: any) => m.name === machineName);
            if (machine) {
                console.log(`[Fly.io] Machine ID: ${machine.id}`);
                console.log(`[Fly.io] Image digest: ${machine.image_ref?.digest || 'N/A'}`);
                console.log(`[Fly.io] Machine created at: ${machine.created_at}`);
            }
        } catch (e) {
            console.warn('[Fly.io] Could not fetch machine details:', e);
        }

        // Machine URL format: https://<machine-name>.<app-name>.fly.dev
        const url = `https://${machineName}.${POOL_APP_NAME}.fly.dev`;
        console.log(`[Fly.io] Machine started and running. URL: ${url}`);

        return { url };

    } catch (error) {
        console.error('[Fly.io] Provisioning procedure failed:', error);
        throw error;
    }
}

export async function destroyFlyMachine(machineNameOrUrl: string) {
    // Extract machine name from URL if needed
    let machineName = machineNameOrUrl;
    if (machineNameOrUrl.includes('.fly.dev')) {
        // URL format: https://assess-xxx.hermes-assessment-pool.fly.dev or https://assess-xxx.fly.dev
        const hostname = machineNameOrUrl.replace('https://', '').replace('http://', '');
        machineName = hostname.split('.')[0];
    }

    console.log(`[Fly.io] Destroying machine ${machineName} in app ${POOL_APP_NAME}`);

    try {
        await executeFlyCommand(`machine destroy ${machineName} --app ${POOL_APP_NAME} --force`, { json: false });
        console.log(`[Fly.io] Machine ${machineName} destroyed successfully`);
    } catch (error) {
        console.error(`[Fly.io] Failed to destroy machine ${machineName}:`, error);
        throw error;
    }
}
