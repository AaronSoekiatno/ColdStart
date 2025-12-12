"""
Scrape the workatastartup.com directory to get all company URLs,
then scrape jobs for each company using ycombinator-scraper.
"""
import os
import sys
import re
from typing import List, Optional
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]

# Load environment variables FIRST
# Try .env.local first (Next.js default), then .env
env_loaded = load_dotenv('.env.local') or load_dotenv('.env') or load_dotenv()
if env_loaded:
    print("✅ Environment variables loaded")
else:
    print("⚠️  No .env file found - using system environment variables")

# Set up credentials for ycombinator-scraper library BEFORE importing
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
    # Set empty values to avoid validation error
    if "login_username" not in os.environ:
        os.environ["login_username"] = ""
    if "login_password" not in os.environ:
        os.environ["login_password"] = ""

# Now import the scraper (after credentials are set)
from supabase import create_client, Client
from ycombinator_scraper import Scraper  # pyright: ignore[reportMissingImports]
from selenium import webdriver  # pyright: ignore[reportMissingImports]
from selenium.webdriver.common.by import By  # pyright: ignore[reportMissingImports]
from selenium.webdriver.support.ui import WebDriverWait  # pyright: ignore[reportMissingImports]
from selenium.webdriver.support import expected_conditions as EC  # pyright: ignore[reportMissingImports]
from selenium.webdriver.chrome.options import Options  # pyright: ignore[reportMissingImports]
from selenium.webdriver.chrome.service import Service  # pyright: ignore[reportMissingImports]
from webdriver_manager.chrome import ChromeDriverManager  # type: ignore[import-untyped]
import time

# Initialize Supabase client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Debug: Check what we found
print(f"🔍 Debug - Supabase URL found: {'Yes' if supabase_url else 'No'}")
print(f"🔍 Debug - Supabase Key found: {'Yes' if supabase_key else 'No'}")
if supabase_url:
    print(f"   URL: {supabase_url[:30]}...")
