# Building Copilot-Free Docker Image

## Problem
The `codercom/code-server:latest` base image has GitHub Copilot baked in, making it impossible to completely remove.

## Solution
Build from a clean base using one of two approaches:

---

## Option 1: Minimal Build (RECOMMENDED)
Uses Ubuntu 22.04 + fresh code-server installation

```bash
# Build the image
docker build -f docker/Dockerfile.assessment.minimal -t hermes-assessment:minimal .

# Test it
docker run --rm -it -p 8080:8080 hermes-assessment:minimal

# Open http://localhost:8080
# Copilot should be completely absent
```

**Pros:**
- Complete control over installation
- Guaranteed no pre-installed extensions
- Smaller attack surface
- Uses official code-server install script

**Cons:**
- Slightly larger build time (first time only)

---

## Option 2: OpenVSCode Server
Uses gitpod/openvscode-server base

```bash
# Build the image
docker build -f docker/Dockerfile.assessment.clean -t hermes-assessment:clean .

# Test it
docker run --rm -it -p 8080:8080 hermes-assessment:clean

# Open http://localhost:8080
```

**Pros:**
- Open-source VS Code Server
- No Microsoft proprietary code
- Community-maintained

**Cons:**
- Different base image ecosystem
- May have slight UI differences

---

## Testing for Copilot

After starting the container, check for Copilot:

1. Open http://localhost:8080
2. Look at the left sidebar - should have NO chat/copilot icons
3. Look at the status bar (bottom) - should have NO copilot status
4. Press Ctrl+Shift+P and search "copilot" - should find nothing
5. Check Extensions panel - should be empty/disabled

---

## Recommended Next Steps

1. **Start with Minimal build** (Option 1)
2. If that works, replace your old Dockerfile:
   ```bash
   mv docker/Dockerfile.assessment docker/Dockerfile.assessment.old
   mv docker/Dockerfile.assessment.minimal docker/Dockerfile.assessment
   ```
3. Update your CI/CD pipelines if needed
4. Test deployment

---

## Comparison

| Feature | Original (codercom) | Minimal (Ubuntu) | OpenVSCode |
|---------|---------------------|------------------|------------|
| Copilot | ❌ Baked in | ✅ None | ✅ None |
| Size | ~1.2GB | ~1.4GB | ~1.1GB |
| Build Time | Fast | Medium | Fast |
| Control | Low | High | Medium |
| Extensions | Many built-in | Clean slate | Clean slate |

---

## If Copilot STILL Appears

If Copilot appears even with the minimal build, it means:

1. **Browser extension**: Check if you have a browser extension injecting Copilot
2. **Network**: Someone is proxying Copilot through your network
3. **Code injection**: Check if your `app/ide/page.tsx` is injecting it

Run this to diagnose:
```bash
docker exec -it <container-id> bash
find / -name "*copilot*" 2>/dev/null
```
