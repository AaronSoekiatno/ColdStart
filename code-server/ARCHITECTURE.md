# Code-Server IDE Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Browser                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Next.js App (localhost:3000)                   │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │          /ide Page                               │ │ │
│  │  │                                                  │ │ │
│  │  │  ┌────────────────────────────────────────────┐ │ │ │
│  │  │  │         <iframe>                           │ │ │ │
│  │  │  │                                            │ │ │ │
│  │  │  │  src="http://localhost:8080"              │ │ │ │
│  │  │  │                                            │ │ │ │
│  │  │  │  ┌──────────────────────────────────────┐ │ │ │ │
│  │  │  │  │   code-server (VS Code UI)           │ │ │ │ │
│  │  │  │  │                                      │ │ │ │ │
│  │  │  │  │  - File Explorer                     │ │ │ │ │
│  │  │  │  │  - Code Editor                       │ │ │ │ │
│  │  │  │  │  - Terminal                          │ │ │ │ │
│  │  │  │  │  - Extensions                        │ │ │ │ │
│  │  │  │  └──────────────────────────────────────┘ │ │ │ │
│  │  │  └────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Request
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  code-server (Port 8080)                               │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  /workspace                                      │ │ │
│  │  │                                                  │ │ │
│  │  │  - package.json                                  │ │ │
│  │  │  - tsconfig.json                                 │ │ │
│  │  │  - vite.config.ts                                │ │ │
│  │  │  - src/                                          │ │ │
│  │  │    - App.tsx                                     │ │ │
│  │  │    - main.tsx                                    │ │ │
│  │  │    - ...                                         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  Environment:                                          │ │
│  │  - Ubuntu 22.04                                        │ │
│  │  - Node.js 20.x                                        │ │
│  │  - Python 3.11                                         │ │
│  │  - Git                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Next.js Application
- **Location**: `app/ide/page.tsx`
- **Port**: 3000 (default Next.js dev server)
- **Purpose**: Hosts the IDE page with iframe
- **Key Features**:
  - Connection status checking
  - Loading states
  - Error handling
  - Fullscreen mode
  - Submit/close controls

### 2. Iframe
- **Source**: `http://localhost:8080`
- **Purpose**: Embeds code-server in the page
- **Permissions**:
  - `allow-same-origin`
  - `allow-scripts`
  - `allow-forms`
  - `allow-popups`
  - `allow-modals`
  - `allow-downloads`
  - `clipboard-read`
  - `clipboard-write`

### 3. Docker Container
- **Image**: Custom-built from `code-server/Dockerfile`
- **Port Mapping**: `8080:8080`
- **Volume**: `workspace-data` (persistent storage)
- **User**: `coder` (non-root)
- **Working Directory**: `/workspace`

### 4. code-server
- **Version**: Latest stable
- **Auth**: Disabled (local dev only)
- **Bind Address**: `0.0.0.0:8080`
- **Config**: `/home/coder/.config/code-server/config.yaml`

## Data Flow

### Startup Sequence

```
1. User runs: .\start.ps1
   │
   ├─→ Docker builds image (if needed)
   │   └─→ Installs: Ubuntu, Node.js, Python, Git, code-server
   │
   ├─→ Docker creates container
   │   └─→ Copies starter workspace to /workspace
   │
   ├─→ Container starts
   │   └─→ code-server starts on port 8080
   │
   └─→ Script checks health
       └─→ Displays: "code-server is ready!"

2. User runs: npm run dev
   │
   └─→ Next.js dev server starts on port 3000

3. User navigates to: http://localhost:3000/ide
   │
   ├─→ IDE page loads
   │
   ├─→ provisionContainer() runs
   │   │
   │   ├─→ Checks if code-server is running
   │   │   └─→ fetch('http://localhost:8080')
   │   │
   │   ├─→ If running: Sets ideUrl state
   │   │
   │   └─→ If not running: Shows error
   │
   └─→ Iframe loads code-server
       └─→ User sees VS Code in browser
```

### User Interaction Flow

```
User types in code-server
   │
   ├─→ Changes saved in Docker volume
   │
   ├─→ Terminal commands run in container
   │
   └─→ File changes persist across restarts
```

## File Structure

```
coldstart/
├── app/
│   └── ide/
│       └── page.tsx              # IDE page with iframe
│
└── code-server/
    ├── Dockerfile                # Container definition
    ├── docker-compose.yml        # Easy container management
    ├── .dockerignore            # Build optimization
    ├── start.ps1                # Startup script
    ├── stop.ps1                 # Shutdown script
    ├── README.md                # Detailed documentation
    ├── QUICKSTART.md            # Quick start guide
    │
    └── starter-workspace/       # Copied to /workspace in container
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        ├── README.md
        └── src/
            ├── App.tsx
            ├── App.css
            ├── main.tsx
            ├── index.css
            └── vite-env.d.ts
```

## Network Ports

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Next.js | Main application |
| 8080 | code-server | IDE interface |
| 5173 | Vite (optional) | If user runs `npm run dev` in workspace |

## Security Considerations

### Current Setup (Local Development)
- ✅ Runs on localhost only
- ✅ No external network exposure
- ✅ Non-root user in container
- ⚠️ Authentication disabled

### For Production (Future)
- 🔒 Enable authentication
- 🔒 Use reverse proxy (nginx/Caddy)
- 🔒 Add SSL/TLS
- 🔒 Implement user isolation
- 🔒 Add resource limits
- 🔒 Set up monitoring

## Scaling Considerations

### Current: Single User
- One container serves one user
- Runs on localhost
- Manual start/stop

### Future: Multi-User
- Backend API to provision containers
- Database to track sessions
- Automatic cleanup
- Load balancing
- Container orchestration (Kubernetes/Docker Swarm)
- Cloud deployment (Fly.io, Railway, AWS)

## Troubleshooting Flow

```
Issue: IDE page shows error
   │
   ├─→ Check: Is Docker running?
   │   └─→ No: Start Docker Desktop
   │
   ├─→ Check: Is code-server running?
   │   └─→ No: Run .\start.ps1
   │
   ├─→ Check: Port 8080 available?
   │   └─→ No: Change port in docker-compose.yml
   │
   └─→ Check: Browser console for errors
       └─→ CORS/iframe issues: Check sandbox attributes
```

## Performance Notes

- **First Build**: ~5-10 minutes (downloads base images, installs packages)
- **Subsequent Starts**: ~10-30 seconds (uses cached image)
- **Connection Time**: ~1-3 seconds (health check)
- **Resource Usage**: ~500MB RAM, 1 CPU core (idle)

## Future Enhancements

1. **Backend API** - Automate container provisioning
2. **User Authentication** - Secure access control
3. **Session Persistence** - Save/restore workspace state
4. **Multiple Containers** - Support concurrent users
5. **Cloud Deployment** - Deploy to Fly.io/Railway
6. **Auto-cleanup** - Remove idle containers
7. **Resource Monitoring** - Track CPU/memory usage
8. **Snapshot Feature** - Save workspace snapshots
9. **Template System** - Multiple starter templates
10. **Extension Marketplace** - Pre-install popular extensions
