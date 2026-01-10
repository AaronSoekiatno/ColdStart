# Fly.io Container Deployment Guide

This guide shows how to deploy and manage Hermes assessment containers on Fly.io.

---

## Why Fly.io?

- **Fast global deployment**: Containers start in <5 seconds
- **Simple API**: Easy to provision containers programmatically
- **Built-in networking**: Automatic HTTPS and custom domains
- **Cost-effective**: Pay only for running containers (~$0.01/hour)
- **No cluster management**: Just deploy and go

---

## Step 1: Initial Fly.io Setup

### 1.1 Install Fly CLI

```bash
# macOS
brew install flyctl

# Verify
flyctl version
```

### 1.2 Login and Create Organization

```bash
# Login to Fly.io
flyctl auth login

# Create organization (if not exists)
flyctl orgs create hermes-assessments
```

### 1.3 Push Image to GitHub Container Registry

```bash
# Tag and push your image
cd /Users/aidannguyen/Downloads/Hermes/docker
./deployment/deploy.sh

# Follow prompts to push to ghcr.io/hermes-startup/hermes-assessment:latest
```

---

## Step 2: Create Fly.io App Template

Create a `fly.toml` template for assessment containers:

```toml
# docker/deployment/fly.toml
app = "assessment-CANDIDATE_ID"

[build]
  image = "ghcr.io/hermes-startup/hermes-assessment:latest"

[http_service]
  internal_port = 8080
  force_https = false
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 2048

[env]
  AUTO_COMMIT_INTERVAL = "120"
  GIT_USER_NAME = "Candidate"
  GIT_USER_EMAIL = "candidate@assessment.local"
```

---

## Step 3: Create Container Provisioning Endpoint

### 3.1 New API Route: `/api/topcandidates/provision-container/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/topcandidates/provision-container
 * 
 * Provisions a Fly.io container for candidate assessment
 * Integrates with existing /api/topcandidates/provision endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    // Authenticate candidate
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get candidate info
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, email, provisioning_token')
      .eq('email', user.email)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Call existing provisioning endpoint to create schema + get credentials
    const provisionResponse = await fetch(
      `${request.nextUrl.origin}/api/topcandidates/provision`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidate.provisioning_token}`,
        },
      }
    );

    if (!provisionResponse.ok) {
      throw new Error('Failed to provision candidate schema');
    }

    const credentials = await provisionResponse.json();

    // Generate container password
    const containerPassword = crypto.randomUUID().slice(0, 16);
    
    // Provision Fly.io container
    const { url: containerUrl } = await provisionFlyContainer({
      candidateId: candidate.id,
      sessionId: sessionId,
      password: containerPassword,
      telemetryUrl: process.env.NEXT_PUBLIC_APP_URL!,
    });

    // Update interview session with container info
    await supabase
      .from('interview_sessions')
      .update({
        container_url: containerUrl,
        container_password: containerPassword, // TODO: Encrypt this
        container_status: 'running',
        container_started_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    return NextResponse.json({
      containerUrl,
      containerPassword,
      credentials, // Schema credentials from existing provisioning endpoint
      expiresIn: '3 hours',
    });

  } catch (error) {
    console.error('[Provision Container] Error:', error);
    return NextResponse.json(
      { error: 'Failed to provision container' },
      { status: 500 }
    );
  }
}

/**
 * Provision a Fly.io container for a candidate
 */
async function provisionFlyContainer(config: {
  candidateId: string;
  sessionId: string;
  password: string;
  telemetryUrl: string;
  credentials: any; // Credentials from provisioning endpoint
}): Promise<{ url: string }> {
  const appName = `assessment-${config.candidateId.slice(0, 12)}`;
  
  try {
    // Create Fly.io app using flyctl API
    const { stdout: createOutput } = await execAsync(
      `flyctl apps create ${appName} --org hermes-assessments --json`,
      { env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN } }
    );

    // Deploy container with environment variables
    const { stdout: deployOutput } = await execAsync(
      `flyctl deploy \\
        --app ${appName} \\
        --image ghcr.io/hermes-startup/hermes-assessment:latest \\
        --env CANDIDATE_ID="${config.candidateId}" \\
        --env SESSION_ID="${config.sessionId}" \\
        --env PASSWORD="${config.password}" \\
        --env TELEMETRY_URL="${config.telemetryUrl}" \\
        --env AUTO_COMMIT_INTERVAL="120" \\
        --env SUPABASE_URL="${config.credentials.SUPABASE_URL}" \\
        --env SUPABASE_ANON_KEY="${config.credentials.SUPABASE_ANON_KEY}" \\
        --env SUPABASE_PRIVATE_KEY="${config.credentials.SUPABASE_PRIVATE_KEY}" \\
        --env GEMINI_BASE_URL="${config.credentials.GEMINI_BASE_URL}" \\
        --ha=false \\
        --vm-size shared-cpu-1x \\
        --vm-memory 2048 \\
        --json`,
      { env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN } }
    );

    // Get app URL
    const url = `https://${appName}.fly.dev`;
    
    console.log(`[Fly.io] Container provisioned: ${url}`);
    return { url };

  } catch (error) {
    console.error('[Fly.io] Provisioning error:', error);
    throw new Error(`Failed to provision Fly.io container: ${error}`);
  }
}

/**
 * DELETE /api/topcandidates/provision-container
 * 
 * Cleanup/destroy a container after assessment
 */