if not supabase_key:
    print("   Checking for: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("\n❌ Missing Supabase credentials!")
    print("   Please set one of the following in .env.local:")
    print("   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)")
    print("   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
    print("\n   Current working directory:", os.getcwd())
    print("   Looking for .env files in:", os.path.abspath('.'))
    raise ValueError("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize scraper (now that credentials are set)
scraper = Scraper()


def get_company_urls_from_directory(limit: Optional[int] = None) -> List[dict]:
    """
    Scrape the directory page to get all company URLs with "See all X jobs" links.
    Returns list of dicts with company_url, company_name, batch, and job_count.
    """
    print("🔍 Scraping directory page for company URLs...")
    
    # Setup Selenium
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    try:
        # Navigate to directory page
        url = "https://www.workatastartup.com/companies?demographic=any&hasEquity=any&hasSalary=any&industry=any&interviewProcess=any&jobType=any&layout=list-compact&sortBy=created_desc&tab=any&usVisaNotRequired=any"
        print(f"   📄 Navigating to {url}...")
        driver.get(url)
        time.sleep(3)
        
        # Login if credentials are provided
        email = os.getenv("WORKATASTARTUP_EMAIL")
        password = os.getenv("WORKATASTARTUP_PASSWORD")
        
        if email and password:
            print("   🔐 Attempting to log in...")
            try:
                # Find and click "Log In" link
                login_link = driver.find_element(By.XPATH, "//a[contains(@href, 'authenticate') or contains(text(), 'Log In')]")
                if login_link:
                    login_link.click()
                    time.sleep(2)
                    
                    # Fill in credentials
                    email_field = driver.find_element(By.NAME, "username")
                    password_field = driver.find_element(By.NAME, "password")
                    email_field.send_keys(email)
                    password_field.send_keys(password)
                    
                    # Submit
                    submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")
                    submit_button.click()
                    time.sleep(3)
                    print("   ✅ Logged in")
            except Exception as e:
                print(f"   ⚠️  Login failed or already logged in: {e}")
        
        # Wait for page to fully load
        print("   ⏳ Waiting for page to load...")
        time.sleep(5)
        
        # Scroll to load all content
        print("   📜 Scrolling to load content...")
        last_height = driver.execute_script("return document.body.scrollHeight")
        scroll_attempts = 0
        max_scrolls = 10
        while scroll_attempts < max_scrolls:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                scroll_attempts += 1
                if scroll_attempts >= 3:
                    break
            else:
                scroll_attempts = 0
            last_height = new_height
        
        # Scroll back to top
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(2)
        
        # Debug: Take screenshot and check page content
        try:
            driver.save_screenshot("directory_page_debug.png")
            print("   📸 Screenshot saved: directory_page_debug.png")
        except Exception as e:
            print(f"   ⚠️  Could not save screenshot: {e}")
        
        # Debug: Print page title and URL
        print(f"   📄 Page title: {driver.title}")
        print(f"   📄 Current URL: {driver.current_url}")
        
        # Find all "See all X jobs" links - try multiple strategies
        print("   🔍 Finding company links...")
        company_links = []
        
        # Strategy 1: Find links with "See all" and "jobs" text
        try:
            links = driver.find_elements(By.XPATH, "//a[contains(text(), 'See all') and contains(text(), 'jobs')]")
            print(f"   ✅ Strategy 1: Found {len(links)} links with 'See all' and 'jobs'")
        except Exception as e:
            print(f"   ⚠️  Strategy 1 failed: {e}")
            links = []
        
        # Strategy 2: Find all links containing "jobs" in text
        if not links:
            try:
                links = driver.find_elements(By.XPATH, "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'see all') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'job')]")
                print(f"   ✅ Strategy 2: Found {len(links)} links (case-insensitive)")
            except Exception as e:
                print(f"   ⚠️  Strategy 2 failed: {e}")
        
        # Strategy 3: Find all links to /companies/ URLs
        if not links:
            try:
                all_links = driver.find_elements(By.TAG_NAME, "a")
                company_urls = [link for link in all_links if link.get_attribute("href") and "/companies/" in link.get_attribute("href")]
                print(f"   ✅ Strategy 3: Found {len(company_urls)} links to /companies/")
                # Filter for ones that might be "See all jobs" links
                links = [link for link in company_urls if "job" in link.text.lower() or "see" in link.text.lower()]
                print(f"   ✅ Strategy 3 filtered: {len(links)} links with 'job' or 'see' in text")
            except Exception as e:
                print(f"   ⚠️  Strategy 3 failed: {e}")
        
        # Strategy 4: Find all company cards/items and extract links
        if not links:
            try:
                # Look for company cards or list items
                company_elements = driver.find_elements(By.XPATH, "//*[contains(@class, 'company') or contains(@class, 'card') or contains(@class, 'item')]")
                print(f"   ✅ Strategy 4: Found {len(company_elements)} potential company elements")
                # Extract links from these elements
                for elem in company_elements:
                    try:
                        link = elem.find_element(By.TAG_NAME, "a")
                        if link and "/companies/" in link.get_attribute("href", ""):
                            links.append(link)
                    except:
                        continue
                print(f"   ✅ Strategy 4: Extracted {len(links)} links from company elements")
            except Exception as e:
                print(f"   ⚠️  Strategy 4 failed: {e}")
        
        # Debug: Print first few link texts
        if links:
            print(f"   📋 Sample link texts (first 5):")
            for i, link in enumerate(links[:5], 1):
                try:
                    print(f"      {i}. '{link.text}' -> {link.get_attribute('href')}")
                except:
                    print(f"      {i}. (could not get text/href)")
        else:
            print("   ⚠️  No links found with any strategy")
            # Debug: Print all links on page
            try:
                all_links = driver.find_elements(By.TAG_NAME, "a")
                print(f"   🔍 Total links on page: {len(all_links)}")
                print(f"   📋 Sample links (first 10):")
                for i, link in enumerate(all_links[:10], 1):
                    try:
                        href = link.get_attribute("href")
                        text = link.text[:50] if link.text else "(no text)"
                        if href:
                            print(f"      {i}. '{text}' -> {href[:80]}")
                    except:
                        pass
            except Exception as e:
                print(f"   ⚠️  Could not list all links: {e}")
        
        for link in links:
            try:
                href = link.get_attribute("href")
                if not href:
                    continue
                
                text = link.text or ""
                
                # Only process links to company pages
                if '/companies/' not in href:
                    continue
                
                # Extract company URL from href
                company_url = href.split('?')[0]  # Remove query params
                
                # Extract company slug from URL
                url_match = re.search(r'/companies/([^/]+)', company_url)
                if not url_match:
                    continue
                
                slug = url_match.group(1)
                
                # Try to get company name and batch from parent elements
                try:
                    # Try multiple parent selectors
                    parent = None
                    for xpath in [
                        "./ancestor::*[contains(@class, 'company')][1]",
                        "./ancestor::*[contains(@class, 'card')][1]",
                        "./ancestor::*[contains(@class, 'item')][1]",
                        "./ancestor::div[1]",
                        "./ancestor::*[position()<=5]"
                    ]:
                        try:
                            parent = link.find_element(By.XPATH, xpath)
                            if parent:
                                break
                        except:
                            continue
                    
                    parent_text = parent.text if parent else ""
                    
                    # Extract batch (e.g., S24, W22)
                    batch_match = re.search(r'\(([SW]\d{2})\)', parent_text)
                    batch = batch_match.group(1) if batch_match else None
                    
                    # Extract company name from parent text
                    company_name_match = re.search(r'([A-Z][a-zA-Z\s&.]+?)\s*\([SW]\d{2}\)', parent_text)
                    if company_name_match:
                        company_name = company_name_match.group(1).strip()
                    else:
                        # Try to find company name in parent text (any capitalized words)
                        name_match = re.search(r'([A-Z][a-zA-Z\s&.]+)', parent_text.split('\n')[0] if '\n' in parent_text else parent_text)
                        company_name = name_match.group(1).strip() if name_match else None
                except Exception as e:
                    print(f"      ⚠️  Could not extract from parent: {e}")
                    company_name = None
                    batch = None
                
                # Fallback: Generate company name from slug
                if not company_name:
                    company_name = ' '.join(word.capitalize() for word in slug.split('-'))
                
                # Extract job count from link text
                job_count = None
                if text:
                    job_count_match = re.search(r'(\d+)\s*jobs?', text, re.IGNORECASE)
                    if job_count_match:
                        job_count = int(job_count_match.group(1))
                
                # Only add if this looks like a valid company link
                # Skip if it's just the base companies page
                if slug and slug not in ['companies', '']:
                    company_links.append({
                        "company_url": company_url,
                        "company_name": company_name or "Unknown",
                        "batch": batch,
                        "job_count": job_count,
                    })
                    print(f"      ✅ Added: {company_name} ({batch or 'No batch'}) - {company_url}")
                    
            except Exception as e:
                print(f"      ⚠️  Error processing link: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if limit:
            company_links = company_links[:limit]
        
        print(f"   ✅ Found {len(company_links)} companies with job listings")
        return company_links
        
    finally:
        driver.quit()


def find_or_create_startup(company_name: str, batch: Optional[str] = None, description: Optional[str] = None) -> Optional[str]:
    """Find existing startup or create new one. Returns startup ID."""
    import uuid
    
    # Try exact match
    result = supabase.table("startups").select("id").eq("name", company_name).limit(1).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]["id"]
    
    # Try case-insensitive match
    result = supabase.table("startups").select("id, name").ilike("name", f"%{company_name}%").limit(5).execute()
    
    if result.data:
        for startup in result.data:
            if startup["name"].lower() == company_name.lower():
                return startup["id"]
    
    # Create new
    new_id = str(uuid.uuid4())
    startup_data = {"id": new_id, "name": company_name, "needs_enrichment": True}
    
    if batch:
        startup_data["tags"] = [batch]
    if description:
        startup_data["description"] = description
    
    try:
        supabase.table("startups").insert(startup_data).execute()
        return new_id
    except Exception as e:
        print(f"   ⚠️  Error creating startup: {e}")
        return None


def scrape_and_save_company_jobs(company_info: dict, limit: Optional[int] = None) -> int:
    """Scrape jobs for a company and save to database."""
    company_url = company_info["company_url"]
    company_name = company_info["company_name"]
    batch = company_info.get("batch")
    
    print(f"\n📋 Scraping: {company_name} ({batch or 'No batch'})")
    print(f"   URL: {company_url}")
    
    try:
        # Scrape company data using ycombinator-scraper library
        print(f"   🔍 Scraping company data from library...")
        company_data = scraper.scrape_company_data(company_url)
        
        if not company_data:
            print(f"   ⚠️  No data found")
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
        
        # Debug: Print what we got (first few attributes)
        print(f"   📊 Company data type: {type(company_data)}")
        attrs = [attr for attr in dir(company_data) if not attr.startswith('_')]
        print(f"   📊 Available attributes: {attrs[:15]}")
        
        # Get company info - library uses these exact field names:
        # company_name, company_description, company_job_links, job_data
        company_description = company_data.company_description if hasattr(company_data, 'company_description') else None

        # Get company name
        if hasattr(company_data, 'company_name') and company_data.company_name:
            company_name = company_data.company_name
        
        # Extract batch from tags if available
        if hasattr(company_data, 'company_tags') and company_data.company_tags:
            for tag in company_data.company_tags:
                if isinstance(tag, str) and (tag.startswith('S') or tag.startswith('W')):
                    batch = tag
                    break
        
        # Find or create startup
        startup_id = find_or_create_startup(company_name, batch, company_description)
        
        # Get jobs - the library uses these exact field names:
        # - job_data: List[JobData] (full job objects)
        # - company_job_links: List[str] (job URLs)
        jobs = []
        job_links = []

        # Check for job_data (full job objects)
        if hasattr(company_data, 'job_data') and company_data.job_data:
            jobs = company_data.job_data if isinstance(company_data.job_data, list) else [company_data.job_data]
            print(f"   ✅ Found {len(jobs)} jobs in job_data")

        # Check for company_job_links (URLs to scrape individually)
        if hasattr(company_data, 'company_job_links') and company_data.company_job_links:
            job_links = company_data.company_job_links if isinstance(company_data.company_job_links, list) else [company_data.company_job_links]
            print(f"   ✅ Found {len(job_links)} job links in company_job_links")

            # Debug: Print first few job links
            if job_links:
                print(f"   📋 Sample job links (first 3): {job_links[:3]}")
        
        # Scrape individual job URLs if we have links but no full job data
        # Note: The library may have already scraped jobs, but job_data might be empty
        # So we should check if we have job_links and scrape them
        if job_links:
            if not jobs:  # Only scrape if we don't have full job data
                print(f"   📄 Scraping {len(job_links)} individual job URLs...")
                if limit:
                    job_links = job_links[:limit]
                
                for idx, job_url in enumerate(job_links, 1):
                    try:
                        print(f"   📄 [{idx}/{len(job_links)}] Scraping job: {job_url}")
                        job_data = scraper.scrape_job_data(job_url)
                        if job_data:
                            jobs.append(job_data)
                            print(f"      ✅ Successfully scraped job")
                        else:
                            print(f"      ⚠️  No data returned for job")
                    except Exception as e:
                        print(f"      ⚠️  Error scraping job {job_url}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
            else:
                print(f"   ℹ️  Skipping job link scraping - already have {len(jobs)} jobs from job_data")
        
        if limit and jobs:
            jobs = jobs[:limit]
        
        saved_count = 0
        for idx, job in enumerate(jobs, 1):
            print(f"   📋 Processing job {idx}/{len(jobs)}...")

            # Convert Pydantic model to dict
            # Library JobData fields: job_url, job_title, job_salary_range, job_tags, job_description
            if hasattr(job, 'model_dump'):
                job_dict = job.model_dump()
            elif hasattr(job, 'dict'):
                job_dict = job.dict()
            elif isinstance(job, dict):
                job_dict = job
            else:
                # Manual extraction using exact library field names
                job_dict = {
                    "job_title": getattr(job, 'job_title', None),
                    "job_url": getattr(job, 'job_url', None),
                    "job_salary_range": getattr(job, 'job_salary_range', None),
                    "job_description": getattr(job, 'job_description', None),
                    "job_tags": getattr(job, 'job_tags', None),
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

            # Extract fields from library's exact field names
            # Library fields: job_title, job_url, job_salary_range, job_tags, job_description
            job_title = job_dict.get("job_title") or "Unknown"
            job_url = job_dict.get("job_url")
            salary_range = job_dict.get("job_salary_range")
            description = job_dict.get("job_description")
            tags = job_dict.get("job_tags")  # Nested list: [[tag1, tag2, ...]]

            # Parse tags to extract location, job_type, visa_requirements, experience_level, and skills
            # Note: jobTags is a nested list: [[location, job_type, visa, experience, ...]]
            location = None
            job_type = None
            visa_requirements = None
            experience_level = None
            skills = None
            tag_strings = []

            if tags:
                # Handle nested list structure: [[tag1, tag2, ...]] or [tag1, tag2, ...]
                if isinstance(tags, list):
                    # Flatten nested lists
                    for item in tags:
                        if isinstance(item, list):
                            tag_strings.extend([str(t) for t in item if t])
                        else:
                            tag_strings.append(str(item))
                elif isinstance(tags, str):
                    tag_strings = [tags]

                # Extract location (usually first item, contains ',' or '/')
                for tag in tag_strings:
                    tag_clean = tag.strip()
                    if tag_clean and (',' in tag_clean or '/' in tag_clean):
                        # Check if it looks like a location (has city/state/country pattern)
                        if any(indicator in tag_clean for indicator in [',', '/', 'DE', 'US', 'CA', 'NY', 'SF', 'Munich', 'Berlin', 'London', 'Paris']):
                            location = tag_clean
                            break

                # Extract job type (Full-time, Part-time, Contract, Internship, etc.)
                job_type_keywords = ['full-time', 'part-time', 'contract', 'intern', 'internship', 'temporary', 'freelance']
                for tag in tag_strings:
                    tag_lower = tag.strip().lower()
                    if any(keyword in tag_lower for keyword in job_type_keywords):
                        job_type = tag.strip()
                        break

                # Extract visa requirements
                visa_keywords = ['visa', 'citizen', 'sponsor', 'work authorization', 'work permit']
                for tag in tag_strings:
                    tag_lower = tag.strip().lower()
                    if any(keyword in tag_lower for keyword in visa_keywords):
                        visa_requirements = tag.strip()
                        break

                # Extract experience level
                experience_keywords = ['new grad', 'entry', 'junior', 'mid', 'senior', 'lead', 'years', 'experience']
                for tag in tag_strings:
                    tag_lower = tag.strip().lower()
                    if any(keyword in tag_lower for keyword in experience_keywords):
                        experience_level = tag.strip()
                        break

                # Skills: remaining tags that aren't location, job_type, visa, or experience
                # Filter out the ones we've already categorized
                used_tags = {location, job_type, visa_requirements, experience_level}
                skill_tags = [t.strip() for t in tag_strings if t.strip() and t.strip() not in used_tags]
                skills = ", ".join(skill_tags) if skill_tags else None

            # Save to database
            try:
                db_job = {
                    "company_name": company_name,
                    "job_title": job_title,
                    "job_type": job_type,  # Extracted from tags (e.g., "Full-time", "Internship")
                    "location": location,  # Extracted from tags (e.g., "Munich, BY, DE")
                    "job_url": job_url,
                    "company_batch": batch,
                    "company_tagline": company_description,
                    "salary_range": salary_range,
                    "visa_requirements": visa_requirements,  # Extracted from tags (e.g., "US citizen/visa only")
                    "experience_level": experience_level,  # Extracted from tags (e.g., "Any (new grads ok)")
                    "skills": skills,  # Remaining tags as comma-separated string
                    "full_description": description,
                    "startup_id": startup_id,
                }

                # Remove None values
                db_job = {k: v for k, v in db_job.items() if v is not None}

                # Check if exists - use company_name, job_title, and job_url for uniqueness
                check = supabase.table("jobs").select("id").eq("company_name", company_name).eq("job_title", db_job["job_title"]).limit(1).execute()

                # Also check by URL if available
                if db_job.get("job_url"):
                    check_by_url = supabase.table("jobs").select("id").eq("job_url", db_job["job_url"]).limit(1).execute()
                    if check_by_url.data:
                        check = check_by_url

                if not check.data:
                    supabase.table("jobs").insert(db_job).execute()
                    saved_count += 1
                    print(f"   ✅ Saved: {db_job['job_title']}")
                else:
                    print(f"   ⏭️  Skipped (exists): {db_job['job_title']}")
            except Exception as e:
                print(f"   ❌ Error saving job: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"   ✅ Total: {saved_count} new jobs saved from {len(jobs)} jobs found")
        return saved_count
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape jobs from workatastartup.com directory")
    parser.add_argument("--limit", type=int, help="Limit number of companies to process")
    parser.add_argument("--test", action="store_true", help="Test mode: process 1 company")
    
    args = parser.parse_args()
    
    limit = 1 if args.test else args.limit
    
    print("🚀 Starting workatastartup.com scraper...")
    
    # Get company URLs from directory
    companies = get_company_urls_from_directory(limit)
    
    if not companies:
        print("⚠️  No companies found")
        return
    
    # Scrape jobs for each company
    total_jobs = 0
    for company in companies:
        jobs_saved = scrape_and_save_company_jobs(company)
        total_jobs += jobs_saved
    
    print(f"\n✅ Complete! Scraped {total_jobs} total jobs from {len(companies)} companies")


if __name__ == "__main__":
    main()

