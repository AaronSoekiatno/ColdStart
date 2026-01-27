# Hermes Interview Integration

This directory contains configuration and scripts for integrating with the Hermes interview orchestrator system.

## Configuration

The `.hermes/config.json` file is automatically created when an interview repository is initialized. It contains:

- `sessionId`: The unique session identifier for this interview
- `apiBaseUrl`: The base URL for the Hermes interview API

**Note:** The actual `config.json` file is not committed to git (see `.gitignore`). This repository contains `config.json.example` as a template.

## How It Works

When tests pass in GitHub Actions workflows, the system automatically notifies the Hermes orchestrator, which can then:
- Transition interview phases (BUILD → FIX, etc.)
- Trigger Vapi calls for the next phase
- Update the interview status

## Testing

To manually test the integration:

```bash
bash .hermes/test-notification.sh
```

This will send a test notification to the Hermes API using the session ID from `config.json`.

## Workflows

The integration works in two ways:

1. **Direct workflow notification**: Tests workflows include a step that directly calls the Hermes API when tests pass
2. **Check suite listener**: A separate workflow listens for GitHub check suite completion events and notifies Hermes

Both methods ensure reliable notification even if one method fails.