export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    // Get container info
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('container_url')
      .eq('session_id', sessionId)
      .single();

    if (!session?.container_url) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    // Extract app name from URL
    const appName = session.container_url.replace('https://', '').replace('.fly.dev', '');
    
    // Destroy Fly.io app
    await execAsync(
      `flyctl apps destroy ${appName} --yes`,
      { env: { ...process.env, FLY_API_TOKEN: process.env.FLY_API_TOKEN } }
    );

    // Update database
    await supabase
      .from('interview_sessions')
      .update({
        container_status: 'stopped',
        container_stopped_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Cleanup Container] Error:', error);
    return NextResponse.json({ error: 'Failed to cleanup container' }, { status: 500 });
  }
}
```

---

## Step 4: Alternative: Use Fly.io Machines API (Recommended)

The Fly.io Machines API is better for programmatic control:

### 4.1 Install Fly.io Client Library

```bash
npm install @flydotio/fly-client
```

### 4.2 Updated Provisioning with Machines API

```typescript
// lib/container-orchestration/flyio.ts
import { FlyClient } from '@flydotio/fly-client';

const fly = new FlyClient({ apiToken: process.env.FLY_API_TOKEN! });

export async function provisionFlyMachine(config: {
  candidateId: string;
  sessionId: string;
  password: string;
  telemetryUrl: string;
}): Promise<{ url: string }> {
  const appName = `assessment-${config.candidateId.slice(0, 12)}`;

  // 1. Create app
  await fly.apps.create({
    app_name: appName,
    org_slug: 'hermes-assessments',
  });

  // 2. Launch machine
  const machine = await fly.machines.launch({
    app: appName,
    config: {
      image: 'ghcr.io/hermes-startup/hermes-assessment:latest',
      env: {
        CANDIDATE_ID: config.candidateId,
        SESSION_ID: config.sessionId,
        PASSWORD: config.password,
        TELEMETRY_URL: config.telemetryUrl,
        AUTO_COMMIT_INTERVAL: '120',
      },
      services: [
        {
          ports: [
            {
              port: 443,
              handlers: ['http', 'tls'],
            },
            {
              port: 80,
              handlers: ['http'],
            },
          ],
          protocol: 'tcp',
          internal_port: 8080,
        },
      ],
      auto_destroy: true, // Auto-cleanup after 3 hours
      restart: {
        policy: 'no', // Don't restart on crash
      },
      guest: {
        cpu_kind: 'shared',
        cpus: 1,
        memory_mb: 2048,
      },
    },
  });

  const url = `https://${appName}.fly.dev`;
  return { url };
}

export async function destroyFlyMachine(appName: string) {
  await fly.apps.delete(appName);
}
```

---

## Step 5: Update Interview Start Endpoint

Integrate container provisioning into your existing flow:

```typescript
// app/api/interview/start/route.ts

// After creating interview session:

// Provision container (includes schema creation via existing endpoint)
const containerResponse = await fetch(`${origin}/api/topcandidates/provision-container`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': request.headers.get('Cookie') || '',
  },
  body: JSON.stringify({ sessionId }),
});

const { containerUrl, containerPassword, credentials } = await containerResponse.json();

return NextResponse.json({
  sessionId,
  containerUrl,
  containerPassword,
  credentials, // Includes SUPABASE_PRIVATE_KEY, GEMINI_BASE_URL, etc.
});
```

---

## Step 6: Environment Variables

Add to `.env.local`:

```bash
# Fly.io API Token (get from: flyctl auth token)
FLY_API_TOKEN=your_fly_api_token_here
```

---

## Step 7: Database Migration

```sql
-- supabase/migrations/046_add_container_tracking.sql

ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS container_url TEXT,
ADD COLUMN IF NOT EXISTS container_password TEXT,
ADD COLUMN IF NOT EXISTS container_status TEXT DEFAULT 'provisioning',
ADD COLUMN IF NOT EXISTS container_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS container_stopped_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_container_status 
ON public.interview_sessions(container_status);
```

---

## Step 8: Auto-Cleanup Cron Job

Create a cron job to clean up old containers:

```typescript
// app/api/cron/cleanup-containers/route.ts

export async function GET() {
  const { data: sessions } = await supabase
    .from('interview_sessions')
    .select('session_id, container_url, container_started_at')
    .eq('container_status', 'running')
    .lt('container_started_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString());

  for (const session of sessions || []) {
    await fetch('/api/topcandidates/provision-container', {
      method: 'DELETE',
      body: JSON.stringify({ sessionId: session.session_id }),
    });
  }

  return NextResponse.json({ cleaned: sessions?.length || 0 });
}
```

---

## Quick Start Checklist

- [ ] **Install Fly CLI**: `brew install flyctl`
- [ ] **Login**: `flyctl auth login`
- [ ] **Create org**: `flyctl orgs create hermes-assessments`
- [ ] **Push image**: `./docker/deployment/deploy.sh`
- [ ] **Get API token**: `flyctl auth token` → Add to `.env.local`
- [ ] **Create container endpoint**: `/api/topcandidates/provision-container`
- [ ] **Update interview start**: Call provisioning endpoint
- [ ] **Run migration**: Add container tracking fields
- [ ] **Test**: Create a test container

---

## Testing

```bash
# Test container provisioning
curl -X POST http://localhost:3000/api/topcandidates/provision-container \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session-123"}'

# Should return:
# {
#   "containerUrl": "https://assessment-abc123.fly.dev",
#   "containerPassword": "xyz789",
#   "credentials": { ... }
# }
```

---

## Cost Estimate

Fly.io pricing for 1 vCPU, 2GB RAM:
- **Hourly**: ~$0.01/hour
- **Per assessment** (2 hours): ~$0.02
- **100 assessments/month**: ~$2.00

Significantly cheaper than AWS ECS or Cloud Run for this use case!
