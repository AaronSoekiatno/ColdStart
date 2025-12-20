"""
Scrape job listings from workatastartup.com using the ycombinator-scraper library
and save them to Supabase database.
"""
import os
import sys
from typing import List, Optional
from dotenv import load_dotenv  # type: ignore[import-untyped]
from supabase import create_client, Client
from ycombinator_scraper import Scraper  # pyright: ignore[reportMissingImports]
import uuid

# Load environment variables
# Try .env.local first (Next.js default), then .env
env_loaded = load_dotenv('.env.local') or load_dotenv('.env') or load_dotenv()
if env_loaded:
    print("✅ Environment variables loaded")
else:
    print("⚠️  No .env file found - using system environment variables")

# Set up credentials for ycombinator-scraper library
# The library expects login_username and login_password environment variables
email = os.getenv("WORKATASTARTUP_EMAIL")
password = os.getenv("WORKATASTARTUP_PASSWORD")

if email and password:
    os.environ["login_username"] = email
    os.environ["login_password"] = password
    print("✅ Login credentials loaded for ycombinator-scraper")
else:
    print("⚠️  Warning: WORKATASTARTUP_EMAIL and WORKATASTARTUP_PASSWORD not set")
    print("   The scraper may not be able to access all content")

# Initialize Supabase client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize scraper (now that credentials are set)
scraper = Scraper()


def find_or_create_startup(company_name: str, batch: Optional[str] = None, description: Optional[str] = None) -> Optional[str]:
    """
    Find existing startup by name or create a new one.
    Returns the startup ID (as string since our table uses TEXT).
    """
    # Try to find existing startup by exact name match
    result = supabase.table("startups3").select("id").eq("name", company_name).limit(1).execute()
    
    if result.data and len(result.data) > 0:
        startup_id = result.data[0]["id"]
        print(f"   ✅ Found existing startup: {company_name} (ID: {startup_id})")
        return startup_id
    
    # Try partial match (case-insensitive)
    result = supabase.table("startups3").select("id, name").ilike("name", f"%{company_name}%").limit(5).execute()
    
    if result.data and len(result.data) > 0:
        # Check for best match
        for startup in result.data:
            if startup["name"].lower() == company_name.lower():
                startup_id = startup["id"]
                print(f"   ✅ Found existing startup (case-insensitive): {startup['name']} (ID: {startup_id})")
                return startup_id
    
    # Create new startup entry
    new_startup_id = str(uuid.uuid4())
    startup_data = {
        "id": new_startup_id,
        "name": company_name,
        "needs_enrichment": True,
    }
    
    if batch:
        startup_data["tags"] = [batch]  # Store batch in tags if that's the structure
    
    if description:
        startup_data["description"] = description
    
    try:
        supabase.table("startups3").insert(startup_data).execute()
        print(f"   ✅ Created new startup: {company_name} (ID: {new_startup_id})")
        return new_startup_id
    except Exception as e:
        print(f"   ⚠️  Error creating startup: {e}")
        return None


def save_job_to_database(job_data: dict, startup_id: Optional[str] = None) -> bool:
    """
    Save a job listing to the database.
    """
    try:
        # Prepare job data for database
        db_job = {
            "company_name": job_data.get("company_name", "Unknown"),
            "job_title": job_data.get("title", "Unknown"),
            "job_type": job_data.get("job_type"),
            "location": job_data.get("location"),
            "job_role": job_data.get("role"),
            "posted_date": job_data.get("posted_date"),
            "job_url": job_data.get("url", job_data.get("job_url")),
            "company_batch": job_data.get("batch"),
            "company_tagline": job_data.get("company_tagline"),
            "company_about": job_data.get("company_about"),
            "salary_range": job_data.get("salary_range"),
            "visa_requirements": job_data.get("visa_requirements"),
            "experience_level": job_data.get("experience_level"),
            "skills": job_data.get("skills"),
            "requirements": job_data.get("requirements"),
            "benefits": job_data.get("benefits"),
            "interview_process": job_data.get("interview_process"),
            "full_description": job_data.get("description", job_data.get("full_description")),
            "startup_id": startup_id,
        }
        
        # Remove None values
        db_job = {k: v for k, v in db_job.items() if v is not None}
        
        # Check if job already exists
        check_result = supabase.table("jobs").select("id").eq("company_name", db_job["company_name"]).eq("job_title", db_job["job_title"]).eq("job_url", db_job.get("job_url", "")).limit(1).execute()
        
        if check_result.data and len(check_result.data) > 0:
            print(f"   ⚠️  Job already exists: {db_job['job_title']} at {db_job['company_name']}")
            return False
        
        # Insert job
        result = supabase.table("jobs").insert(db_job).execute()
        print(f"   ✅ Saved job: {db_job['job_title']} at {db_job['company_name']}")
        return True
        
    except Exception as e:
        print(f"   ❌ Error saving job: {e}")
        return False


