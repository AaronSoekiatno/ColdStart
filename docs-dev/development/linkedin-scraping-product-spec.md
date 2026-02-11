# LinkedIn Connection Scraping - Company Integration Spec

**Version:** 1.1  
**Date:** February 10, 2026  
**Product:** Hermes Company Dashboard  
**Owner:** Product Team


---

## 1. Executive Summary

### Objective
Enable founders to ingest their LinkedIn network as a standalone, private data source within Hermes. This layer sits on top of the existing Hermes Network, allowing founders to search, filter, and surface candidates from their own network with the added intelligence of Hermes' enrichment and scoring.


### Success Metrics
- **Import completion rate:** >70% of users who start the flow complete it
- **Network Expansion:** Add average 500-1000 private candidates per import
- **Enrichment Rate:** >30% of imported connections enriched with Hermes proprietary data
- **Time to completion:** <10 minutes from import to searchable network
- **Reliability:** >90% success rate (no manual retries needed)


### Constraints
- Budget: <$500/month for API costs during MVP
- Timeline: 2 weeks to ship
- Legal: Must minimize LinkedIn ToS violations and security risks

---

## 2. User Flow

### Primary Path: Dual-Method Approach

```
Company Dashboard
    ↓
[Settings / Network Tab]
    ↓
[Choose Import Method]
    ↓
┌─────────────────┬─────────────────┐
│  Method A:      │  Method B:      │
│  CSV Upload     │  API Scrape     │
│  (Recommended)  │  (Fast)         │
└─────────────────┴─────────────────┘
         ↓                 ↓
    [Upload CSV]      [Enter LinkedIn
                       Credentials]
         ↓                 ↓
    [Parse Data]      [Scrape via API]
         ↓                 ↓
    └──────┬──────────────┘
           ↓
    [Ingest Connections]
           ↓
    [Enrich with Hermes Data Graph]
           ↓
    [Show Results: "1,247 New Candidates Added"]
           ↓
    [Searchable via Private Network Layer]
```

### 2.2 Clean Testing Route
For development and initial testing, a standalone "Clean Route" is provided:
- **Path:** `/company/linkedin/sync`
- **Purpose:** Isolated environment to test the dual-method import flow, parsing, and initial matching without navigating the full dashboard.


### User Journey
1. User clicks "Import LinkedIn Network"
2. Sees two options with pros/cons
3. Selects method based on preference
4. Completes import (2-10 minutes)
5. Views matched candidates with connection context

---

## 3. Technical Specification

### 3.1 Method A: CSV Upload (Primary, 100% Reliable)

**How to Export Your Connections:**
1. Click the **Me** icon at the top of your LinkedIn homepage.
2. Select **Settings & Privacy**.
3. Click **Data Privacy** on the left-hand menu.
4. Under the **How LinkedIn uses your data** section, click **Get a copy of your data**.
5. Select **Want something in particular?** and check the **Connections** box.
6. Click **Request archive**. You will likely be asked to re-enter your password for security.
7. LinkedIn will email you a link to download the ZIP file (usually within 10 minutes).
8. Extract the ZIP and upload the `Connections.csv` file here.

**Technical Implementation:**

**File Parser:**
```javascript
// CSV Structure from LinkedIn:
// First Name, Last Name, Email Address, Company, Position, Connected On

const parseLinkedInCSV = (fileBuffer) => {
  const rows = csvParse(fileBuffer);
  return rows.map(row => ({
    firstName: row['First Name'],
    lastName: row['Last Name'],
    email: row['Email Address'],
    company: row['Company'],
    position: row['Position'],
    connectedDate: parseDate(row['Connected On'])
  }));
};
```

**Data Storage:**
```sql
CREATE TABLE linkedin_imports (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  uploaded_at TIMESTAMP,
  total_connections INT,
  file_hash TEXT -- prevent duplicate uploads
);

CREATE TABLE founder_connections (
  id UUID PRIMARY KEY,
  import_id UUID REFERENCES linkedin_imports(id),
  user_id UUID REFERENCES users(id),
  
  -- Raw Data Source
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company TEXT,
  position TEXT,
  connected_date DATE,
  
  -- Enrichment Layer (Optional Link to Global Hermes Graph)
  hermes_user_id UUID REFERENCES hermes_users(id),
  enrichment_score FLOAT, -- How much extra data Hermes added
  is_verified_in_hermes BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP
);


CREATE INDEX idx_connections_user ON founder_connections(user_id);
CREATE INDEX idx_connections_hermes ON founder_connections(hermes_user_id);
```

**Enrichment Strategy:**
Instead of just matching, Hermes attempts to "Enrich" the raw LinkedIn data:
1. **Level 1 (Identity):** Link to existing Hermes profile if email/name matches.
2. **Level 2 (Context):** Pull GitHub, Open Source, or Hackathon history if matched.
3. **Level 3 (Private Data):** If identity is verified, show proprietary Hermes "Why Hire" summaries.


