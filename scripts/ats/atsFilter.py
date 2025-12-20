"""
ATS Filter - Keyword matching between resume and job requirements
Uses spaCy for NLP-based keyword extraction and matching
"""

import os
from typing import Dict, Set, Optional, List
from dotenv import load_dotenv
from supabase import create_client, Client
import spacy
from spacy.tokens import Doc
from cache_manager import CacheManager

# Load environment variables
load_dotenv()

class ATSFilter:
    """ATS Filter for keyword-based resume to job matching"""

    def __init__(self):
        """Initialize Supabase client, spaCy model, and cache"""
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
        
        # Initialize cache manager (gracefully handles missing Redis)
        try:
            self.cache = CacheManager()
        except Exception as e:
            print(f"⚠️  Cache initialization failed: {e}")
            print("   Continuing without cache...")
            self.cache = None

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
    
    def get_resume_keywords_cached(self, candidate_id: str) -> Set[str]:
        """
        Get resume keywords with caching
        
        Flow:
        1. Try to get from cache
        2. If cache miss, fetch from database and extract keywords
        3. Store in cache for next time
        
        Args:
            candidate_id: UUID of the candidate
            
        Returns:
            Set of keywords from resume
        """
        # Try cache first
        if self.cache and self.cache.cache_enabled:
            cached_keywords = self.cache.get_resume_keywords(candidate_id)
            if cached_keywords is not None:
                print(f"  ✓ Cache HIT for candidate {candidate_id}")
                return cached_keywords
            print(f"  ⚠️  Cache MISS for candidate {candidate_id}")
        
        # Cache miss or cache disabled - fetch and process
        resume_text = self.get_resume_full_text(candidate_id)
        if not resume_text:
            return set()
        
        keywords = self.extract_keywords(resume_text)
        
        # Store in cache for next time
        if self.cache and self.cache.cache_enabled and keywords:
            self.cache.set_resume_keywords(candidate_id, keywords)
            print(f"  ✓ Cached keywords for candidate {candidate_id}")
        
        return keywords

    def extract_candidate_gpa(self, candidate_id: str) -> Optional[float]:
        """
        Extract GPA from candidate's resume
        
        Tries to find GPA in structured resume data first, then falls back to
        parsing resume_full_text using regex patterns.
        
        Args:
            candidate_id: UUID of the candidate
            
        Returns:
            GPA as float (normalized to 4.0 scale) or None if not found
        """
        try:
            # First, try to get structured resume data
            response = self.supabase.table("resumes") \
                .select("structured_data, resume_full_text") \
                .eq("candidate_id", candidate_id) \
                .eq("is_active", True) \
                .eq("is_primary", True) \
                .single() \
                .execute()
            
            if not response.data:
                # Fallback: try most recent resume
                response = self.supabase.table("resumes") \
                    .select("structured_data, resume_full_text") \
                    .eq("candidate_id", candidate_id) \
                    .eq("is_active", True) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                if not response.data or len(response.data) == 0:
                    return None
                
                response.data = response.data[0]
            
            # Try structured data first
            structured_data = response.data.get("structured_data")
            if structured_data and isinstance(structured_data, dict):
                education = structured_data.get("education", [])
                if education and isinstance(education, list):
                    # Find highest GPA if multiple degrees
                    gpas = []
                    for edu in education:
                        gpa_str = edu.get("gpa")
                        if gpa_str:
                            # Try to extract numeric GPA
                            gpa = self._parse_gpa_string(gpa_str)
                            if gpa:
                                gpas.append(gpa)
                    
                    if gpas:
                        return max(gpas)  # Return highest GPA
            
            # Fallback: Parse from resume full text
            resume_text = response.data.get("resume_full_text")
            if resume_text:
                return self._extract_gpa_from_text(resume_text)
            
            return None
            
        except Exception as e:
            print(f"Error extracting GPA for candidate {candidate_id}: {str(e)}")
            return None
    
    def _parse_gpa_string(self, gpa_str: str) -> Optional[float]:
        """
        Parse GPA from various string formats
        
        Examples: "3.8", "3.8/4.0", "3.8 out of 4.0"
        """
        import re
        
        # Pattern: "3.8/4.0" or "3.8/4" → extract first number
        match = re.search(r'(\d\.\d+)/(\d\.?\d*)', gpa_str)
        if match:
            gpa = float(match.group(1))
            scale = float(match.group(2))
            # Normalize to 4.0 scale if needed
            if scale != 4.0:
                gpa = (gpa / scale) * 4.0
            return round(gpa, 2)
        
        # Pattern: "3.8" (simple number)
        match = re.search(r'\b(\d\.\d+)\b', gpa_str)
        if match:
            gpa = float(match.group(1))
            # Assume 4.0 scale if value is reasonable
            if 0.0 <= gpa <= 4.0:
                return round(gpa, 2)
        
        return None
    
    def _extract_gpa_from_text(self, text: str) -> Optional[float]:
        """
        Extract GPA from unstructured resume text using regex patterns
        """
        import re
        
        # List of regex patterns to try (in priority order)
        patterns = [
            r'GPA[:\s]+(\d\.\d+)/(\d\.?\d*)',  # "GPA: 3.8/4.0"
            r'GPA[:\s]+(\d\.\d+)',              # "GPA: 3.8" or "GPA 3.8"
            r'(\d\.\d+)/4\.0',                   # "3.8/4.0"
            r'(\d\.\d+)\s*out of\s*4\.0',       # "3.8 out of 4.0"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:  # Has scale (e.g., "3.8/4.0")
                    gpa = float(match.group(1))
                    scale = float(match.group(2))
                    if scale != 4.0:
                        gpa = (gpa / scale) * 4.0
                    return round(gpa, 2)
                else:  # Simple GPA (e.g., "GPA: 3.8")
                    gpa = float(match.group(1))
                    if 0.0 <= gpa <= 4.0:
                        return round(gpa, 2)
        
        return None
    
    def extract_gpa_requirement(self, job_description: str) -> Optional[float]:
        """
        Extract minimum GPA requirement from job description
        
        Args:
            job_description: Full job description text
            
        Returns:
            Minimum required GPA as float or None if no requirement found
        """
        import re
        
        # Patterns to detect GPA requirements
        patterns = [
            r'minimum\s+(\d\.\d+)\s+GPA',                      # "minimum 3.5 GPA"
            r'(\d\.\d+)\+?\s+GPA\s+(required|or higher)',     # "3.5+ GPA required"
            r'GPA\s+of\s+(\d\.\d+)\s+or\s+(higher|above)',   # "GPA of 3.5 or higher"
            r'(\d\.\d+)\s*\+\s*GPA',                          # "3.5+ GPA"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, job_description, re.IGNORECASE)
            if match:
                gpa = float(match.group(1))
                if 0.0 <= gpa <= 4.0:
                    return round(gpa, 2)
        
        return None
    
    def check_gpa_requirement(self, candidate_gpa: Optional[float], required_gpa: Optional[float]) -> Dict:
        """
        Check if candidate meets GPA requirement
        
        Args:
            candidate_gpa: Candidate's GPA (None if not found)
            required_gpa: Required minimum GPA (None if no requirement)
            
        Returns:
            Dictionary with requirement check results
        """
        # No requirement → always pass
        if required_gpa is None:
            return {
                "meets_requirement": True,
                "has_requirement": False,
                "candidate_gpa": candidate_gpa,
                "required_gpa": None
            }
        
        # Has requirement but candidate has no GPA → pass (cannot assume they don't meet it)
        if candidate_gpa is None:
            return {
                "meets_requirement": True,
                "has_requirement": True,
                "candidate_gpa": None,
                "required_gpa": required_gpa,
                "reason": f"Candidate GPA not found, cannot verify {required_gpa} requirement"
            }
        
        # Compare GPAs
        meets_requirement = candidate_gpa >= required_gpa
        
        return {
            "meets_requirement": meets_requirement,
            "has_requirement": True,
            "candidate_gpa": candidate_gpa,
            "required_gpa": required_gpa,
            "reason": None if meets_requirement else f"GPA {candidate_gpa} below required {required_gpa}"
        }

    def extract_candidate_major(self, candidate_id: str) -> Optional[List[str]]:
        """
        Extract major(s)/field(s) of study from candidate's resume
        
        Args:
            candidate_id: UUID of the candidate
            
        Returns:
            List of majors or None if not found
        """
        try:
            # Fetch structured resume data
            response = self.supabase.table("resumes") \
                .select("structured_data, resume_full_text") \
                .eq("candidate_id", candidate_id) \
                .eq("is_active", True) \
                .eq("is_primary", True) \
                .single() \
                .execute()
            
            if not response.data:
                # Fallback: try most recent resume
                response = self.supabase.table("resumes") \
                    .select("structured_data, resume_full_text") \
                    .eq("candidate_id", candidate_id) \
                    .eq("is_active", True) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                if not response.data or len(response.data) == 0:
                    return None
                
                response.data = response.data[0]
            
            majors = []
            
            # Try structured data first
            structured_data = response.data.get("structured_data")
            if structured_data and isinstance(structured_data, dict):
                education = structured_data.get("education", [])
                if education and isinstance(education, list):
                    for edu in education:
                        # Get major field
                        major = edu.get("major")
                        if major:
                            majors.append(major.lower())
                        # Also check minor field
                        minor = edu.get("minor")
                        if minor:
                            majors.append(minor.lower())
            
            if majors:
                return list(set(majors))  # Remove duplicates
            
            # Fallback: Try to extract from resume text using common patterns
            resume_text = response.data.get("resume_full_text")
            if resume_text:
                return self._extract_major_from_text(resume_text)
            
            return None
            
        except Exception as e:
            print(f"Error extracting major for candidate {candidate_id}: {str(e)}")
            return None
    
    def _extract_major_from_text(self, text: str) -> Optional[List[str]]:
        """
        Extract major from unstructured resume text using patterns
        """
        import re
        
        majors = []
        
        # Common patterns for major/field of study
        patterns = [
            r'(?:Major|Field of Study|Concentration):\s*([A-Za-z\s&]+)',
            r'Bachelor.*?in\s+([A-Za-z\s&]+)',
            r'Master.*?in\s+([A-Za-z\s&]+)',
            r'PhD.*?in\s+([A-Za-z\s&]+)',
            r'B\.S\..*?in\s+([A-Za-z\s&]+)',
            r'M\.S\..*?in\s+([A-Za-z\s&]+)',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                major = match.group(1).strip().lower()
                # Clean up common endings
                major = re.sub(r'\s+(university|college|degree).*$', '', major)
                if len(major) > 3:  # Avoid very short matches
                    majors.append(major)
        
        return list(set(majors)) if majors else None
    
    def extract_major_requirements(self, job_description: str) -> Optional[List[str]]:
        """
        Extract required major(s) from job description
        
        Args:
            job_description: Full job description text
            
        Returns:
            List of required majors or None if no requirement found
        """
        import re
        
        majors = []
        
        # Patterns to detect major requirements
        patterns = [
            r'(?:degree|bachelor|master|phd).*?in\s+([A-Za-z\s,&/]+?)(?:\s+required|\s+preferred|\.|,)',
            r'([A-Za-z\s&]+?)\s+(?:degree|major)\s+required',
            r'major.*?in\s+([A-Za-z\s,&/]+)',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, job_description, re.IGNORECASE)
            for match in matches:
                major_text = match.group(1).strip().lower()
                # Handle "or" and "/" separators (e.g., "Computer Science or Engineering")
                if ' or ' in major_text or '/' in major_text:
                    parts = re.split(r'\s+or\s+|/', major_text)
                    majors.extend([p.strip() for p in parts if len(p.strip()) > 3])
                else:
                    majors.append(major_text)
        
        # Clean up and normalize
        cleaned_majors = []
        for major in majors:
            # Remove common suffixes
            major = re.sub(r'\s+(degree|required|preferred).*$', '', major)
            if len(major) > 3:
                cleaned_majors.append(major)
        
        return list(set(cleaned_majors)) if cleaned_majors else None
    
    def check_major_requirement(self, candidate_majors: Optional[List[str]], required_majors: Optional[List[str]]) -> Dict:
        """
        Check if candidate's major matches any of the required majors
        
        Uses fuzzy matching to handle variations (e.g., "CS" vs "Computer Science")
        
        Args:
            candidate_majors: List of candidate's majors
            required_majors: List of required majors
            
        Returns:
            Dictionary with requirement check results
        """
        # No requirement → always pass
        if not required_majors:
            return {
                "meets_requirement": True,
                "has_requirement": False,
                "candidate_majors": candidate_majors,
                "required_majors": None
            }
        
        # Has requirement but candidate has no major → fail
        if not candidate_majors:
            return {
                "meets_requirement": False,
                "has_requirement": True,
                "candidate_majors": None,
                "required_majors": required_majors,
                "reason": f"Candidate major not found, but one of {required_majors} required"
            }
        
        # Check for matches (fuzzy matching)
        matches = self._find_major_matches(candidate_majors, required_majors)
        
        if matches:
            return {
                "meets_requirement": True,
                "has_requirement": True,
                "candidate_majors": candidate_majors,
                "required_majors": required_majors,
                "matched_major": matches[0],
                "reason": None
            }
        else:
            return {
                "meets_requirement": False,
                "has_requirement": True,
                "candidate_majors": candidate_majors,
                "required_majors": required_majors,
                "reason": f"Candidate majors {candidate_majors} do not match required {required_majors}"
            }
    
    def _find_major_matches(self, candidate_majors: List[str], required_majors: List[str]) -> List[str]:
        """
        Find matching majors using fuzzy matching
        
        Handles common abbreviations and variations:
        - "computer science" matches "cs"
        - "electrical engineering" matches "ee"
        - etc.
        """
        # Common abbreviations mapping
        abbreviations = {
            'cs': 'computer science',
            'ce': 'computer engineering',
            'ee': 'electrical engineering',
            'me': 'mechanical engineering',
            'ae': 'aerospace engineering',
            'ie': 'industrial engineering',
            'chem e': 'chemical engineering',
            'bio': 'biology',
            'chem': 'chemistry',
            'math': 'mathematics',
            'stats': 'statistics',
            'econ': 'economics',
            'bus': 'business',
        }
        
        matches = []
        
        for candidate_major in candidate_majors:
            candidate = candidate_major.lower().strip()
            
            # Expand abbreviations
            candidate_expanded = abbreviations.get(candidate, candidate)
            
            for required_major in required_majors:
                required = required_major.lower().strip()
                required_expanded = abbreviations.get(required, required)
                
                # Check for match (partial matching)
                if (candidate in required or required in candidate or
                    candidate_expanded in required_expanded or
                    required_expanded in candidate_expanded):
                    matches.append(candidate_major)
                    break
        
        return matches


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
        Filter a job based on keyword matching, job title similarity, GPA, and major requirements

        Args:
            candidate_id: UUID of the candidate
            job_requirements: Job requirements text from jobs table (full_description)
            job_title: Job title for semantic matching (optional)

        Returns:
            Dictionary containing match results with weighted scoring, or filtered out status
        """
        # Get resume text
        resume_text = self.get_resume_full_text(candidate_id)

        if not resume_text:
            return {
                "success": False,
                "error": "No resume found for candidate"
            }

        # CHECK GPA REQUIREMENT FIRST (STRICT FILTER)
        required_gpa = self.extract_gpa_requirement(job_requirements)
        if required_gpa is not None:
            # Job has GPA requirement - check if candidate meets it
            candidate_gpa = self.extract_candidate_gpa(candidate_id)
            gpa_check = self.check_gpa_requirement(candidate_gpa, required_gpa)
            
            if not gpa_check["meets_requirement"]:
                # STRICT FILTER: Don't show this job to the candidate
                return {
                    "success": False,
                    "filtered_by": "gpa",
                    "reason": gpa_check.get("reason", "Does not meet GPA requirement"),
                    "candidate_gpa": gpa_check.get("candidate_gpa"),
                    "required_gpa": gpa_check.get("required_gpa")
                }

        # CHECK MAJOR REQUIREMENT (STRICT FILTER)
        required_majors = self.extract_major_requirements(job_requirements)
        if required_majors:
            # Job has major requirement - check if candidate meets it
            candidate_majors = self.extract_candidate_major(candidate_id)
            major_check = self.check_major_requirement(candidate_majors, required_majors)
            
            if not major_check["meets_requirement"]:
                # STRICT FILTER: Don't show this job to the candidate
                return {
                    "success": False,
                    "filtered_by": "major",
                    "reason": major_check.get("reason", "Does not meet major requirement"),
                    "candidate_majors": major_check.get("candidate_majors"),
                    "required_majors": major_check.get("required_majors")
                }

        # Extract keywords from resume (with caching) and job requirements
        resume_keywords = self.get_resume_keywords_cached(candidate_id)
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
