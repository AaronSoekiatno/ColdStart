#!/usr/bin/env python3
"""
Test ATS Filter for a Specific User
Run this script to test ATS filtering on a specific candidate without affecting production data.
This is READ-ONLY - it won't modify any database records.

Usage:
    python test_user_ats.py <candidate_id> [job_id]
    python test_user_ats.py <candidate_email> [job_id]

Examples:
    # Test with all jobs for a candidate
    python test_user_ats.py user@example.com

    # Test with a specific job
    python test_user_ats.py user@example.com job-uuid-here
    
    # Test with candidate UUID
    python test_user_ats.py 16050c25-1ae8-4eee-8317-d427f5ff231e
"""

import sys
import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from atsFilter import ATSFilter

# Load environment variables
load_dotenv()

class ATSTestRunner:
    """Test runner for ATS filter - READ-ONLY, safe to run in production"""
    
    def __init__(self):
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing Supabase credentials in environment variables")
        
        self.supabase: Client = create_client(supabase_url.rstrip('/'), supabase_key)
        self.ats_filter = ATSFilter()
    
    def get_candidate_by_email(self, email: str) -> Optional[dict]:
        """Get candidate by email"""
        try:
            response = self.supabase.table("candidates") \
                .select("*") \
                .eq("email", email) \
                .single() \
                .execute()
            return response.data
        except Exception as e:
            print(f"❌ Error fetching candidate by email: {str(e)}")
            return None
    
    def get_candidate_by_id(self, candidate_id: str) -> Optional[dict]:
        """Get candidate by UUID"""
        try:
            response = self.supabase.table("candidates") \
                .select("*") \
                .eq("id", candidate_id) \
                .single() \
                .execute()
            return response.data
        except Exception as e:
            print(f"❌ Error fetching candidate by ID: {str(e)}")
            return None
    
    def get_job(self, job_id: str) -> Optional[dict]:
        """Get job by ID"""
        try:
            response = self.supabase.table("jobs") \
                .select("*") \
                .eq("id", job_id) \
                .single() \
                .execute()
            return response.data
        except Exception as e:
            print(f"❌ Error fetching job: {str(e)}")
            return None
    
    def get_sample_jobs(self, limit: int = 5) -> list:
        """Get sample jobs for testing"""
        try:
            response = self.supabase.table("jobs") \
                .select("*") \
                .limit(limit) \
                .execute()
            return response.data or []
        except Exception as e:
            print(f"❌ Error fetching sample jobs: {str(e)}")
            return []
    
    def print_candidate_info(self, candidate: dict):
        """Print candidate information"""
        print("\n" + "=" * 60)
        print("CANDIDATE INFORMATION")
        print("=" * 60)
        print(f"Name:       {candidate.get('name', 'N/A')}")
        print(f"Email:      {candidate.get('email', 'N/A')}")
        print(f"ID:         {candidate.get('id', 'N/A')}")
        print(f"Role Types: {candidate.get('role_type', 'N/A')}")
        print(f"Location:   {candidate.get('location', 'N/A')}")
        print(f"Skills:     {candidate.get('skills', 'N/A')[:100]}...")
        print("=" * 60 + "\n")
    
    def print_filter_results(self, job: dict, result: dict, index: int = None):
        """Print ATS filter results for a job"""
        prefix = f"Job {index}: " if index is not None else ""
        
        print(f"\n{prefix}{job.get('title', 'N/A')}")
        print("-" * 60)
        print(f"Company:     {job.get('company', 'N/A')}")
        print(f"Location:    {job.get('location', 'N/A')}")
        print(f"Job ID:      {job.get('id', 'N/A')}")
        
        if not result.get("success"):
            # Job was filtered out
            filtered_by = result.get("filtered_by", "unknown")
            print(f"\n❌ FILTERED OUT (Reason: {filtered_by})")
            print(f"   {result.get('reason', 'No reason provided')}")
            
            if filtered_by == "gpa":
                print(f"   Candidate GPA: {result.get('candidate_gpa', 'Not found')}")
                print(f"   Required GPA:  {result.get('required_gpa', 'N/A')}")
            elif filtered_by == "major":
                print(f"   Candidate Majors: {result.get('candidate_majors', 'Not found')}")
                print(f"   Required Majors:  {result.get('required_majors', 'N/A')}")
        else:
            # Job passed filters
            print(f"\n✅ PASSED FILTERS")
            print(f"\n📊 SCORING:")
            print(f"   Keyword Match:      {result.get('keyword_match_percentage', 0):.1f}%")
            print(f"   Job Title Match:    {result.get('job_title_similarity', 0):.1f}%")
            print(f"   Combined Score:     {result.get('combined_score', 0):.1f}%")
            
            print(f"\n📝 KEYWORD DETAILS:")
            print(f"   Matching Keywords:  {result.get('matching_count', 0)}/{result.get('total_job_keywords', 0)}")
            
            matching = result.get('matching_keywords', [])
            if matching:
                print(f"   Top Matches:        {', '.join(matching[:10])}")
            
            missing = result.get('missing_keywords', [])
            if missing:
                print(f"   Missing Keywords:   {', '.join(missing[:10])}")
    
    def test_single_job(self, candidate_id: str, job_id: str):
        """Test ATS filter for a single job"""
        # Get candidate
        candidate = self.get_candidate_by_id(candidate_id)
        if not candidate:
            print(f"❌ Candidate not found: {candidate_id}")
            return
        
        # Get job
        job = self.get_job(job_id)
        if not job:
            print(f"❌ Job not found: {job_id}")
            return
        
        # Print candidate info
        self.print_candidate_info(candidate)
        
        # Run ATS filter
        print("🔍 Running ATS Filter...\n")
        result = self.ats_filter.filter_job_by_resume(
            candidate_id=candidate['id'],
            job_requirements=job.get('full_description', ''),
            job_title=job.get('title')
        )
        
        # Print results
        self.print_filter_results(job, result)
    
    def test_multiple_jobs(self, candidate_id: str, limit: int = 5):
        """Test ATS filter for multiple jobs"""
        # Get candidate
        candidate = self.get_candidate_by_id(candidate_id)
        if not candidate:
            print(f"❌ Candidate not found: {candidate_id}")
            return
        
        # Get sample jobs
        jobs = self.get_sample_jobs(limit)
        if not jobs:
            print("❌ No jobs found in database")
            return
        
        # Print candidate info
        self.print_candidate_info(candidate)
        
        # Run ATS filter for each job
        print(f"🔍 Testing {len(jobs)} jobs...\n")
        results = []
        
        for i, job in enumerate(jobs, 1):
            result = self.ats_filter.filter_job_by_resume(
                candidate_id=candidate['id'],
                job_requirements=job.get('full_description', ''),
                job_title=job.get('title')
            )
            results.append((job, result))
            self.print_filter_results(job, result, i)
        
        # Print summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        passed = [r for j, r in results if r.get('success')]
        filtered = [r for j, r in results if not r.get('success')]
        
        print(f"Total Jobs Tested:   {len(jobs)}")
        print(f"Passed Filters:      {len(passed)}")
        print(f"Filtered Out:        {len(filtered)}")
        
        if passed:
            print(f"\n✅ Top 3 Matches (by combined score):")
            sorted_passed = sorted(
                [(j, r) for j, r in results if r.get('success')],
                key=lambda x: x[1].get('combined_score', 0),
                reverse=True
            )[:3]
            
            for i, (job, result) in enumerate(sorted_passed, 1):
                print(f"   {i}. {job.get('title', 'N/A')} - {result.get('combined_score', 0):.1f}%")
        
        print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    candidate_identifier = sys.argv[1]
    job_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        runner = ATSTestRunner()
        
        # Determine if input is email or UUID
        if '@' in candidate_identifier:
            # Email provided
            candidate = runner.get_candidate_by_email(candidate_identifier)
            if not candidate:
                print(f"❌ No candidate found with email: {candidate_identifier}")
                sys.exit(1)
            candidate_id = candidate['id']
        else:
            # UUID provided
            candidate_id = candidate_identifier
            candidate = runner.get_candidate_by_id(candidate_id)
            if not candidate:
                print(f"❌ No candidate found with ID: {candidate_id}")
                sys.exit(1)
        
        # Run test
        if job_id:
            runner.test_single_job(candidate_id, job_id)
        else:
            runner.test_multiple_jobs(candidate_id, limit=10)
    
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