def scrape_company_jobs(company_url: str, limit: Optional[int] = None) -> int:
    """
    Scrape all jobs for a specific company.
    Returns the number of jobs scraped.
    """
    print(f"\n🔍 Scraping company: {company_url}")
    
    try:
        # Scrape company data using ycombinator-scraper library
        print(f"   🔍 Scraping company data from library...")
        company_data = scraper.scrape_company_data(company_url)
        
        if not company_data:
            print(f"   ⚠️  No data found for {company_url}")
            return 0
        
        # Debug: Print the full structure as JSON to understand the data model
        try:
            if hasattr(company_data, 'model_dump_json'):
                json_output = company_data.model_dump_json(by_alias=True, indent=2)
                print(f"   📊 Company data structure (first 500 chars):\n{json_output[:500]}...")
            elif hasattr(company_data, 'model_dump'):
                dict_output = company_data.model_dump()
                print(f"   📊 Company data keys: {list(dict_output.keys())[:10]}")
        except Exception as e:
            print(f"   ⚠️  Could not serialize company data: {e}")
        
        # Debug: Print what we got
        print(f"   📊 Company data type: {type(company_data)}")
        attrs = [attr for attr in dir(company_data) if not attr.startswith('_')]
        print(f"   📊 Available attributes: {attrs[:15]}...")
        
        # Extract company info - try multiple possible attribute names
        company_name = "Unknown"
        if hasattr(company_data, 'name') and company_data.name:
            company_name = company_data.name
        elif hasattr(company_data, 'company_name') and company_data.company_name:
            company_name = company_data.company_name
        
        company_description = None
        if hasattr(company_data, 'description') and company_data.description:
            company_description = company_data.description
        elif hasattr(company_data, 'about') and company_data.about:
            company_description = company_data.about
        elif hasattr(company_data, 'tagline') and company_data.tagline:
            company_description = company_data.tagline
        
        batch = None
        # Try to extract batch from tags or description
        if hasattr(company_data, 'tags') and company_data.tags:
            for tag in company_data.tags:
                if isinstance(tag, str) and (tag.startswith('S') or tag.startswith('W')):
                    batch = tag
                    break
        
        # Find or create startup
        startup_id = find_or_create_startup(company_name, batch, company_description)
        
        # Get jobs - the library may return jobs directly or job_links
        jobs = []
        job_links = []
        
        # Check for direct jobs list
        if hasattr(company_data, 'jobs') and company_data.jobs:
            jobs_list = company_data.jobs
            # Check if jobs are full objects or just URLs
            if jobs_list:
                first_item = jobs_list[0] if isinstance(jobs_list, list) else next(iter(jobs_list), None)
                if first_item and isinstance(first_item, str) and first_item.startswith('http'):
                    # These are URLs, not job objects
                    job_links = list(jobs_list) if isinstance(jobs_list, list) else [jobs_list]
                    print(f"   ✅ Found {len(job_links)} job URLs to scrape")
                else:
                    # These are job objects
                    jobs = list(jobs_list) if isinstance(jobs_list, list) else [jobs_list]
                    print(f"   ✅ Found {len(jobs)} jobs directly in company data")
        
        # Check for job_links attribute
        if hasattr(company_data, 'job_links') and company_data.job_links:
            links = company_data.job_links
            job_links = list(links) if isinstance(links, list) else [links]
            print(f"   ✅ Found {len(job_links)} job links to scrape")
        
        # Scrape individual job URLs if we have links but no full job data
        if job_links and not jobs:
            if limit:
                job_links = job_links[:limit]
            
            for job_url in job_links:
                try:
                    print(f"   📄 Scraping job: {job_url}")
                    job_data = scraper.scrape_job_data(job_url)
                    if job_data:
                        jobs.append(job_data)
                except Exception as e:
                    print(f"   ⚠️  Error scraping job {job_url}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
        # Save jobs
        saved_count = 0
        for idx, job in enumerate(jobs, 1):
            print(f"   📋 Processing job {idx}/{len(jobs)}...")
            
            # Convert job data to dict format using Pydantic methods
            job_dict = {}
            if hasattr(job, 'model_dump'):
                # Use model_dump() for Pydantic v2 (recommended)
                job_dict = job.model_dump()
            elif hasattr(job, 'dict'):
                # Fallback for Pydantic v1
                job_dict = job.dict()
            elif isinstance(job, dict):
                job_dict = job
            else:
                # Fallback: extract attributes manually
                job_dict = {
                    "title": getattr(job, 'title', None),
                    "url": getattr(job, 'url', None),
                    "salary_range": getattr(job, 'salary_range', None),
                    "description": getattr(job, 'description', None),
                    "tags": getattr(job, 'tags', None),
                    "location": getattr(job, 'location', None),
                    "job_type": getattr(job, 'job_type', None),
                }
            
            # Debug: Print job structure for first job
            if idx == 1:
                try:
                    if hasattr(job, 'model_dump_json'):
                        job_json = job.model_dump_json(by_alias=True, indent=2)
                        print(f"   📊 Sample job structure (first 300 chars):\n{job_json[:300]}...")
                    else:
                        print(f"   📊 Job keys: {list(job_dict.keys())}")
                except Exception as e:
                    print(f"   ⚠️  Could not serialize job data: {e}")
            
            # Add company info
            job_dict["company_name"] = company_name
            job_dict["batch"] = batch
            job_dict["company_tagline"] = company_description
            
            if save_job_to_database(job_dict, startup_id):
                saved_count += 1
        
        print(f"   ✅ Scraped and saved {saved_count} jobs for {company_name}")
        return saved_count
        
    except Exception as e:
        print(f"   ❌ Error scraping company {company_url}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def scrape_all_companies(limit: Optional[int] = None) -> int:
    """
    Scrape jobs from all companies on workatastartup.com.
    This is a simplified version - you may need to get the list of companies first.
    """
    print("🚀 Starting to scrape all companies from workatastartup.com...")
    
    # Note: The ycombinator-scraper library may need specific company URLs
    # You might need to first get a list of company URLs from the directory page
    # For now, this is a placeholder that you can extend
    
    total_jobs = 0
    
    # Example: If you have a list of company URLs
    # company_urls = [
    #     "https://www.workatastartup.com/companies/example-inc",
    #     ...
    # ]
    
    print("⚠️  This function needs to be extended with a list of company URLs")
    print("   You can get company URLs by scraping the directory page first")
    
    return total_jobs


def main():
    """
    Main function to run the scraper.
    Usage:
        python scrape_workatastartup_python.py [company_url] [--limit N]
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape jobs from workatastartup.com")
    parser.add_argument("company_url", nargs="?", help="URL of a specific company to scrape")
    parser.add_argument("--limit", type=int, help="Limit number of jobs to scrape per company")
    parser.add_argument("--test", action="store_true", help="Test mode: scrape one company")
    
    args = parser.parse_args()
    
    if args.company_url:
        # Scrape specific company
        scrape_company_jobs(args.company_url, args.limit)
    elif args.test:
        # Test mode: you'll need to provide a test company URL
        print("🧪 Test mode: Please provide a company URL")
        print("   Example: python scrape_workatastartup_python.py https://www.workatastartup.com/companies/example-inc")
    else:
        # Scrape all companies (needs implementation)
        scrape_all_companies(args.limit)


if __name__ == "__main__":
    main()