**Pros:**
- ✅ 100% reliability (LinkedIn provides officially)
- ✅ Complete data (emails when public)
- ✅ No API costs
- ✅ Zero legal risk
- ✅ Works every time

**Cons:**
- ⏱️ Takes 10-15 minutes (LinkedIn preparation time)
- 🔄 Two-step process (download then upload)
- 📧 Some connections may not have visible emails

**Cost:** $0

---

### 3.2 Method B: Apify API (Fast, 90% Reliable)


**User Steps:**
1. Enter LinkedIn email/password
2. System queues scraping job
3. Shows progress: "Logging in... Scraping... Processing..."
4. Receives results in 5-10 minutes

**Technical Implementation:**

**API Integration:**
```javascript
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'apify/linkedin-connections-scraper'; 

async function scrapeLinkedIn(email, password, userId) {
  // 1. Launch actor
  const run = await axios.post(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      email,
      password,
      limit: 5000,
      proxy: { useApifyProxy: true }
    }
  );

  const runId = run.data.data.id;
  const datasetId = run.data.data.defaultDatasetId;
  
  // 2. Poll status
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'READY') {
    await sleep(15000);
    
    const runCheck = await axios.get(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    
    status = runCheck.data.data.status;
    
    // Update user on progress
    await updateJobStatus(userId, {
      status: 'scraping',
      progress: calculateProgress(runCheck.data.data)
    });
  }

  // 3. Fetch results
  if (status === 'SUCCEEDED') {
    const output = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );

    const connections = output.data;
    
    // 4. Process and store
    await processConnections(userId, connections);
    
    return { success: true, count: connections.length };
  } else {
    return { error: 'scrape_failed', status };
  }
}
```

**Error Handling:**
```javascript
// Common failure scenarios
switch (status) {
  case 'error':
    if (errorMessage.includes('verification')) {
      return {
        error: 'verification_required',
        message: 'LinkedIn requires verification. Please try CSV method.',
        fallbackUrl: '/linkedin/csv-upload'
      };
    }
    if (errorMessage.includes('credentials')) {
      return {
        error: 'invalid_credentials',
        message: 'Login failed. Check your email/password.'
      };
    }
    break;
}
```

**Security Measures:**
```javascript
// NEVER persist passwords
async function handleScrapeRequest(req, res) {
  const { email, password, userId } = req.body;
  
  // Encrypt in transit only
  const encryptedPassword = encrypt(password);
  
  // Queue job (password stored in memory only)
  const job = await scrapeQueue.add({
    userId,
    email,
    password: encryptedPassword
  }, {
    removeOnComplete: true, // Delete immediately after processing
    removeOnFail: true
  });
  
  res.json({ jobId: job.id });
}
```

**Pros:**
- ⚡ Fast (5-10 minutes)
- 🤖 Fully automated
- 📊 Good data quality
- 🔧 Handles pagination automatically

**Cons:**
- ⚠️ 10% failure rate (2FA, CAPTCHA, account restrictions)
- 💰 API costs (~$50-100/month)
- 🔐 Requires password (security concern)
- 📜 Violates LinkedIn ToS

**Cost:** $56/month (PhantomBuster "Hacker" plan, 500 execution minutes)

---

### 3.3 Fallback Strategy

```javascript
// If Apify fails, automatically suggest CSV
if (scrapeResult.error === 'verification_required') {

  return {
    status: 'failed',
    message: 'LinkedIn blocked automated access',
    fallback: {
      method: 'csv',
      title: 'Try Manual Upload Instead',
      description: '100% reliable, takes 10 minutes',
      ctaUrl: '/linkedin/csv-upload'
    }
  };
}
```

---

## 4. API Cost Analysis

### Apify Pricing

| Plan | Cost/Month | Included Credits | Usage Rate | Cost per User |
|------|-----------|------------------|------------|---------------|
| Free | $0 | $5 | $0.25/100 connections | 20 users free |
| Personal | $49 | $49 | $0.25/100 connections | ~200 users |
| Team | $499 | $499 | $0.25/100 connections | ~2000 users |

**Assumptions:**
- Average 1000 connections per user ($2.50 compute/proxy cost)
- 5-10 scrapes/day = 150-300/month during MVP

**Recommended:** Start with **Personal plan ($49/month)**

### Cost Projections

**Month 1 (MVP):**
- Users: 20-50 (Mostly Free Tier)
- Method: 70% CSV (free) + 30% API
- Total: ~$0-15

**Month 3 (Growth):**
- Users: 200-300
- Method: 60% CSV (free) + 40% API
- Total: ~$49 (covered by Personal plan credits)


---

### Company Dashboard Integration

