# ATS Filter - Quick Setup Guide

## ✅ What's Been Implemented

A **scalable FastAPI service** for resume-to-job keyword matching using spaCy NLP that can handle web traffic at scale.

### Core Features:
1. **Resume Data Pull** - Fetches `resume_full_text` from Supabase `resumes` table
2. **Keyword Extraction** - Uses spaCy with proper NLP pipeline:
   - Lowercase text
   - Tokenize
   - Filter stop words
   - Filter by POS (Nouns & Adjectives only)
   - Lemmatize to root form
3. **Keyword Matching** - Compares resume vs job requirements
4. **Batch Processing** - Handle multiple jobs efficiently
5. **REST API** - Scalable FastAPI with async support

---

## 🚀 How to Start the API

### Option 1: Development Mode (Quick Start)
```bash
cd scripts
./start_ats_api_dev.sh
```

### Option 2: With Virtual Environment
```bash
cd scripts
./start_ats_api.sh
```

The API will be available at:
- **Base URL**: http://localhost:8000
- **Docs**: http://localhost:8000/docs (Interactive Swagger UI)
- **Health**: http://localhost:8000/health

---

## 📝 Quick Test

Test the API is working:

```bash
# Health check
curl http://localhost:8000/health

# Extract keywords from text
curl -X POST http://localhost:8000/api/extract-keywords \
  -H "Content-Type: application/json" \
  -d '{"text": "Python developer with Django and React experience"}'
```

---

## 🔗 Integration with Your App

### 1. Import the Client

```typescript
import { atsClient, filterJobsOnResumeUpload } from '@/lib/ats-client';
```

### 2. Call After Resume Upload

In your `app/api/upload-resume/route.ts`, after saving to Supabase:

```typescript
// After successful resume save
const atsResults = await filterJobsOnResumeUpload(
  candidateId,
  supabase,
  {
    minMatchPercentage: 40,  // Only jobs with 40%+ match
    maxResults: 10,          // Top 10 matches
    saveToDatabase: true     // Auto-save to matches table
  }
);
```

### 3. Filter Individual Job

```typescript
const match = await atsClient.filterJob(
  candidateId,
  "We need a Python developer with Django experience"
);

console.log(`Match: ${match.match_percentage}%`);
console.log(`Keywords: ${match.matching_keywords.join(', ')}`);
```

---

## 📊 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/filter-job` | POST | Filter single job |
| `/api/filter-jobs-batch` | POST | Filter multiple jobs (efficient) |
| `/api/extract-keywords` | POST | Extract keywords from text |
| `/api/resume/{candidate_id}` | GET | Get resume keywords |

---

## 📁 Files Created

```
scripts/
├── atsFilter.py              # Core ATS filtering logic
├── ats_api.py                # FastAPI server
├── start_ats_api.sh          # Production startup
├── start_ats_api_dev.sh      # Dev startup
└── README_ATS_API.md         # Full documentation

lib/
└── ats-client.ts             # TypeScript client

.env.local                     # Updated with ATS_API_URL
requirements.txt               # Updated with FastAPI, spaCy
```

---

## 🎯 Next Steps

1. **Start the API**: Run `./scripts/start_ats_api_dev.sh`
2. **Test it**: Visit http://localhost:8000/docs
3. **Integrate**: Use the helper in your upload endpoint:
   ```typescript
   import { filterJobsOnResumeUpload } from '@/lib/ats-client';
   ```

---

## 🔧 Environment Variables

Added to `.env.local`:
```env
ATS_API_URL=http://localhost:8000
ATS_API_PORT=8000
ATS_API_HOST=0.0.0.0
```

---

## 📖 Full Documentation

See [scripts/README_ATS_API.md](scripts/README_ATS_API.md) for:
- Complete API reference
- Detailed integration examples
- Production deployment guide
- Troubleshooting

---

## 🎨 How It Works

```
User uploads resume
    ↓
Next.js saves to Supabase
    ↓
Calls ATS API: /api/filter-jobs-batch
    ↓
ATS API:
  1. Fetches resume_full_text from Supabase
  2. Extracts keywords using spaCy (lowercase, tokenize, filter, lemmatize)
  3. Compares with job requirements keywords
  4. Returns match percentage and keywords
    ↓
Next.js saves top matches to database
    ↓
User sees matched jobs
```

---

## ✨ Key Benefits

- **Scalable**: FastAPI handles concurrent requests efficiently
- **Accurate**: spaCy's NLP ensures semantic keyword matching
- **Fast**: Model loaded once on startup, batch processing supported
- **Easy Integration**: TypeScript client with helper functions
- **Production Ready**: CORS enabled, proper error handling, health checks

---

**Ready to go!** Start the API and check http://localhost:8000/docs for interactive testing.
