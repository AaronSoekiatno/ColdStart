# Minerva

**Autonomous Voice-Driven Technical Interviewer**

Minerva is an agentic system that conducts end-to-end coding interviews using voice (Vapi.ai) and real coding environments. It measures candidate "slope" (velocity & learning rate) by tracking their progress through a multi-phase technical challenge.

## Features

- **Voice-First**: Low-latency, natural conversation via Vapi.ai.
- **Cost Optimized**: Voice agent sleeps during deep work, saving ~65%.
- **Real Engineering Signal**: Phases advance only on passing tests (`check_suite`).
- **Snapshot System**: Automatically captures workspace state at critical phases. [Setup Guide](docs/snapshot-system-setup.md).

## Quick Start

1. **Configure Environment**:
   Copy `.env.example` to `.env.local` and fill in Vapi, Supabase, and GitHub credentials.

2. **Install & Run**:
   ```bash
   npm install
   npm run dev
   ```

3. **Simulate Interview**:
   ```bash
   node --env-file=.env.local tests/test-interview-flow.js
   ```

## Architecture

Minerva orchestrates the Candidate, Voice Agent, and Codebase:

1. **Kick-off**: Voice agent introduces the challenge.
2. **Build**: Candidate pushes code; GitHub Actions run tests.
3. **Bug Injection**: System introduces a bug; Voice agent alerts candidate.

See [Interview API Endpoints](docs/interview-api-endpoints.md) for API details.

## Project Structure

- **Minerva**: Voice-driven interviewer system.
- **Hermes**: Candidate matching and resume platform.
