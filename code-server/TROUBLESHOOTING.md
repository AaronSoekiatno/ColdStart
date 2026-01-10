# Troubleshooting Guide

## Common Issues and Solutions

### 🔴 Issue 1: "code-server is not running" error on IDE page

**Symptoms:**
- IDE page shows error message
- Provisioning fails at "Verifying IDE availability" step
- Error: "code-server is not running. Please start it with: cd code-server && .\start.ps1"

**Solutions:**

1. **Start code-server**
   ```powershell
   cd code-server
   .\start.ps1
   ```

2. **Verify it's running**
   ```powershell
   docker-compose ps
   ```
   Should show `coldstart-code-server` as `Up`

3. **Check if accessible**
   Open http://localhost:8080 in your browser
   - If you see VS Code → code-server is running
   - If connection refused → code-server is not running

---

### 🔴 Issue 2: Port 8080 already in use

**Symptoms:**
- Error during `.\start.ps1`: "port is already allocated"
- `.\test.ps1` shows "Port 8080 is already in use"

**Solutions:**

**Option A: Stop the existing service**
```powershell
# Check what's using port 8080
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess

# If it's code-server
docker-compose down

# If it's something else, stop that service
```

**Option B: Change the port**

1. Edit `docker-compose.yml`:
   ```yaml
   ports:
     - "8081:8080"  # Change 8080 to 8081 (or any free port)
   ```

2. Edit `app/ide/page.tsx` (around line 96):
   ```typescript
   const codeServerUrl = 'http://localhost:8081';  // Match the new port
   ```

3. Restart:
   ```powershell
   docker-compose down
   docker-compose up -d
   ```

---

### 🔴 Issue 3: Docker is not running

**Symptoms:**
- Error: "Cannot connect to the Docker daemon"
- `.\test.ps1` shows "Docker is not running"

**Solutions:**

1. **Start Docker Desktop**
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon should be steady, not animated)

2. **Verify Docker is running**
   ```powershell
   docker info
   ```
   Should show Docker version and server info

3. **If Docker Desktop won't start**
   - Restart your computer
   - Reinstall Docker Desktop
   - Check Windows features: Hyper-V and WSL2 should be enabled

---

### 🔴 Issue 4: Iframe shows blank page

**Symptoms:**
- IDE page loads
- Iframe is blank or shows error
- No VS Code UI visible

**Solutions:**

1. **Check browser console**
   - Press F12 to open DevTools
   - Look for errors in Console tab
   - Common errors:
     - CORS errors → Expected, should still work
     - Mixed content → Make sure both use http://
     - Refused to connect → code-server not running

2. **Verify code-server directly**
   - Open http://localhost:8080 in a new tab
   - If it works there but not in iframe → Check iframe sandbox attributes

3. **Check iframe sandbox**
   In `app/ide/page.tsx`, verify these attributes:
   ```typescript
   sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
   ```

4. **Try disabling browser extensions**
   - Ad blockers might block iframes
   - Try in incognito mode

---

### 🔴 Issue 5: Build fails or takes too long

**Symptoms:**
- `docker-compose build` fails
- Build takes more than 15 minutes
- Network timeout errors

**Solutions:**

1. **Check internet connection**
   - Building requires downloading Ubuntu, Node.js, Python, etc.
   - Ensure stable internet connection

2. **Retry with no cache**
   ```powershell
   docker-compose build --no-cache
   ```

3. **Check Docker resources**
   - Docker Desktop → Settings → Resources
   - Increase RAM to at least 4GB
   - Increase CPU to at least 2 cores

4. **Check disk space**
   - Ensure at least 5GB free space
   - Clean up old Docker images:
     ```powershell
     docker system prune -a
     ```

---

### 🔴 Issue 6: Container keeps restarting

**Symptoms:**
- `docker-compose ps` shows container restarting
- code-server not accessible
- Logs show errors

**Solutions:**

1. **Check logs**
   ```powershell
   docker-compose logs -f
   ```
   Look for error messages

2. **Common log errors:**

   **"Address already in use"**
   → Port 8080 is taken, change port (see Issue 2)

   **"Permission denied"**
   → File permission issues, rebuild:
   ```powershell
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

   **"Out of memory"**
   → Increase Docker memory limit

3. **Reset everything**
   ```powershell
   docker-compose down
   docker volume rm code-server_workspace-data
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

### 🔴 Issue 7: Changes in starter-workspace not appearing

**Symptoms:**
- Modified files in `starter-workspace/`
- Changes don't appear in code-server

**Solutions:**

1. **Rebuild the image**
   ```powershell
   .\stop.ps1
   docker-compose build --no-cache
   .\start.ps1
   ```

2. **Understand the copy process**
   - Files are copied during image build
   - Changes require rebuild
   - For live editing, use volume mount (see below)

3. **Use volume mount for development**
   Edit `docker-compose.yml`:
   ```yaml
   volumes:
     - ./starter-workspace:/workspace  # Uncomment this line
     # - workspace-data:/workspace     # Comment this line
   ```

