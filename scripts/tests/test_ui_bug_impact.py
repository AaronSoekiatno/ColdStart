"""
Test script to check if the UI bug on workatastartup affects our scraper.
Tests companies that show "No specific jobs listed" but may actually have jobs.

Usage:
    python yc_companies/test_ui_bug_impact.py
"""

"""
Test script to check if the UI bug on workatastartup affects our scraper.
Tests companies that show "No specific jobs listed" but may actually have jobs.

Usage:
    python yc_companies/test_ui_bug_impact.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]

# Load environment variables FIRST (same pattern as main script)
parent_dir = Path(__file__).parent.parent
env_loaded = (
    load_dotenv(parent_dir / '.env.local') or
    load_dotenv(parent_dir / '.env') or
    load_dotenv('.env.local') or
    load_dotenv('.env') or
    load_dotenv()
)

# Set up credentials for ycombinator-scraper library BEFORE importing
email = os.getenv("WORKATASTARTUP_EMAIL")
password = os.getenv("WORKATASTARTUP_PASSWORD")

if email and password:
    os.environ["login_username"] = email
    os.environ["login_password"] = password
    print("Login credentials loaded for ycombinator-scraper")
else:
    print("Warning: WORKATASTARTUP_EMAIL and WORKATASTARTUP_PASSWORD not set")
    print("   The scraper may not be able to access all content")

# Now import the scraper (after credentials are set)
from ycombinator_scraper import Scraper  # pyright: ignore[reportMissingImports]

# Companies known to show "No specific jobs listed" but are actually hiring
# Based on the screenshot showing companies with this message
TEST_COMPANIES = [
    {"name": "FirstIgnite", "url": "https://www.workatastartup.com/companies/firstignite"},
    {"name": "xPay", "url": "https://www.workatastartup.com/companies/xpay"},
    {"name": "Pax", "url": "https://www.workatastartup.com/companies/pax"},
    {"name": "Alex", "url": "https://www.workatastartup.com/companies/alex"},
    # Add more companies from your screenshot as needed
]

def test_company_job_extraction(company_url: str, company_name: str):
    """Test if the library extracts jobs for a company."""
    email = os.getenv("WORKATASTARTUP_EMAIL")
    password = os.getenv("WORKATASTARTUP_PASSWORD")
    
    if not email or not password:
        print("⚠️  WORKATASTARTUP_EMAIL and WORKATASTARTUP_PASSWORD not set")
        print("   Please set these in your .env.local file")
        return None
    
    # Scraper uses environment variables, not constructor arguments
    scraper = Scraper()
    
    print(f"\n{'='*60}")
    print(f"Testing: {company_name}")
    print(f"URL: {company_url}")
    print(f"{'='*60}")
    
    try:
        # Get company data using the library (same method as main script)
        company_data = scraper.scrape_company_data(company_url)
        
        # Check what the library returned
        job_data = getattr(company_data, 'job_data', None)
        job_links = getattr(company_data, 'company_job_links', None)
        
        job_data_count = len(job_data) if job_data else 0
        job_links_count = len(job_links) if job_links else 0
        
        print(f"\n📊 Library Results:")
        print(f"   job_data: {job_data_count} jobs")
        print(f"   company_job_links: {job_links_count} links")
        
        if job_data:
            print(f"   Job titles from job_data:")
            for i, job in enumerate(job_data[:5], 1):
                if hasattr(job, 'job_title'):
                    title = job.job_title
                elif hasattr(job, 'model_dump'):
                    title = job.model_dump().get('job_title', 'N/A')
                else:
                    title = str(job)
                print(f"      {i}. {title}")
        
        if job_links:
            print(f"   Sample job links (first 5):")
            for i, link in enumerate(job_links[:5], 1):
                print(f"      {i}. {link}")
        
        # Determine if there's a discrepancy
        total_jobs = max(job_data_count, job_links_count)
        
        result = {
            'company_name': company_name,
            'company_url': company_url,
            'job_data_count': job_data_count,
            'job_links_count': job_links_count,
            'total_jobs': total_jobs,
            'has_bug': total_jobs == 0
        }
        
        if total_jobs == 0:
            print(f"\n⚠️  POTENTIAL BUG: Library returned 0 jobs")
            print(f"   Manual check needed: Visit {company_url}")
            print(f"   Check if jobs are visible on the page despite 'No specific jobs listed' message")
        else:
            print(f"\n✅ Library found {total_jobs} job(s)")
        
        return result
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            'company_name': company_name,
            'company_url': company_url,
            'error': str(e)
        }

def main():
    """Run tests on all companies."""
    print("🧪 Testing UI Bug Impact on Job Extraction")
    print("="*60)
    print("\nThis script tests if the workatastartup library correctly extracts")
    print("jobs from companies that show 'No specific jobs listed' in the UI")
    print("but may actually have job postings.\n")
    
    results = []
    
    for company in TEST_COMPANIES:
        result = test_company_job_extraction(company["url"], company["name"])
        if result:
            results.append(result)
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    total_tested = len(results)
    bug_cases = [r for r in results if r.get('has_bug', False)]
    successful = [r for r in results if r.get('total_jobs', 0) > 0]
    errors = [r for r in results if 'error' in r]
    
    print(f"\nTotal companies tested: {total_tested}")
    print(f"✅ Found jobs: {len(successful)}")
    print(f"⚠️  Potential bug cases (0 jobs): {len(bug_cases)}")
    if errors:
        print(f"❌ Errors: {len(errors)}")
    
    if bug_cases:
        print(f"\n⚠️  Companies with potential bug (need manual verification):")
        for case in bug_cases:
            print(f"   - {case['company_name']}: {case['company_url']}")
    
    if successful:
        print(f"\n✅ Companies where library successfully found jobs:")
        for case in successful:
            print(f"   - {case['company_name']}: {case['total_jobs']} job(s)")
    
    print(f"\n{'='*60}")
    print("Next steps:")
    print("1. Manually verify each 'potential bug' company URL")
    print("2. Check if jobs are visible on the page despite UI message")
    print("3. If library returns 0 but jobs exist → Bug confirmed")
    print("4. If library returns jobs → No bug impact")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()