Matches from the founder's LinkedIn network are integrated across the recruiter dashboard:

**1. Candidate Table Badge:**
- Candidates in the founder's network show a "1st Degree" or "Network" badge.
- Tooltip: "Connected to Founder since [Date]"

**2. Candidate Brief Card:**
- A dedicated "Network Context" section appears.
- Displays: "Connected to Founder", "Mutual Company: [Company]", and "Warm intro available".

**3. Search Filtering:**
- A "In Your Network" toggle in the search filters to quickly view all known candidates.


---

## 6. Data Model

```sql
-- LinkedIn import tracking
CREATE TABLE linkedin_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  method TEXT NOT NULL, -- 'csv' or 'api'
  status TEXT NOT NULL, -- 'processing', 'complete', 'failed'
  total_connections INT,
  matched_connections INT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Individual connections
CREATE TABLE founder_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES linkedin_imports(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- LinkedIn data
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company TEXT,
  position TEXT,
  profile_url TEXT,
  connected_date DATE,
  
  -- Matching data
  hermes_user_id UUID REFERENCES hermes_users(id),
  match_confidence FLOAT, -- 0.0 to 1.0
  match_method TEXT, -- 'email', 'name_company', 'name_school'
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scraping jobs (for API method)
CREATE TABLE linkedin_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  phantombuster_container_id TEXT, -- Keep legacy field name for compatibility or rename to apify_run_id

  status TEXT, -- 'queued', 'running', 'success', 'failed'
  progress INT, -- 0-100
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_connections_user_id ON founder_connections(user_id);
CREATE INDEX idx_connections_hermes_id ON founder_connections(hermes_user_id);
CREATE INDEX idx_connections_email ON founder_connections(email);
CREATE INDEX idx_imports_user_id ON linkedin_imports(user_id);
```

---

## 7. Search Integration

### Enhanced Candidate Search

When founder searches for candidates, boost network matches:

```javascript
async function searchCandidates(projectId, founderId) {
  // 1. Base search in Hermes
  let candidates = await searchHermes(project.requirements);
  
  // 2. Load founder's connections
  const connections = await db.founder_connections.find({
    user_id: founderId,
    hermes_user_id: { $ne: null }
  });
  
  // 3. Enrich candidates with network context
  candidates = candidates.map(candidate => {
    const connection = connections.find(c => c.hermes_user_id === candidate.id);
    
    if (connection) {
      candidate.networkContext = {
        type: 'linkedin_1st_degree',
        connectedSince: connection.connected_date,
        mutualContext: connection.company,
        matchConfidence: connection.match_confidence
      };
      candidate.priorityScore += 20; // Boost ranking
    }
    
    return candidate;
  });
  
  // 4. Sort: network connections first
  candidates.sort((a, b) => {
    if (a.networkContext && !b.networkContext) return -1;
    if (!a.networkContext && b.networkContext) return 1;
    return b.priorityScore - a.priorityScore;
  });
  
  return candidates;
}
```

### Candidate Brief Enhancement

```javascript
// Add network context to candidate briefs
{
  name: "Alex Chen",
  
  // NEW: Network section
  network: {
    connection: "1st degree on LinkedIn",
    since: "October 2017",
    context: "Both worked at Stripe (2018-2020)",
    howToReach: "Direct LinkedIn message or alex@email.com"
  },
  
  knownFacts: [...],
  signals: [...],
  unknowns: [...],
  whyConsider: "Strong technical background + warm connection"
}
```

---

## 8. Security & Privacy

### Password Handling

**Critical Requirements:**
- ❌ NEVER store passwords in database
- ❌ NEVER log passwords
- ✅ Encrypt in transit only
- ✅ Delete from memory immediately after use
- ✅ Use job queue with `removeOnComplete: true`

```javascript
// Secure password flow
app.post('/api/linkedin/scrape', async (req, res) => {
  const { email, password, userId } = req.body;
  
  // Validate
  if (!email || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }
  
  // Queue job (password in memory only)
  const job = await scrapeQueue.add({
    userId,
    email,
    password: encrypt(password) // Only in transit
  }, {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 1 // Don't retry with passwords
  });
  
  res.json({ jobId: job.id });
});
```

### Data Retention

**Connection Data:**
- Store indefinitely (user-provided)
- User can delete anytime via "Delete LinkedIn Data" button
- Include in GDPR export/deletion flows

**Scraping Jobs:**
- Delete after 24 hours
- Keep only status logs (no credentials)

### Legal Disclosure

**Required on import page:**
```
⚠️ Important Information

CSV Upload Method:
• You download your own data from LinkedIn
• 100% compliant with LinkedIn's terms
• We never access your LinkedIn account

Quick Import Method:
• We log into LinkedIn on your behalf
• This may violate LinkedIn's Terms of Service
• Your LinkedIn account could be restricted
• We don't store your password
• We're not liable for any account issues

☑️ I understand and accept the risks
```

