# ATS Filter API Documentation

A scalable FastAPI service for resume-to-job keyword matching using spaCy NLP.

## Quick Start

### 1. Start the API Server

```bash
# Development mode (uses globally installed packages)
cd scripts
./start_ats_api_dev.sh
```

Or with virtual environment:
```bash
cd scripts
./start_ats_api.sh
```

The API will be available at:
- **API Base URL**: `http://localhost:8000`
- **Interactive Docs**: `http://localhost:8000/docs`
- **Alternative Docs**: `http://localhost:8000/redoc`

### 2. Environment Variables

The API requires these environment variables (from `.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ATS_API_PORT=8000  # Optional, defaults to 8000
ATS_API_HOST=0.0.0.0  # Optional, defaults to 0.0.0.0
```

## API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "ATS Filter API",
  "spacy_model_loaded": true
}
```

---

### Filter Single Job
```http
POST /api/filter-job
```

Filters a single job based on candidate's resume.

**Request Body:**
```json
{
  "candidate_id": "uuid-here",
  "job_requirements": "We need a Python developer with Django and React experience"
}
```

**Response:**
```json
{
  "success": true,
  "candidate_id": "uuid-here",
  "matching_keywords": ["developer", "django", "experience", "python", "react"],
  "matching_count": 5,
  "total_job_keywords": 5,
  "total_resume_keywords": 42,
  "match_percentage": 100.0,
  "missing_keywords": []
}
```

---

### Filter Multiple Jobs (Batch)
```http
POST /api/filter-jobs-batch
```

Process multiple jobs at once for better performance.

**Request Body:**
```json
{
  "candidate_id": "uuid-here",
  "jobs": [
    {
      "id": "job-1",
      "requirements": "Python developer with Django experience"
    },
    {
      "id": "job-2",
      "requirements": "React developer with TypeScript skills"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "candidate_id": "uuid-here",
  "results": [
    {
      "job_id": "job-1",
      "matching_keywords": ["developer", "django", "experience", "python"],
      "matching_count": 4,
      "total_job_keywords": 4,
      "total_resume_keywords": 42,
      "match_percentage": 100.0,
      "missing_keywords": []
    },
    {
      "job_id": "job-2",
      "matching_keywords": ["developer", "typescript"],
      "matching_count": 2,
      "total_job_keywords": 4,
      "total_resume_keywords": 42,
      "match_percentage": 50.0,
      "missing_keywords": ["react", "skill"]
    }
  ]
}
```

---

### Extract Keywords
```http
POST /api/extract-keywords
```

Extract keywords from any text using spaCy NLP.

**Request Body:**
```json
{
  "text": "Looking for a Python developer with machine learning experience"
}
```

**Response:**
```json
{
  "success": true,
  "keywords": ["developer", "experience", "learning", "machine", "python"],
  "keyword_count": 5
}
```

---

### Get Resume Keywords
```http
GET /api/resume/{candidate_id}
```

Get extracted keywords from a candidate's resume.

**Response:**
```json
{
  "success": true,
  "candidate_id": "uuid-here",
  "keywords": ["api", "database", "developer", "django", "python", "..."],
  "keyword_count": 42,
  "resume_length": 1523
}
```

## Integration with Next.js

### Example: Filter Jobs on Resume Upload

Update your `app/api/upload-resume/route.ts`:

```typescript
// After saving resume to Supabase
const atsApiUrl = process.env.ATS_API_URL || 'http://localhost:8000';

try {
  // Get all available jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, requirements')
    .eq('is_active', true);

  if (jobs && jobs.length > 0) {
    // Filter jobs in batch
    const response = await fetch(`${atsApiUrl}/api/filter-jobs-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        jobs: jobs.map(job => ({
          id: job.id,
          requirements: job.requirements
        }))
      })
    });

    const atsResults = await response.json();

    // Save top matches to database
    const topMatches = atsResults.results
      .filter(r => r.match_percentage >= 40)
      .slice(0, 10);

    // Save matches to your matches table
    for (const match of topMatches) {
      await supabase.from('matches').insert({
        candidate_id: candidateId,
        job_id: match.job_id,
        match_percentage: match.match_percentage,
        matching_keywords: match.matching_keywords,
        created_at: new Date().toISOString()
      });
    }
  }
} catch (error) {
  console.error('ATS filtering error:', error);
  // Continue without ATS filtering if it fails
}
```

### Example: Real-time Job Filtering

```typescript
// In your job search/filter component
async function filterJobsByResume(candidateId: string, jobRequirements: string) {
  const response = await fetch('http://localhost:8000/api/filter-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      candidate_id: candidateId,
      job_requirements: jobRequirements
    })
  });

  const result = await response.json();
  return result;
}
```

## Keyword Extraction Algorithm

The ATS filter uses spaCy's NLP pipeline with the following steps:

1. **Lowercase** - Convert all text to lowercase for case-insensitive matching
2. **Tokenize** - Break text into individual words/tokens
3. **Filter Stop Words** - Remove common words (the, a, is, etc.)
4. **Filter by POS** - Keep only Nouns and Adjectives (meaningful keywords)
5. **Lemmatize** - Convert to root form (e.g., "running" → "run")

This ensures accurate, semantic keyword matching between resumes and job requirements.

## Performance & Scalability

### Features for Scale:
- **Single Model Load**: spaCy model loaded once on startup (not per request)
- **Batch Processing**: Process multiple jobs with one resume fetch
- **Async Support**: FastAPI's async capabilities for concurrent requests
- **CORS Enabled**: Works with your Next.js frontend
- **Auto-reload**: Development mode auto-reloads on code changes

### Production Deployment:

For production, update `start_ats_api.sh` to disable reload:

```python
uvicorn.run(
    "ats_api:app",
    host="0.0.0.0",
    port=8000,
    reload=False,  # Disable for production
    workers=4,     # Add multiple workers
    log_level="warning"
)
```

Or use with Docker:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY scripts/ .

CMD ["uvicorn", "ats_api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## Testing

Test the API with curl:

```bash
# Health check
curl http://localhost:8000/health

# Extract keywords
curl -X POST http://localhost:8000/api/extract-keywords \
  -H "Content-Type: application/json" \
  -d '{"text": "Python developer with Django experience"}'

# Filter single job (replace with real candidate_id)
curl -X POST http://localhost:8000/api/filter-job \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "your-uuid",
    "job_requirements": "We need a Python developer"
  }'
```

## Troubleshooting

### Port Already in Use
```bash
# Kill existing process on port 8000
lsof -ti:8000 | xargs kill -9
```

### Import Errors
```bash
# Reinstall dependencies
pip3 install -r requirements.txt
python3 -m spacy download en_core_web_sm
```

### Environment Variables Not Loading
Make sure `.env.local` is in the parent directory and contains all required variables.

## Architecture

```
Next.js App (Port 3000)
    ↓ HTTP Request
FastAPI Server (Port 8000)
    ↓ Query
Supabase (resumes table)
    ↓ resume_full_text
spaCy NLP Pipeline
    ↓ Keywords
Match Results → Response
```

## Files Created

- `scripts/ats_api.py` - FastAPI server application
- `scripts/atsFilter.py` - Core ATS filtering logic with spaCy
- `scripts/start_ats_api.sh` - Production startup script (with venv)
- `scripts/start_ats_api_dev.sh` - Development startup script
- `scripts/README_ATS_API.md` - This documentation
- `lib/ats-client.ts` - TypeScript client for Next.js integration