---

### 🔴 Issue 8: Workspace data lost after restart

**Symptoms:**
- Made changes in code-server
- After restart, changes are gone

**Solutions:**

1. **Check volume**
   ```powershell
   docker volume ls
   ```
   Should show `code-server_workspace-data`

2. **Verify volume mount**
   In `docker-compose.yml`:
   ```yaml
   volumes:
     - workspace-data:/workspace  # This line should be present
   ```

3. **If volume was deleted**
   - Data is lost (no backup)
   - Restart container to get fresh starter workspace

4. **Backup important work**
   ```powershell
   # Copy files from container
   docker cp coldstart-code-server:/workspace ./backup
   ```

---

### 🔴 Issue 9: npm install fails in code-server terminal

**Symptoms:**
- Run `npm install` in code-server terminal
- Errors about permissions or network

**Solutions:**

1. **Check you're in the right directory**
   ```bash
   pwd  # Should show /workspace
   cd /workspace
   ```

2. **Permission errors**
   - Should not happen (running as `coder` user)
   - If it does, rebuild image

3. **Network errors**
   - Container needs internet access
   - Check Docker network settings

4. **Clear npm cache**
   ```bash
   npm cache clean --force
   npm install
   ```

---

### 🔴 Issue 10: IDE page stuck on "Connecting to code-server"

**Symptoms:**
- Loading screen shows "Connecting to code-server"
- Never progresses to ready state
- No error shown

**Solutions:**

1. **Check if code-server is actually running**
   ```powershell
   docker-compose ps
   curl http://localhost:8080
   ```

2. **Check browser console**
   - F12 → Console tab
   - Look for fetch errors

3. **Verify fetch logic**
   The IDE page tries to connect with:
   ```typescript
   fetch('http://localhost:8080', { method: 'HEAD', mode: 'no-cors' })
   ```
   This might not work if code-server isn't responding

4. **Manual override**
   Temporarily skip the check by commenting out the fetch in `app/ide/page.tsx`

---

## 🔍 Diagnostic Commands

### Check Docker
```powershell
# Is Docker running?
docker info

# List running containers
docker ps

# List all containers
docker ps -a

# Check code-server container
docker-compose ps
```

### Check Logs
```powershell
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# Last 50 lines
docker-compose logs --tail=50
```

### Check Network
```powershell
# Is port 8080 accessible?
curl http://localhost:8080

# What's using port 8080?
Get-NetTCPConnection -LocalPort 8080

# Test from browser
# Open: http://localhost:8080
```

### Check Files
```powershell
# List files in container
docker exec coldstart-code-server ls -la /workspace

# Check code-server config
docker exec coldstart-code-server cat /home/coder/.config/code-server/config.yaml
```

### Check Resources
```powershell
# Container resource usage
docker stats coldstart-code-server

# Disk usage
docker system df
```

---

## 🆘 Nuclear Options (Last Resort)

### Complete Reset
```powershell
# Stop everything
docker-compose down

# Remove volumes
docker volume rm code-server_workspace-data

# Remove images
docker rmi code-server-code-server

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

### Clean Docker System
```powershell
# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune -a

# Remove all unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

---

## 📞 Still Having Issues?

If none of these solutions work:

1. **Run the test script**
   ```powershell
   .\test.ps1
   ```
   This will diagnose common issues

2. **Check the logs carefully**
   ```powershell
   docker-compose logs -f
   ```
   Error messages usually point to the problem

3. **Verify your setup**
   - Docker Desktop installed and running?
   - Windows 10/11 with WSL2 or Hyper-V?
   - At least 4GB RAM available?
   - At least 5GB disk space?

4. **Try a minimal test**
   ```powershell
   # Just run code-server directly
   docker run -it --rm -p 8080:8080 codercom/code-server:latest
   ```
   If this works, the issue is with our custom image

---

## 💡 Prevention Tips

1. **Always check Docker is running first**
   ```powershell
   docker info
   ```

2. **Use the test script before starting**
   ```powershell
   .\test.ps1
   ```

3. **Monitor resources**
   - Keep Docker Desktop open to see resource usage
   - Don't run too many containers simultaneously

4. **Regular cleanup**
   ```powershell
   # Once a week
   docker system prune
   ```

5. **Keep Docker Desktop updated**
   - Check for updates regularly
   - Update when available

---

## 📊 Expected Behavior

### Normal Startup Sequence
```
1. .\start.ps1
2. "Building Docker image..." (first time only, 5-10 min)
3. "Starting container..."
4. "Waiting for code-server to be ready..."
5. "✅ code-server is ready!"
6. "🌐 Access your IDE at: http://localhost:8080"
```

### Normal IDE Page Load
```
1. Navigate to http://localhost:3000/ide
2. "Initializing connection" (1-2 seconds)
3. "Connecting to code-server" (1 second)
4. "Verifying IDE availability" (1 second)
5. VS Code UI appears in iframe
```

If your experience differs from this, refer to the relevant issue above!