---

## 9. Implementation Timeline

### Week 1: Core Functionality

**Day 1-2: CSV Upload**
- [ ] File upload UI
- [ ] CSV parser
- [ ] Database schema
- [ ] Basic matching algorithm (email only)

**Day 3-4: Matching Enhancement**
- [ ] Name + company matching
- [ ] Name + school matching
- [ ] Match confidence scoring
- [ ] Results page UI

**Day 5: Testing**
- [ ] Test with real LinkedIn exports
- [ ] Test matching accuracy
- [ ] Handle edge cases (empty emails, special characters)

### Week 2: API Integration + Polish

**Day 6-7: Apify Integration**
**
- [ ] API integration
- [ ] Job queue setup
- [ ] Progress tracking
- [ ] Error handling

**Day 8-9: Search & Profile Integration**
- [ ] Implement Private Network search layer
- [ ] Add "Enriched by Hermes" context to candidate briefs
- [ ] "From Your Network" badges across dashboard


**Day 10: Security & Legal**
- [ ] Secure password handling
- [ ] Legal disclosures
- [ ] Privacy policy updates
- [ ] GDPR compliance

---

## 10. Success Criteria

### Launch Criteria (Must-Have)
- ✅ CSV upload works 100% of time
- ✅ Enrichment identifies >30% of connections for cross-platform data (GitHub, etc.)
- ✅ No passwords stored anywhere
- ✅ Legal disclosure visible
- ✅ Results appear within 2 minutes (CSV) or 10 minutes (API)


### Quality Metrics (Post-Launch)

**Week 1:**
- 10 users complete import
- 70%+ completion rate
- <5% error rate

**Month 1:**
- 50 users complete import
- Average 1,000+ candidates added to private networks
- 30%+ enrichment rate across private datasets
- 20%+ of network-sourced candidates get contacted

**Month 3:**
- 200 users complete import
- API method <10% failure rate
- Network candidates → 2x contact rate vs cold candidates


---

## 11. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LinkedIn bans accounts | Medium | High | Offer CSV as primary, API as optional |
| Apify rate limits | Low | Medium | Utilize Apify's residential proxies |

| Password leak | Low | Critical | Never store, encrypt in transit, audit code |
| Low match rate | Medium | Medium | Expand matching logic, add fuzzy matching |
| User abandons during wait | Medium | Low | Show progress, set expectations upfront |
| API cost overruns | Low | Medium | Monitor usage, cap at $200/month initially |

---

## 12. Future Enhancements (Post-MVP)

**Phase 2 (Month 2):**
- Mutual connections ("You don't know Alex, but Sarah does")
- School-based network expansion
- Refresh/re-import connections

**Phase 3 (Month 3):**
- 2nd degree network analysis
- Warm intro request flow
- Network strength scoring

**Phase 4 (Month 4+):**
- Email integration (Gmail contacts)
- Slack workspace analysis
- GitHub network mapping

---

## 13. Open Questions

1. **Hermes database structure:** What fields exist? (name, email, school, company, skills?)
2. **User consent:** Have Hermes candidates opted-in to be matched?
3. **Match threshold:** Show only high-confidence (>0.8) or all matches?
4. **Refresh cadence:** How often should users re-import connections?
5. **Apify settings:** Use residential proxies to minimize risk of LinkedIn blocks?


---

## 14. Appendix

### A. Apify Actor Details

**Actor Name:** LinkedIn Connections Scraper  
**Actor ID:** `apify/linkedin-connections-scraper`  

**Execution Time:** 5-10 minutes for 1000 connections  
**Max Profiles:** 5000 per execution  
**Output Format:** CSV with name, company, position, profile URL

### B. LinkedIn CSV Export Structure

```csv
First Name,Last Name,Email Address,Company,Position,Connected On
John,Doe,john@email.com,Anthropic,Engineer,15 Oct 2023
Jane,Smith,,Google,PM,03 Jan 2022
```

**Fields:**
- First Name: Always present
- Last Name: Always present
- Email Address: Optional (depends on privacy settings)
- Company: Current company
- Position: Current title
- Connected On: Date format varies by locale

### C. API Endpoints

```javascript
// Import endpoints
POST /api/company/linkedin/csv-upload
POST /api/company/linkedin/scrape
GET  /api/company/linkedin/status/:jobId

// Connection endpoints
GET  /api/company/linkedin/connections
GET  /api/company/linkedin/matches
DELETE /api/company/linkedin/connections


// Search integration
GET  /api/candidates/search?projectId=xxx&includeNetwork=true
```

---

**Document Version History:**
- v1.0 (Feb 10, 2026): Initial specification

**Approval:**
- [ ] Product Lead
- [ ] Engineering Lead
- [ ] Legal Review
