# LinkedIn Network Integration Guide

This guide explains how to integrate LinkedIn network matching into candidate search and display.

## Overview

The LinkedIn import feature allows founders to import their LinkedIn connections and match them against candidates in the Hermes database. This creates a "warm network" effect where founders can discover hiring opportunities within their immediate network.

## Implementation Status

✅ **Completed:**
- Database schema (`linkedin_imports`, `founder_connections`, `linkedin_scrape_jobs`)
- CSV upload API (`/api/linkedin/csv-upload`)
- PhantomBuster API integration (`/api/linkedin/scrape`)
- Frontend UI pages (`/linkedin-import/`)
- Network utility functions (`lib/linkedin-network.ts`)

🚧 **Integration Points** (to be added by your team):
- Candidate search boosting
- Network badges in candidate cards
- Network context in candidate profiles

## Database Schema

### Tables

**`linkedin_imports`** - Tracks import sessions
- `id`, `user_id`, `method` (csv/api), `status`, `total_connections`, `matched_connections`, `file_hash`, timestamps

**`founder_connections`** - Individual LinkedIn connections
- `id`, `user_id`, `first_name`, `last_name`, `email`, `company`, `position`, `profile_url`, `connected_date`
- `matched_candidate_id` - Reference to matched candidate in Hermes DB
- `match_confidence` (0-1), `match_method` (email/name_company/name_school)

**`linkedin_scrape_jobs`** - PhantomBuster job tracking
- `id`, `user_id`, `phantombuster_container_id`, `status`, `progress`, timestamps

## API Endpoints

### Import Endpoints

```typescript
// Upload CSV file
POST /api/linkedin/csv-upload
Body: FormData with 'file' field
Response: { importId, totalConnections, matchedConnections }

// Start PhantomBuster scrape
POST /api/linkedin/scrape
Body: { linkedinEmail, linkedinPassword }
Response: { jobId, importId, containerId }

// Check scrape status
GET /api/linkedin/scrape/status?jobId={id}
Response: { status, progress, totalConnections, matchedConnections }

// Get all connections
GET /api/linkedin/connections?matched=true
Response: { connections[], totalCount }

// Delete all LinkedIn data
DELETE /api/linkedin/connections

// Get import history
GET /api/linkedin/imports
Response: { imports[] }
```

## Utility Functions

Import from `lib/linkedin-network.ts`:

```typescript
import {
  getNetworkContext,
  enrichCandidatesWithNetwork,
  boostNetworkMatches,
  sortWithNetworkFirst,
  getNetworkMatchCount,
} from '@/lib/linkedin-network';
```

### 1. Check if Candidate is in Network

```typescript
const networkContext = await getNetworkContext(candidateId, founderId);

if (networkContext) {
  console.log('Connected since:', networkContext.connectedSince);
  console.log('Mutual context:', networkContext.mutualContext);
  console.log('Match confidence:', networkContext.matchConfidence);
}
```

### 2. Enrich Candidates with Network Data

```typescript
const candidates = await fetchCandidates();
const enrichedCandidates = await enrichCandidatesWithNetwork(candidates, founderId);

// Now each candidate has optional networkContext field
enrichedCandidates.forEach(candidate => {
  if (candidate.networkContext) {
    console.log(`${candidate.name} is in your network!`);
  }
});
```

### 3. Boost Network Matches in Search

```typescript
const candidates = await searchCandidates(query);
const boostedCandidates = await boostNetworkMatches(candidates, founderId);

// Sort by boosted priority score
boostedCandidates.sort((a, b) =>
  (b.priorityScore || 0) - (a.priorityScore || 0)
);
```

### 4. Sort with Network First

```typescript
const candidates = await searchCandidates(query);
const sortedCandidates = await sortWithNetworkFirst(
  candidates,
  founderId,
  // Optional: custom sort within each group
  (a, b) => (b.score || 0) - (a.score || 0)
);
```

### 5. Display Network Count

```typescript
const matchCount = await getNetworkMatchCount(founderId);
console.log(`You have ${matchCount} matches in your network`);
```

## Integration Examples

### Example 1: Candidate Search Page

```typescript
// In your candidate search component
export async function searchCandidates(query: string, founderId: string) {
  // 1. Perform base search
  const candidates = await performBaseSearch(query);

  // 2. Enrich with network context
  const enrichedCandidates = await enrichCandidatesWithNetwork(
    candidates,
    founderId
  );

  // 3. Boost network matches
  const boostedCandidates = enrichedCandidates.map(candidate => ({
    ...candidate,
    priorityScore: candidate.networkContext
      ? (candidate.priorityScore || 0) + 20
      : candidate.priorityScore,
  }));

  // 4. Sort: network first, then by score
  return boostedCandidates.sort((a, b) => {
    if (a.networkContext && !b.networkContext) return -1;
    if (!a.networkContext && b.networkContext) return 1;
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });
}
```

