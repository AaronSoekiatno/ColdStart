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

const FLY_API_BASE = 'https://api.machines.dev/v1';

async function flyApiRequest(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: object
): Promise<any> {
    const token = process.env.FLY_API_TOKEN;
    if (!token) {
        throw new Error('FLY_API_TOKEN is not configured');
    }

    const url = `${FLY_API_BASE}${path}`;
    console.log(`[Fly.io API] ${method} ${url}`);

    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();

    if (!response.ok) {
        console.error(`[Fly.io API] Error ${response.status}: ${text}`);
        throw new Error(`Fly.io API error ${response.status}: ${text}`);
    }

    // Some endpoints return empty response
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export async function provisionFlyMachine(config: FlyMachineConfig): Promise<{ url: string }> {
    // Using explicit app name to ensure uniqueness/traceability
    // Truncating IDs to keep hostname length reasonable (Fly.io limit: 63 chars)
    // Strip "session_" prefix and replace underscores with dashes (Fly.io requires lowercase letters, numbers, and dashes only)
    const sessionPart = config.sessionId.replace('session_', '').replace(/_/g, '-').slice(0, 16);
    const appName = `assess-${config.candidateId.slice(0, 8)}-${sessionPart}`.toLowerCase();
    const orgSlug = 'personal'; // Using personal org (Aidan Nguyen-Tran)

    // Use Fly.io Registry image (pushed manually via flyctl auth docker)
    const image = `registry.fly.io/hermes-assessment-image-host:latest`;

    console.log(`[Fly.io] Provisioning app: ${appName}`);
    console.log(`[Fly.io] Using image: ${image}`);

    const region = 'sjc'; // Default region (San Jose)

    // Environment variables for the container
    const envVars: Record<string, string> = {
        CANDIDATE_ID: config.candidateId,
        SESSION_ID: config.sessionId,
        PASSWORD: config.password,
        TELEMETRY_URL: config.telemetryUrl,
        AUTO_COMMIT_INTERVAL: '120',
        SUPABASE_URL: config.supabaseUrl,
        SUPABASE_ANON_KEY: config.supabaseAnonKey,
        SUPABASE_PRIVATE_KEY: config.supabaseJwt,
        SUPABASE_SERVICE_ROLE_KEY: config.supabaseJwt,
        GEMINI_BASE_URL: `${config.telemetryUrl}/api/proxy/gemini`,
        GOOGLE_BASE_URL: `${config.telemetryUrl}/api/proxy/gemini`,
        GOOGLE_API_KEY: 'managed-by-proxy',
        ANTHROPIC_BASE_URL: `${config.telemetryUrl}/api/proxy/claude`,
        ANTHROPIC_API_KEY: 'managed-by-proxy',
        QUARTERMASTER_API_URL: `${config.telemetryUrl}/api/topcandidates/provision`,
    };

    try {
        // 1. Create App via API (delete existing if needed)
        try {
            await flyApiRequest('POST', '/apps', {
                app_name: appName,
                org_slug: orgSlug,
            });
            console.log(`[Fly.io] Created app: ${appName}`);
        } catch (error: any) {
            // If app already exists, delete and recreate
            if (error.message?.includes('already exists') || error.message?.includes('taken')) {
                console.log(`[Fly.io] App ${appName} already exists, deleting and recreating...`);
                await flyApiRequest('DELETE', `/apps/${appName}`);
                // Wait a moment for deletion to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                await flyApiRequest('POST', '/apps', {
                    app_name: appName,
                    org_slug: orgSlug,
                });
                console.log(`[Fly.io] Recreated app: ${appName}`);
            } else {
                throw error;
            }
        }

        // 2. Allocate shared IPv4 address via GraphQL API
        // The Machines API doesn't have a direct endpoint for this, so we use the GraphQL API
        try {
            const graphqlResponse = await fetch('https://api.fly.io/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.FLY_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: AllocateIPAddressInput!) {
                            allocateIpAddress(input: $input) {
                                ipAddress {
                                    id
                                    address
                                    type
                                }
                            }
                        }
                    `,
                    variables: {
                        input: {
                            appId: appName,
                            type: 'shared_v4',
                        },
                    },
                }),
            });
            const graphqlResult = await graphqlResponse.json();
            if (graphqlResult.errors) {
                console.warn('[Fly.io] GraphQL IP allocation warning:', graphqlResult.errors);
            } else {
                console.log('[Fly.io] Allocated shared IPv4 address');
            }
        } catch (error: any) {
            console.warn('[Fly.io] Failed to allocate IPv4 (might already have one):', error.message);
        }

        // 3. Create and start a Machine via API
        const machineConfig = {
            image,
            env: envVars,
            services: [
                {
                    ports: [
                        { port: 443, handlers: ['tls', 'http'] },
                        { port: 80, handlers: ['http'] },
                    ],
                    protocol: 'tcp',
                    internal_port: 8080,
                },
            ],
            guest: {
                cpu_kind: 'shared',
                cpus: 1,
                memory_mb: 2048,
            },
            auto_destroy: true, // Auto-delete machine when process stops
        };

        const machine = await flyApiRequest('POST', `/apps/${appName}/machines`, {
            config: machineConfig,
            region,
        });

        console.log(`[Fly.io] Machine created: ${machine?.id}`);

        const url = `https://${appName}.fly.dev`;
        console.log(`[Fly.io] Machine launched. URL: ${url}`);

        return { url };

    } catch (error) {
        console.error('[Fly.io] Provisioning procedure failed:', error);
        throw error;
    }
}

export async function destroyFlyMachine(appName: string) {
    console.log(`[Fly.io] Destroying app ${appName}`);
    await flyApiRequest('DELETE', `/apps/${appName}`);
}
