# Code-Server Setup for ColdStart

This directory contains everything needed to run VS Code (code-server) in a Docker container for the IDE page.

## 🎯 Quick Start

### Prerequisites
- Docker Desktop installed and running
- PowerShell (Windows)

### Start code-server

```powershell
.\start.ps1
```

This will:
1. Build the Docker image
2. Start the container
3. Wait for code-server to be ready
4. Display the access URL (http://localhost:8080)

### Stop code-server

```powershell
.\stop.ps1
```

## 🔧 Manual Commands

If you prefer to use Docker Compose directly:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📁 What's Inside

- **Dockerfile** - Ubuntu 22.04 with code-server, Node.js 20.x, Python 3.11, and git
- **docker-compose.yml** - Easy container management
- **starter-workspace/** - Pre-configured React + TypeScript project
- **start.ps1** - Automated startup script
- **stop.ps1** - Automated shutdown script

## 🌐 Accessing the IDE

Once running, access code-server at:
- **Local**: http://localhost:8080
- **From IDE page**: The iframe will load this URL

## 🔐 Security Note

Authentication is disabled (`auth: none`) because this is for local development only. 

**DO NOT expose this to the internet without proper authentication!**

## 🎨 Customizing the Workspace

The starter workspace includes:
- React 18 with TypeScript
- Vite for fast development
- ESLint for code quality
- Beautiful gradient UI with example components

To modify the starter project, edit files in `starter-workspace/` and rebuild:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check Docker is running
docker info

# View container logs
docker-compose logs
```

### Port 8080 already in use
Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "8081:8080"  # Use 8081 instead
```

Then update the IDE page to use the new port.

### Workspace data persistence
By default, workspace data is stored in a Docker volume. To use a local directory instead:

1. Uncomment this line in `docker-compose.yml`:
   ```yaml
   - ./starter-workspace:/workspace
   ```
2. Restart the container

## 🚀 Next Steps

1. Start code-server with `.\start.ps1`
2. Navigate to the IDE page in your ColdStart app
3. The iframe will load code-server automatically
4. Start coding!

## 📝 Notes for Production

This setup is for **local development only**. For production deployment:

1. Implement proper authentication
2. Use a reverse proxy (nginx, Caddy)
3. Set up SSL/TLS certificates
4. Implement container orchestration
5. Add resource limits and monitoring
6. Consider using a managed service like Fly.io or Railway