### Example 2: Candidate Card Component

```tsx
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface CandidateCardProps {
  candidate: {
    id: string;
    name: string;
    networkContext?: NetworkContext;
  };
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <div className="candidate-card">
      <div className="flex items-center gap-2">
        <h3>{candidate.name}</h3>
        {candidate.networkContext && (
          <Badge className="bg-blue-500 gap-1">
            <Users className="w-3 h-3" />
            In Your Network
          </Badge>
        )}
      </div>

      {candidate.networkContext && (
        <div className="network-info text-sm text-slate-600">
          <p>
            Connected since{' '}
            {new Date(candidate.networkContext.connectedSince).toLocaleDateString()}
          </p>
          {candidate.networkContext.mutualContext && (
            <p>Context: {candidate.networkContext.mutualContext}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### Example 3: Candidate Profile Page

```tsx
import { getNetworkContext } from '@/lib/linkedin-network';

export async function CandidateProfile({ candidateId, founderId }) {
  const candidate = await getCandidate(candidateId);
  const networkContext = await getNetworkContext(candidateId, founderId);

  return (
    <div>
      <h1>{candidate.name}</h1>

      {networkContext && (
        <div className="network-banner bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900">
            🔗 This candidate is in your LinkedIn network
          </h3>
          <div className="mt-2 space-y-1 text-sm text-blue-700">
            <p>
              Connected with: {networkContext.connectionDetails.firstName}{' '}
              {networkContext.connectionDetails.lastName}
            </p>
            {networkContext.connectionDetails.company && (
              <p>From: {networkContext.connectionDetails.company}</p>
            )}
            {networkContext.connectionDetails.profileUrl && (
              <a
                href={networkContext.connectionDetails.profileUrl}
                target="_blank"
                className="text-blue-600 underline"
              >
                View LinkedIn Profile →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Rest of profile... */}
    </div>
  );
}
```

## UI Pages

### Import Landing Page
`/linkedin-import` - Method selection (CSV or API)

### CSV Upload
`/linkedin-import/csv` - CSV file upload with instructions

### Quick Import
`/linkedin-import/scrape` - LinkedIn credentials form with progress tracking

### Results
`/linkedin-import/results` - Display matched connections with candidate details

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Optional: Enable PhantomBuster API scraping
PHANTOMBUSTER_API_KEY=your_api_key_here
```

If `PHANTOMBUSTER_API_KEY` is not set, only CSV upload will be available.

### Database Migration

Run the migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually
psql -f supabase/migrations/067_create_linkedin_import_tables.sql
```

## Matching Algorithm

The system matches LinkedIn connections to candidates using three methods (in priority order):

1. **Email match** (confidence: 1.0)
   - Exact email match with candidate

2. **Name + Company** (confidence: 0.8)
   - First name, last name, and company name match

3. **Name + School** (confidence: 0.7)
   - First name, last name, and university match

## Security & Privacy

### Password Handling
- ⚠️ **NEVER stored** in database
- Used only transiently for PhantomBuster API
- Encrypted in transit
- Deleted immediately after job creation

### User Data
- LinkedIn connections stored per user
- Row-level security (RLS) enabled
- Users can only access their own data
- DELETE endpoint provided for GDPR compliance

## Cost Analysis

### CSV Upload
- **Cost:** $0
- **Reliability:** 100%
- **Time:** 10-15 minutes (LinkedIn data prep)
- **Recommended** for most users

### PhantomBuster API
- **Cost:** $56/month (Hacker plan, ~100 users)
- **Reliability:** ~90% (may fail with 2FA/CAPTCHA)
- **Time:** 5-10 minutes
- Use as optional faster alternative

## Testing

See task #6 in implementation plan for testing procedures.

### Manual Testing Checklist

1. ✅ CSV upload with sample file
2. ✅ Matching algorithm accuracy
3. ✅ Network context display
4. ✅ Security (no password storage)
5. ✅ Error handling
6. ✅ Mobile responsiveness

## Troubleshooting

### "File already uploaded" error
- User uploaded same CSV twice
- Detected by file hash comparison
- Solution: Delete previous import via `/api/linkedin/connections` DELETE endpoint

### PhantomBuster scrape fails
- 10% failure rate due to LinkedIn security (2FA, CAPTCHA)
- Automatically suggests CSV fallback method
- Solution: Use CSV upload instead

### No matches found
- Expected behavior for small networks
- Average match rate: 5-10 per 1000 connections
- Depends on overlap between network and Hermes database

## Future Enhancements

Per product spec Phase 2-4:
- Mutual connections ("You don't know X, but Y does")
- 2nd degree network expansion
- Warm intro request flow
- Network strength scoring
- Email/Slack integration

## Support

For questions or issues:
1. Check this documentation
2. Review product spec: `docs-dev/development/linkedin-scraping-product-spec.md`
3. Check API error responses for debugging info
