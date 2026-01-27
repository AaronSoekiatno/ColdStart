# Schema-Per-Candidate Architecture

## Overview

This project uses a **Multi-Tenant Single Database** approach with **Schema-Per-Candidate** isolation. This allows scaling to 4,000+ candidates without data collisions or high costs.

## Architecture

### Schema Structure

1. **`public` Schema (Read-Only)**
   - Contains shared reference data
   - Tables: `viral_benchmarks`, `global_templates`
   - All candidates can read but cannot modify
   - Access: `SELECT * FROM public.viral_benchmarks`

2. **`sandbox_{candidate_id}` Schema (Candidate-Owned)**
   - Each candidate gets their own schema (e.g., `sandbox_aidan`)
   - Contains candidate's personal data
   - Tables: `video_scripts`, `performance_logs`
   - Full read/write access for the candidate
   - Access: `SELECT * FROM video_scripts` (search_path handles schema resolution)

3. **`admin_audit` Schema (System-Only)**
   - Tracks candidate performance metrics
   - Tables: `candidate_metrics`
   - Locked from candidate access
   - Used for system monitoring and analytics

## How It Works

### Schema "Jailing"

When a candidate connects, their connection uses a `search_path` parameter that "jails" them to their specific schema:

```sql
SET search_path TO sandbox_aidan, public;
```

This means:
- `SELECT * FROM video_scripts` → queries `sandbox_aidan.video_scripts`
- `SELECT * FROM public.viral_benchmarks` → queries `public.viral_benchmarks` (explicit schema)
- Candidates cannot see other candidates' data
- Candidates can still access shared reference data in `public` schema

### Connection String Approach

For production, the connection string includes the search_path:

```
postgresql://user:pass@host/db?search_path=sandbox_aidan,public
```

### API Route Approach

The API routes use helper functions to:
1. Extract candidate ID from request headers/query params
2. Ensure candidate schema exists (creates if needed)
3. Get candidate-specific Supabase client with search_path set
4. Execute queries that are automatically "jailed" to candidate's schema

## Usage

### Creating a Candidate Schema

```sql
-- Automatically creates schema and tables
SELECT create_candidate_schema('aidan');
```

### Setting Search Path

```sql
-- Set search_path for current session
SELECT set_candidate_search_path('aidan');
```

### Querying Candidate Data

```typescript
// In API routes
const { client, schemaName } = await getCandidateSupabaseClient('aidan');

// These queries are automatically "jailed" to sandbox_aidan
const scripts = await client.from('video_scripts').select('*');

// Can still access public schema
const benchmarks = await client.from('public.viral_benchmarks').select('*');
```

## Benefits

1. **Fast Schema Creation**: Creating a schema takes milliseconds vs. minutes for a new Supabase project
2. **Data Isolation**: Complete separation between candidates
3. **Cost Effective**: Single database instance, shared infrastructure
4. **Scalable**: Can support thousands of candidates
5. **Flexible**: Candidates can still access shared reference data

## Security Considerations

- Candidates are "jailed" to their schema via search_path
- They cannot access other candidates' schemas
- They can read (but not write) public schema
- They cannot access admin_audit schema
- All schema operations use SECURITY DEFINER functions with proper permissions

## Migration Order

1. Run `001_initial_schema.sql` - Creates schema structure and functions
2. Run `002_seed_data.sql` - Seeds public schema with reference data
3. Candidate schemas are created on-demand when candidates first connect

