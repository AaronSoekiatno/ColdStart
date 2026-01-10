# Hermes Assessment Environment (Docker)

This directory contains the containerized IDE environment for Minerva assessments.

## 📂 Key Files

- **`Dockerfile.assessment`**: Main image definition (Code-server + Claude Code + Tools)
- **`scripts/`**: Runtime scripts (`entrypoint.sh`, `auto-commit.sh`, `telemetry-sidecar.sh`)
- **`deployment/`**: Deployment configurations (`fly.toml`, `deploy.sh`)

## 🚀 Deployment Guides

- **[Fly.io Deployment Guide](../../docs/setup/flyio-deployment-guide.md)**: Complete production setup guide.
- **[Integration Guide](../../docs/setup/docker-integration-guide.md)**: How to integrate with your API.
- **[Local Usage Guide](../../docs/setup/docker-assessment-environment.md)**: Running and testing locally.

## ⚡ Quick Start (Local)

```bash
# Build
docker build -t hermes-assessment:latest -f Dockerfile.assessment .

# Run
./start-assessment.sh
```

## 🔑 Credential Provisioning

The container automatically generates `.env.local` at startup using environment variables passed by the orchestrator (Fly.io). This replaces the legacy `provision-key.js` script.

See `scripts/entrypoint.sh` for the injection logic.
