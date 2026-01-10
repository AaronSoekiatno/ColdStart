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
  // Optional GitHub seed repo config
  gitHubSeedRepoOwner?: string;
  gitHubSeedRepoName?: string;
}

async function executeFlyCommand(command: string): Promise<any> {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    throw new Error('FLY_API_TOKEN is not configured');
  }

  // Ensure JSON output for easier parsing
  const fullCommand = `flyctl ${command} --json`;
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      env: {
        ...process.env,
        FLY_API_TOKEN: token,
      },
    });

    try {
      return JSON.parse(stdout);
    } catch (parseError) {
      console.warn('[Fly.io] Failed to parse JSON output:', stdout);
      return stdout;
    }
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
  const orgSlug = 'hermes-assessments';
  const image = 'ghcr.io/hermes-startup/hermes-assessment:latest';

  console.log(`[Fly.io] Provisioning app: ${appName}`);

  try {
    // 1. Create App
    // Check if exists first or just try create (create fails if exists)
    // We'll try create and catch specific error if needed, or check list.
    // Simpler to just try create.
    try {
      await executeFlyCommand(`apps create ${appName} --org ${orgSlug}`);
    } catch (error: any) {
      // If error is "taken", we assume we own it or it's a collision. 
      // For now, let's assume if it fails, we might want to fail hard or clean up.
      // But if we are retrying, we might want to proceed.
      if (!error.stderr?.includes('taken') && !error.message?.includes('taken')) {
         throw error;
      }
      console.log(`[Fly.io] App ${appName} might already exist, proceeding...`);
    }

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
      `GEMINI_BASE_URL=${config.telemetryUrl}/api/proxy/gemini`,
      // Add GitHub seed repo config if provided
      ...(config.gitHubSeedRepoOwner ? [`GITHUB_SEED_REPO_OWNER=${config.gitHubSeedRepoOwner}`] : []),
      ...(config.gitHubSeedRepoName ? [`GITHUB_SEED_REPO_NAME=${config.gitHubSeedRepoName}`] : []),
    ].map(v => `--env "${v}"`).join(' ');

    const region = 'hkg'; // Default region or make configurable

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

    const machineValues = await executeFlyCommand(runCommand);
    
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
  await executeFlyCommand(`apps destroy ${appName} --yes`);
}
