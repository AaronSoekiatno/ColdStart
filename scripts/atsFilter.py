"""
ATS Filter - Keyword matching between resume and job requirements
Uses spaCy for NLP-based keyword extraction and matching
"""

import os
from typing import Dict, Set, Optional
from dotenv import load_dotenv
from supabase import create_client, Client
import spacy
from spacy.tokens import Doc

# Load environment variables
load_dotenv()

class ATSFilter:
    """ATS Filter for keyword-based resume to job matching"""

    def __init__(self):
        """Initialize Supabase client and spaCy model"""
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("Missing Supabase credentials in environment variables")

        # Remove trailing slash from URL if present
        supabase_url = supabase_url.rstrip('/')

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Load spaCy English model
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Downloading spaCy English model...")
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")

    def get_resume_full_text(self, candidate_id: str) -> Optional[str]:
        """
        Fetch only the resume_full_text for a candidate from Supabase

        Args:
            candidate_id: UUID of the candidate

        Returns:
            String containing the full resume text or None if not found
        """
        try:
            # Fetch the primary resume for the candidate
            response = self.supabase.table("resumes") \
                .select("resume_full_text") \
                .eq("candidate_id", candidate_id) \
                .eq("is_active", True) \
                .eq("is_primary", True) \
                .single() \
                .execute()

            if response.data and response.data.get("resume_full_text"):
                return response.data.get("resume_full_text")

            # Fallback: if no primary resume, get the most recent one
            response = self.supabase.table("resumes") \
                .select("resume_full_text") \
                .eq("candidate_id", candidate_id) \
                .eq("is_active", True) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if response.data and len(response.data) > 0:
                return response.data[0].get("resume_full_text")

            return None

        except Exception as e:
            print(f"Error fetching resume full text: {str(e)}")
            return None

    def extract_keywords(self, text: str) -> Set[str]:
        """
        Extract keywords from text using spaCy NLP pipeline:
        1. Lowercase all text
        2. Tokenize
        3. Filter stop words
        4. Filter by POS (keep only Nouns and Adjectives)
        5. Lemmatize to get root form

        Args:
            text: Input text to process

        Returns:
            Set of extracted keywords
        """
        if not text:
            return set()

        # Step 1: Lowercase all text
        text_lower = text.lower()

        # Step 2: Tokenize using spaCy
        doc: Doc = self.nlp(text_lower)

        keywords = set()

        for token in doc:
            # Step 3: Filter stop words
            if token.is_stop:
                continue

            # Filter out punctuation and whitespace
            if token.is_punct or token.is_space:
                continue

            # Step 4: Filter by POS - keep only Nouns (NOUN, PROPN) and Adjectives (ADJ)
            if token.pos_ not in ["NOUN", "PROPN", "ADJ"]:
                continue

            # Step 5: Lemmatize - get the root form
            lemma = token.lemma_

            # Only add meaningful keywords (length > 1)
            if len(lemma) > 1:
                keywords.add(lemma)

        return keywords

    def match_keywords(self, resume_keywords: Set[str], job_keywords: Set[str]) -> Dict[str, any]:
        """
        Match keywords between resume and job requirements

        Args:
            resume_keywords: Set of keywords from resume
            job_keywords: Set of keywords from job requirements

        Returns:
            Dictionary with matching results
        """
        # Find common keywords
        matching_keywords = resume_keywords.intersection(job_keywords)

        # Calculate match percentage
        if len(job_keywords) == 0:
            match_percentage = 0.0
        else:
            match_percentage = (len(matching_keywords) / len(job_keywords)) * 100

        return {
            "matching_keywords": sorted(list(matching_keywords)),
            "matching_count": len(matching_keywords),
            "total_job_keywords": len(job_keywords),
            "total_resume_keywords": len(resume_keywords),
            "match_percentage": round(match_percentage, 2),
            "missing_keywords": sorted(list(job_keywords - resume_keywords))
        }

    def filter_job_by_resume(self, candidate_id: str, job_requirements: str) -> Dict[str, any]:
        """
        Filter a job based on keyword matching with candidate's resume

        Args:
            candidate_id: UUID of the candidate
            job_requirements: Job requirements text from jobs table

        Returns:
            Dictionary containing match results
        """
        # Get resume text
        resume_text = self.get_resume_full_text(candidate_id)

        if not resume_text:
            return {
                "success": False,
                "error": "No resume found for candidate"
            }

        # Extract keywords from both resume and job requirements
        resume_keywords = self.extract_keywords(resume_text)
        job_keywords = self.extract_keywords(job_requirements)

        # Match keywords
        match_results = self.match_keywords(resume_keywords, job_keywords)

        return {
            "success": True,
            "candidate_id": candidate_id,
            **match_results
        }


# Example usage
if __name__ == "__main__":
    # Initialize the filter
    ats_filter = ATSFilter()

    # Example: Test keyword extraction
    sample_text = "Looking for a Python developer with experience in Machine Learning and Django frameworks"
    keywords = ats_filter.extract_keywords(sample_text)
    print(f"Extracted keywords: {keywords}\n")

    # Example: Filter job by resume
    example_candidate_id = "your-candidate-uuid-here"
    example_job_requirements = "We need a senior software engineer with Python, JavaScript, React, and AWS experience"

    print(f"Filtering job for candidate: {example_candidate_id}")
    result = ats_filter.filter_job_by_resume(example_candidate_id, example_job_requirements)

    if result.get("success"):
        print(f"\nMatch Results:")
        print(f"Match percentage: {result['match_percentage']}%")
        print(f"Matching keywords ({result['matching_count']}): {result['matching_keywords']}")
        print(f"Missing keywords: {result['missing_keywords']}")
    else:
        print(f"\nError: {result.get('error')}")
