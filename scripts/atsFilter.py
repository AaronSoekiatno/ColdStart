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

    def get_candidate_role_types(self, candidate_id: str) -> Optional[List[str]]:
        """
        Fetch the role_type array for a candidate from Supabase

        Args:
            candidate_id: UUID of the candidate

        Returns:
            List of role types or None if not found
        """
        try:
            response = self.supabase.table("candidates") \
                .select("role_type") \
                .eq("id", candidate_id) \
                .single() \
                .execute()

            if response.data and response.data.get("role_type"):
                role_types = response.data.get("role_type")
                # Ensure it's a list
                if isinstance(role_types, list):
                    return role_types
                elif isinstance(role_types, str):
                    return [role_types]
            
            return None

        except Exception as e:
            print(f"Error fetching candidate role types: {str(e)}")
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

    def calculate_job_title_similarity(self, job_title: str, role_types: List[str]) -> float:
        """
        Calculate semantic similarity between job title and candidate role types
        Uses spaCy's word vectors for semantic matching

        Args:
            job_title: Job title from the job posting
            role_types: List of role types from candidate profile

        Returns:
            Similarity score as percentage (0-100)
        """
        if not job_title or not role_types:
            return 0.0

        # Process job title with spaCy
        job_doc = self.nlp(job_title.lower())

        # Find maximum similarity across all role types
        max_similarity = 0.0
        for role in role_types:
            role_doc = self.nlp(role.lower())
            # spaCy's similarity returns 0.0 to 1.0
            similarity = job_doc.similarity(role_doc)
            max_similarity = max(max_similarity, similarity)

        # Convert to percentage
        return round(max_similarity * 100, 2)

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

    def filter_job_by_resume(self, candidate_id: str, job_requirements: str, job_title: str = None) -> Dict[str, any]:
        """
        Filter a job based on keyword matching and job title similarity with candidate's resume

        Args:
            candidate_id: UUID of the candidate
            job_requirements: Job requirements text from jobs table (full_description)
            job_title: Job title for semantic matching (optional)

        Returns:
            Dictionary containing match results with weighted scoring
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
        keyword_match_results = self.match_keywords(resume_keywords, job_keywords)

        # Calculate job title similarity if job_title is provided
        job_title_similarity = 0.0
        if job_title:
            role_types = self.get_candidate_role_types(candidate_id)
            if role_types:
                job_title_similarity = self.calculate_job_title_similarity(job_title, role_types)

        # Calculate weighted combined score
        # Keywords: 70% weight, Job Title: 30% weight
        keyword_percentage = keyword_match_results["match_percentage"]
        combined_score = round((keyword_percentage * 0.7) + (job_title_similarity * 0.3), 2)

        return {
            "success": True,
            "candidate_id": candidate_id,
            "keyword_match_percentage": keyword_percentage,
            "job_title_similarity": job_title_similarity,
            "combined_score": combined_score,
            **{k: v for k, v in keyword_match_results.items() if k != "match_percentage"}
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
