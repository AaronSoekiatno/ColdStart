"""
FastAPI server for ATS Filter
Provides scalable API endpoints for resume-to-job keyword matching
"""

import os
import sys
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the ATS Filter
from atsFilter import ATSFilter

# Global ATS filter instance
ats_filter: Optional[ATSFilter] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup and cleanup on shutdown"""
    global ats_filter

    # Startup: Initialize ATS filter (loads spaCy model once)
    print("Starting ATS Filter API...")
    print("Loading spaCy model and initializing Supabase connection...")
    ats_filter = ATSFilter()
    print("✓ ATS Filter initialized successfully")

    yield

    # Shutdown: Cleanup if needed
    print("Shutting down ATS Filter API...")


# Initialize FastAPI app
app = FastAPI(
    title="ATS Filter API",
    description="Resume-to-Job keyword matching API using spaCy NLP",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://joinhermes.co",
        os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000").rstrip('/')
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class FilterJobRequest(BaseModel):
    """Request model for filtering a single job"""
    candidate_id: str = Field(..., description="UUID of the candidate")
    job_requirements: str = Field(..., description="Job requirements text to match against")
    job_title: Optional[str] = Field(None, description="Job title for semantic matching")


class BatchFilterRequest(BaseModel):
    """Request model for filtering multiple jobs"""
    candidate_id: str = Field(..., description="UUID of the candidate")
    jobs: List[Dict[str, str]] = Field(..., description="List of jobs with id and requirements")


class KeywordMatchResult(BaseModel):
    """Response model for keyword matching results"""
    success: bool
    candidate_id: str
    keyword_match_percentage: float
    job_title_similarity: float
    combined_score: float
    matching_keywords: List[str]
    matching_count: int
    total_job_keywords: int
    total_resume_keywords: int
    missing_keywords: List[str]


class BatchFilterResult(BaseModel):
    """Response model for batch filtering"""
    success: bool
    candidate_id: str
    results: List[Dict]


class ExtractKeywordsRequest(BaseModel):
    """Request model for extracting keywords from text"""
    text: str = Field(..., description="Text to extract keywords from")


class ExtractKeywordsResponse(BaseModel):
    """Response model for keyword extraction"""
    success: bool
    keywords: List[str]
    keyword_count: int


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    spacy_model_loaded: bool


# API Endpoints

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with API information"""
    return {
        "service": "ATS Filter API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ATS Filter API",
        "spacy_model_loaded": ats_filter is not None and ats_filter.nlp is not None
    }


@app.post("/api/filter-job", response_model=KeywordMatchResult)
async def filter_job(request: FilterJobRequest):
    """
    Filter a single job based on candidate's resume

    This endpoint:
    1. Fetches the candidate's resume from Supabase
    2. Extracts keywords from both resume and job requirements
    3. Returns matching results with percentage
    """
    if not ats_filter:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ATS Filter service not initialized"
        )

    try:
        result = ats_filter.filter_job_by_resume(
            request.candidate_id,
            request.job_requirements,
            request.job_title
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Resume not found for candidate")
            )

        return KeywordMatchResult(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filtering job: {str(e)}"
        )


@app.post("/api/filter-jobs-batch", response_model=BatchFilterResult)
async def filter_jobs_batch(request: BatchFilterRequest):
    """
    Filter multiple jobs in batch for a candidate

    This endpoint is optimized for processing many jobs at once:
    - Fetches resume once
    - Processes all jobs against the same resume
    - Returns sorted results by match percentage
    """
    if not ats_filter:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ATS Filter service not initialized"
        )

    try:
        # Fetch resume once
        resume_text = ats_filter.get_resume_full_text(request.candidate_id)

        if not resume_text:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found for candidate"
            )

        # Extract resume keywords once
        resume_keywords = ats_filter.extract_keywords(resume_text)

        # Fetch candidate role types once for job title matching
        role_types = ats_filter.get_candidate_role_types(request.candidate_id)

        # Process all jobs
        results = []
        for job in request.jobs:
            job_id = job.get("id", "")
            job_requirements = job.get("requirements", "")
            job_title = job.get("job_title", None)

            if not job_requirements:
                continue

            # Extract job keywords
            job_keywords = ats_filter.extract_keywords(job_requirements)

            # Match keywords
            keyword_match_result = ats_filter.match_keywords(resume_keywords, job_keywords)

            # Calculate job title similarity
            job_title_similarity = 0.0
            if job_title and role_types:
                job_title_similarity = ats_filter.calculate_job_title_similarity(job_title, role_types)

            # Calculate weighted combined score (70% keywords, 30% title)
            keyword_percentage = keyword_match_result["match_percentage"]
            combined_score = round((keyword_percentage * 0.7) + (job_title_similarity * 0.3), 2)

            results.append({
                "job_id": job_id,
                "keyword_match_percentage": keyword_percentage,
                "job_title_similarity": job_title_similarity,
                "combined_score": combined_score,
                **{k: v for k, v in keyword_match_result.items() if k != "match_percentage"}
            })

        # Sort by combined score (highest first)
        results.sort(key=lambda x: x["combined_score"], reverse=True)

        return {
            "success": True,
            "candidate_id": request.candidate_id,
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filtering jobs: {str(e)}"
        )


@app.post("/api/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(request: ExtractKeywordsRequest):
    """
    Extract keywords from any text using spaCy NLP

    Useful for:
    - Testing keyword extraction
    - Processing job descriptions before storage
    - Analyzing text content
    """
    if not ats_filter:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ATS Filter service not initialized"
        )

    try:
        keywords = ats_filter.extract_keywords(request.text)

        return {
            "success": True,
            "keywords": sorted(list(keywords)),
            "keyword_count": len(keywords)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting keywords: {str(e)}"
        )


@app.get("/api/resume/{candidate_id}")
async def get_resume_keywords(candidate_id: str):
    """
    Get extracted keywords from a candidate's resume

    Useful for debugging and seeing what keywords are in a resume
    """
    if not ats_filter:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ATS Filter service not initialized"
        )

    try:
        resume_text = ats_filter.get_resume_full_text(candidate_id)

        if not resume_text:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found for candidate"
            )

        keywords = ats_filter.extract_keywords(resume_text)

        return {
            "success": True,
            "candidate_id": candidate_id,
            "keywords": sorted(list(keywords)),
            "keyword_count": len(keywords),
            "resume_length": len(resume_text)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching resume: {str(e)}"
        )


# Run the server
if __name__ == "__main__":
    # Get port from environment or use default
    port = int(os.getenv("ATS_API_PORT", "8000"))
    host = os.getenv("ATS_API_HOST", "0.0.0.0")

    print(f"Starting ATS Filter API on {host}:{port}")

    uvicorn.run(
        "ats_api:app",
        host=host,
        port=port,
        reload=True,  # Auto-reload on code changes (disable in production)
        log_level="info"
    )
