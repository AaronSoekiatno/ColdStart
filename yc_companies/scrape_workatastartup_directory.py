"""
Scrape the workatastartup.com directory to get all company URLs,
then scrape jobs for each company using ycombinator-scraper.
"""
import os
import sys
import re
import requests  # pyright: ignore[reportMissingModuleSource]
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


def company_name_to_yc_slug(company_name: str) -> str:
    """
    Convert company name to YC URL slug format.
    Examples:
    - "Hey Telo" -> "hey-telo"
    - "Bluma" -> "bluma"
    - "Uplift AI" -> "uplift-ai"
    """
    if not company_name:
        return ""
    
    # Convert to lowercase
    slug = company_name.lower().strip()
    
    # Replace spaces and underscores with hyphens
    slug = re.sub(r'[\s_]+', '-', slug)
    
    # Remove special characters, keep only alphanumeric and hyphens
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    
    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    
    return slug


def validate_yc_url(yc_url: str, timeout: int = 5) -> bool:
    """
    Validate that a YC URL actually exists by making a HEAD request.
    Returns True if URL exists (status 200), False otherwise.
    
    Uses HEAD request first (faster), falls back to GET if HEAD is not allowed.
    """
    if not yc_url:
        return False
    
    # Basic URL format validation
    if not yc_url.startswith('https://www.ycombinator.com/companies/'):
        return False
    
    try:
        # Use HEAD request to check if URL exists without downloading content
        response = requests.head(
            yc_url,
            timeout=timeout,
            allow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        )
        # Accept 200 (OK) or 301/302 (redirects to valid page)
        if response.status_code in [200, 301, 302]:
            return True
        
        # If HEAD returns 405 (Method Not Allowed), try GET request
        if response.status_code == 405:
            response = requests.get(
                yc_url,
                timeout=timeout,
                allow_redirects=True,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            return response.status_code in [200, 301, 302]
        
        return False
    except requests.exceptions.Timeout:
        print(f"      ⚠️  Timeout validating YC URL: {yc_url}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"      ⚠️  Error validating YC URL {yc_url}: {e}")
        return False


def get_or_construct_yc_link(company_name: str, company_url: Optional[str] = None) -> Optional[str]:
    """
    Get or construct YC link for a company.
    
    First tries to extract from company_url if it's a YC URL.
    Otherwise, constructs from company name and validates it exists.
    
    Returns validated YC link or None if not found/valid.
    """
    # If company_url is already a YC link, use it
    if company_url and 'ycombinator.com/companies/' in company_url:
        yc_url = company_url.split('?')[0]  # Remove query params
        if validate_yc_url(yc_url):
            print(f"      ✅ Found valid YC link from company URL: {yc_url}")
            return yc_url
        else:
            print(f"      ⚠️  Company URL looks like YC link but validation failed: {yc_url}")
    
    # Construct YC link from company name
    slug = company_name_to_yc_slug(company_name)
    if not slug:
        print(f"      ⚠️  Could not generate slug from company name: {company_name}")
        return None
    
    yc_url = f"https://www.ycombinator.com/companies/{slug}"
    
    # Validate the constructed URL
    print(f"      🔍 Validating constructed YC URL: {yc_url}")
    if validate_yc_url(yc_url):
        print(f"      ✅ Validated YC link: {yc_url}")
        return yc_url
    else:
        print(f"      ⚠️  Constructed YC URL does not exist: {yc_url}")
        # Try alternative slug variations (e.g., remove common suffixes)
        alternatives = [
            slug.replace('-ai', '').strip('-'),
            slug.replace('-tech', '').strip('-'),
            slug.replace('-inc', '').strip('-'),
        ]
        for alt_slug in alternatives:
            if alt_slug and alt_slug != slug:
                alt_url = f"https://www.ycombinator.com/companies/{alt_slug}"
                print(f"      🔍 Trying alternative: {alt_url}")
                if validate_yc_url(alt_url):
                    print(f"      ✅ Found valid alternative YC link: {alt_url}")
                    return alt_url
        
        return None


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
                
                # PRIMARY: Generate company name from slug (most reliable)
                # Convert slug to readable name (e.g., "hey-telo" -> "Hey Telo", "yondu" -> "Yondu")
                company_name = ' '.join(word.capitalize() for word in slug.split('-'))
                
                # Try to get batch from parent elements (company name from slug is already set)
                batch = None
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
                    
                    if parent:
                        parent_text = parent.text if parent else ""
                        
                        # Extract batch (e.g., S24, W22)
                        batch_match = re.search(r'\(([SW]\d{2})\)', parent_text)
                        if batch_match:
                            batch = batch_match.group(1)
                        
                        # Try to improve company name from parent if we find a better match
                        # Look for company name pattern before "See all" or batch info
                        improved_name_match = re.search(r'^([A-Z][a-zA-Z0-9\s&.\-]+?)(?:\s+\([SW]\d{2}\)|\s+See\s+all|$)', parent_text, re.MULTILINE)
                        if improved_name_match:
                            improved_name = improved_name_match.group(1).strip()
                            # Only use if it's not "See all" or similar generic text
                            if improved_name and improved_name.lower() not in ['see all', 'seeall', 'view', 'jobs'] and len(improved_name) > 2:
                                company_name = improved_name
                except Exception as e:
                    # Silently continue - we already have company_name from slug
                    pass
                
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


def classify_text_section(text: str) -> Optional[str]:
    """
    Classify a block of text to determine what section it belongs to.
    Uses heuristics and keyword matching since YC job descriptions have no standard structure.
    Returns: 'requirements', 'benefits', 'interview_process', 'company_about', 'skills', or None
    """
    if not text or len(text.strip()) < 10:
        return None
    
    text_lower = text.lower()
    text_length = len(text)
    
    # Keywords that indicate different sections
    requirements_keywords = [
        'required', 'requirement', 'must have', 'need', 'looking for', 'qualifications',
        'experience with', 'proficient in', 'familiar with', 'strong background',
        'what we\'re looking for', 'what you\'ll need', 'you should have',
        'technical skills', 'experience in', 'years of experience'
    ]
    
    benefits_keywords = [
        'benefits', 'compensation', 'salary', 'equity', 'stock options', 'health insurance',
        'dental', 'vision', '401k', 'pto', 'vacation', 'remote', 'flexible',
        'what we offer', 'perks', 'wellness', 'gym', 'lunch', 'snacks',
        'unlimited pto', 'healthcare', 'insurance', 'retirement'
    ]
    
    interview_keywords = [
        'interview', 'process', 'hiring', 'apply', 'application', 'recruiting',
        'phone screen', 'technical interview', 'onsite', 'virtual', 'round',
        'conversation', 'meeting', 'discussion', 'next steps', 'hiring process',
        'application process', 'how to apply', 'what to expect', 'interview with',
        'conversation with', 'paid trial', 'trial period', 'interview conversation'
    ]
    
    company_keywords = [
        'about', 'we\'re', 'we are', 'building', 'mission', 'vision', 'values',
        'company', 'team', 'culture', 'founded', 'startup', 'yc', 'y combinator'
    ]
    
    skills_keywords = [
        'skills', 'technologies', 'tech stack', 'stack', 'tools', 'languages',
        'frameworks', 'libraries', 'platforms', 'proficient', 'experience with'
    ]
    
    # Count keyword matches
    requirements_score = sum(1 for kw in requirements_keywords if kw in text_lower)
    benefits_score = sum(1 for kw in benefits_keywords if kw in text_lower)
    interview_score = sum(1 for kw in interview_keywords if kw in text_lower)
    company_score = sum(1 for kw in company_keywords if kw in text_lower)
    skills_score = sum(1 for kw in skills_keywords if kw in text_lower)
    
    # Additional heuristics
    # Requirements often have bullet points or lists
    if text.count('\n') > 3 or text.count('•') > 0 or text.count('-') > 2:
        requirements_score += 1
    
    # Benefits often mention money, time off, or perks
    if re.search(r'\$[\d,]+|salary|equity|pto|vacation|insurance', text_lower):
        benefits_score += 1
    
    # Interview process often mentions steps, stages, or specific interview types
    if re.search(r'(step|stage|round|conversation|interview|phone screen|technical|onsite|virtual|trial)', text_lower):
        interview_score += 1
    
    # Strong indicators of interview process
    if re.search(r'(interview with|conversation with|paid trial|trial period|hiring process)', text_lower):
        interview_score += 2
    
    # Company about often starts with "At [Company]" or "We're"
    if re.match(r'^(at\s+[a-z]|we\'re|we are)', text_lower):
        company_score += 2
    
    # Skills often have comma-separated lists or technology names
    if re.search(r'\b(python|javascript|react|typescript|node|aws|docker|kubernetes)\b', text_lower, re.IGNORECASE):
        skills_score += 1
    
    # Return the section with highest score, but only if score is significant
    scores = {
        'requirements': requirements_score,
        'benefits': benefits_score,
        'interview_process': interview_score,
        'company_about': company_score,
        'skills': skills_score
    }
    
    max_score = max(scores.values())
    if max_score >= 2:  # Require at least 2 keyword matches
        return max(scores, key=scores.get)
    
    return None


def extract_full_job_description_with_selenium(job_url: str, driver) -> Optional[str]:
    """
    Extract the complete job description by parsing HTML directly with Selenium.
    This ensures we get ALL content including Interview Process sections that the library might miss.
    Uses the authenticated driver session.
    """
    try:
        from bs4 import BeautifulSoup  # pyright: ignore[reportMissingModuleSource]
        
        print(f"      🌐 Fetching full page content with Selenium...")
        driver.get(job_url)
        time.sleep(2)  # Wait for page to load
        
        # Get page source and parse with BeautifulSoup
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Find the job description container
        # Common patterns on workatastartup.com job pages
        description = None
        
        # Strategy 1: Look for main content area
        main_content = soup.find('main') or soup.find('article')
        if main_content:
            # Remove navigation, footer, header elements
            for tag in main_content(['nav', 'footer', 'header', 'script', 'style']):
                tag.decompose()
            
            # Get all text with proper line breaks
            description = main_content.get_text(separator='\n', strip=True)
            
            # Clean up excessive whitespace but preserve structure
            lines = [line.strip() for line in description.split('\n') if line.strip()]
            description = '\n'.join(lines)
            
            if description and len(description) > 500:
                print(f"      ✅ Extracted {len(description)} characters from main content")
                return description
        
        # Strategy 2: Look for specific job description containers
        selectors = [
            'div[class*="description"]',
            'div[class*="job-description"]',
            'div[class*="content"]',
            '[data-testid*="description"]',
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            for element in elements:
                text = element.get_text(separator='\n', strip=True)
                if text and len(text) > 500:
                    description = text
                    print(f"      ✅ Extracted {len(description)} characters using selector: {selector}")
                    return description
        
        # Strategy 3: Get body text (last resort)
        if not description:
            body = soup.find('body')
            if body:
                # Remove script, style, nav, footer, header
                for tag in body(['script', 'style', 'nav', 'footer', 'header']):
                    tag.decompose()
                description = body.get_text(separator='\n', strip=True)
                lines = [line.strip() for line in description.split('\n') if line.strip()]
                description = '\n'.join(lines)
                if description and len(description) > 500:
                    print(f"      ✅ Extracted {len(description)} characters from body")
                    return description
        
        print(f"      ⚠️  Could not extract description from page")
        return None
        
    except Exception as e:
        print(f"      ❌ Error extracting full description: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_inline_interview_process(text: str) -> Optional[str]:
    """
    Extract interview process mentioned inline in any section.
    Looks for patterns like "Interview Conversation with X", "Paid trial", etc.
    """
    if not text:
        return None
    
    # Look for interview process patterns - more comprehensive
    interview_patterns = [
        # Specific interview mentions with context
        r'Interview\s+Conversation\s+with\s+[A-Z][^\n]+(?:\n[^\n]+){0,3}',
        r'Interview\s+[^\n]+\s+with\s+[A-Z][^\n]+(?:\n[^\n]+){0,3}',
        r'Conversation\s+with\s+[A-Z][^\n]+(?:\n[^\n]+){0,3}',
        r'Business\s+Case\s+Conversation[^\n]+(?:\n[^\n]+){0,3}',
        r'[A-Z][a-z]+\s+Conversation\s+with\s+[A-Z][^\n]+(?:\n[^\n]+){0,3}',
        # Trial mentions
        r'Paid\s+trial[^\n]*(?:\n[^\n]+){0,2}',
        r'Trial\s+period[^\n]*(?:\n[^\n]+){0,2}',
        # Process mentions
        r'Interview\s+Process[^\n]+(?:\n[^\n]+){0,10}',
        r'Hiring\s+Process[^\n]+(?:\n[^\n]+){0,10}',
        r'Application\s+Process[^\n]+(?:\n[^\n]+){0,10}',
        # Step-by-step patterns
        r'(?:Step\s+\d+|Round\s+\d+|Stage\s+\d+)[^\n]+(?:\n[^\n]+){0,2}',
    ]
    
    interview_parts = []
    
    for pattern in interview_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
        if matches:
            for match in matches:
                if isinstance(match, tuple):
                    match = ' '.join(match)
                match = match.strip()
                if match and len(match) > 10 and len(match) < 500:  # Reasonable length
                    interview_parts.append(match)
    
    # Also look for structured interview steps (numbered or bulleted)
    lines = text.split('\n')
    in_interview_section = False
    interview_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        # Check if this line starts an interview section
        if re.search(r'^(Interview|Hiring Process|Application Process|How to Apply|Next Steps|Interview Process)', line, re.IGNORECASE):
            in_interview_section = True
            interview_lines.append(line)
            continue
        
        # If we're in an interview section, collect lines until we hit another section
        if in_interview_section:
            # Stop if we hit a new major section
            if re.search(r'^(About|Requirements|Benefits|What|How|Why|Technology|Compensation|Skills|Why join)', line, re.IGNORECASE):
                break
            interview_lines.append(line)
            # Stop after collecting reasonable amount (15 lines max)
            if len([l for l in interview_lines if l.strip()]) > 15:
                break
    
    if interview_lines:
        interview_text = '\n'.join(interview_lines).strip()
        if interview_text and len(interview_text) > 10:
            interview_parts.append(interview_text)
    
    # Look for interview mentions in the middle of paragraphs
    # Common pattern: "Interview Conversation with [Name] (Role)" followed by description
    conversation_pattern = r'(?:Interview|Conversation|Meeting)\s+(?:Conversation\s+)?with\s+[A-Z][a-zA-Z\s]+(?:\([^)]+\))?[^\n]*(?:\n[^\n]+){0,5}'
    conversation_matches = re.findall(conversation_pattern, text, re.IGNORECASE | re.MULTILINE)
    if conversation_matches:
        for match in conversation_matches:
            match = match.strip()
            if match and len(match) > 15 and len(match) < 500:
                interview_parts.append(match)
    
    if interview_parts:
        # Remove duplicates while preserving order
        seen = set()
        unique_parts = []
        for part in interview_parts:
            part_lower = part.lower().strip()
            # Skip if it's too short or seems like a false positive
            if len(part_lower) < 15:
                continue
            if part_lower not in seen:
                seen.add(part_lower)
                unique_parts.append(part)
        
        if unique_parts:
            return '\n\n'.join(unique_parts)
    
    # If no interview process found, return None (this is valid - not all jobs have interview info)
    return None


def extract_inline_benefits(text: str) -> Optional[str]:
    """
    Extract compensation/benefits mentioned inline in any section.
    Looks for patterns like "$30/hr", "equity", "health insurance", etc.
    """
    if not text:
        return None
    
    benefits_parts = []
    
    # Look for compensation patterns
    comp_patterns = [
        r'\$[\d,]+(?:\s*-\s*\$[\d,]+)?\s*/?\s*(?:hr|hour|month|year|annually|EUR|USD)',
        r'(?:starts? at|up to|range:?|compensation:?)\s*\$?[\d,]+',
        r'equity|stock\s+options|options',
        r'(?:health|dental|vision)\s+insurance',
        r'(?:unlimited\s+)?pto|vacation|sick\s+days',
        r'remote|flexible\s+work|work\s+from\s+home|hybrid',
        r'gym|wellness|lunch|snacks|perks',
    ]
    
    for pattern in comp_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            # Clean up matches
            for match in matches:
                if isinstance(match, tuple):
                    match = ' '.join(match)
                match = match.strip()
                if match and len(match) < 100:  # Reasonable length
                    benefits_parts.append(match)
    
    if benefits_parts:
        # Remove duplicates while preserving order
        seen = set()
        unique_parts = []
        for part in benefits_parts:
            part_lower = part.lower()
            if part_lower not in seen:
                seen.add(part_lower)
                unique_parts.append(part)
        return '; '.join(unique_parts)
    
    return None


def parse_job_description(description: str) -> dict:
    """
    Parse job description text to extract structured sections:
    - requirements
    - benefits
    - interview_process
    - company_about
    - skills (from "Skills:" line or Technology section)
    """
    sections = {
        "requirements": None,
        "benefits": None,
        "interview_process": None,
        "company_about": None,
        "skills": None,
    }
    
    if not description:
        return sections
    
    # Strategy 1: Try to find explicit section headers (most reliable)
    # Strategy 2: If no headers, use content classification (fallback)
    
    lines = description.split('\n')
    current_section = None
    current_section_text = []
    found_explicit_headers = False
    
    # First pass: Look for explicit section headers
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        # Check for section headers
        line_lower = line.lower()
        
        # If we find any explicit header, mark that we have structured content
        if re.match(r'^(Requirements|Benefits|Interview Process|About\s+[A-Z]|Skills:|Technology|Stack)', line, re.IGNORECASE):
            found_explicit_headers = True
        
        # Requirements section - multiple variations
        if re.match(r'^Requirements$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "requirements"
            current_section_text = []
            continue
        
        # "What You'll Do" / "What You'll Be Doing" → requirements (responsibilities)
        elif re.match(r'^(What You\'ll Do|What You\'ll Be Doing|What You Will Do|Responsibilities|Key Responsibilities|What You\'ll Work On)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "requirements"
            current_section_text = []
            continue
        
        # "What We're Looking For" / "What We Need" → requirements (qualifications)
        elif re.match(r'^(What We\'re Looking For|What We Need|Qualifications|What We Want|What We\'re Seeking)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "requirements"
            current_section_text = []
            continue
        
        # "About the role" → often contains requirements/role description
        elif re.match(r'^(About the role|About The Role|The Role|Role Overview|About This Role)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "requirements"  # Often contains what the role entails
            current_section_text = []
            continue
        
        # Benefits section - multiple variations
        elif re.match(r'^(Benefits|What we offer|Compensation|What we provide|Perks|What You\'ll Get)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "benefits"
            current_section_text = []
            continue
        
        # Interview Process section - multiple variations
        elif re.match(r'^(Interview Process|Interview|Hiring Process|Application Process|How to Apply|Next Steps|What to Expect)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "interview_process"
            current_section_text = []
            continue
        
        # Company About section (usually "About [Company Name]")
        elif re.match(r'^About\s+[A-Z]', line, re.IGNORECASE) and not re.match(r'About the role', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "company_about"
            current_section_text = []
            continue
        
        # Skills section (usually "Skills:" followed by comma-separated list)
        elif re.match(r'^Skills:', line, re.IGNORECASE):
            # Extract skills from this line
            skills_text = line.replace('Skills:', '').strip()
            
            # Check if the skills text itself contains company description (e.g., "AWS)At Hey Telo")
            # Split on patterns that indicate start of company description
            if re.search(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, re.IGNORECASE):
                # Split at the company description start
                parts = re.split(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, flags=re.IGNORECASE, maxsplit=1)
                if parts:
                    skills_text = parts[0].rstrip(')').strip()
            
            # Look ahead for continuation (skills often span multiple lines)
            j = i + 1
            while j < len(lines) and j < i + 5:  # Check next 4 lines max
                next_line = lines[j].strip()
                if not next_line:
                    j += 1
                    continue
                
                # Stop if we hit a new section header
                if re.match(r'^(About|Requirements|Benefits|Interview|What|How|Why|Technology|Compensation)', next_line, re.IGNORECASE):
                    break
                
                # Stop if we hit company description (usually starts with "At [Company]" or "We're")
                if re.match(r'^(At\s+[A-Z]|We\'re|We are|The company|If you)', next_line, re.IGNORECASE):
                    break
                
                # Stop if line is too long (likely description text, not a skill)
                if len(next_line) > 100:
                    break
                
                # Check if line contains company description pattern
                if re.search(r'(At\s+[A-Z]|We\'re|We are|building|looking for)', next_line, re.IGNORECASE):
                    break
                
                # Continue if line contains commas (likely part of skills list) or is short (likely a skill name)
                if next_line and (',' in next_line or len(next_line) < 50):
                    # Check if this line itself contains company description
                    if not re.search(r'(At\s+[A-Z]|We\'re|We are)', next_line, re.IGNORECASE):
                        skills_text += ', ' + next_line
                        j += 1
                    else:
                        break
                elif next_line and len(next_line) < 30:  # Short line, likely a skill
                    skills_text += ', ' + next_line
                    j += 1
                else:
                    break
            
            sections["skills"] = skills_text.strip()
            # Don't set current_section, skills is a one-off extraction
            continue
        
        # Technology/Stack section (might contain skills)
        elif re.match(r'^(Technology|Stack|Our stack|Tech stack)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "technology"
            current_section_text = []
            continue
        
        # "About the role" or "The role" - skip, this is usually part of general description
        elif re.match(r'^(About the role|The role)$', line, re.IGNORECASE):
            # Don't start a new section, just continue accumulating if we're in one
            if current_section:
                current_section_text.append(line)
            continue
        
        # Interview-related headers that might not be exactly "Interview Process"
        elif re.match(r'^(Interview|Hiring Process|Application Process|How to Apply|Next Steps)$', line, re.IGNORECASE):
            if current_section and current_section_text:
                sections[current_section] = '\n'.join(current_section_text).strip()
            current_section = "interview_process"
            current_section_text = []
            continue
        
        # If we're in a section, accumulate text
        if current_section:
            # Skip if this line looks like a new section header we haven't caught
            # BUT: Don't skip if we're in interview_process section and this might be part of the process
            if current_section == "interview_process":
                # For interview process, be more lenient - only skip if it's clearly a new major section
                if re.match(r'^(About\s+[A-Z]|Requirements|Benefits|Compensation|Skills|Technology|What You|How we|Why join)', line, re.IGNORECASE) and not current_section_text:
                    continue
                # Always accumulate lines in interview_process section (they're usually steps)
                current_section_text.append(line)
            else:
                # For other sections, use stricter filtering
                if re.match(r'^(About|Requirements|Benefits|Interview|What You|How we|Why|Preferred|Technology)', line, re.IGNORECASE) and not current_section_text:
                    continue
                current_section_text.append(line)
        elif not current_section:
            # Before any section, this might be company about or general description
            # We'll capture it as company_about if it's substantial
            if len(line) > 20 and not current_section_text:
                current_section = "company_about"
                current_section_text = [line]
    
    # Save the last section
    if current_section and current_section_text:
        sections[current_section] = '\n'.join(current_section_text).strip()
    
    # If we found skills in Technology section, extract them
    if sections.get("technology") and not sections.get("skills"):
        tech_text = sections["technology"]
        # Try to extract comma-separated or bullet-pointed technologies
        tech_list = []
        for part in tech_text.split(','):
            part = part.strip()
            if part and len(part) < 50:  # Reasonable skill name length
                tech_list.append(part)
        if tech_list:
            sections["skills"] = ', '.join(tech_list)
    
    # Check if we found any structured sections
    found_structured = any(sections.values())
    
    if not found_structured:
        # No explicit headers found, use content-based classification
        return parse_with_classification(description)
    
    return sections


def parse_with_classification(description: str) -> dict:
    """
    Parse description using content-based classification when no explicit headers exist.
    Splits text into paragraphs and classifies each based on keywords and heuristics.
    """
    sections = {
        "requirements": None,
        "benefits": None,
        "interview_process": None,
        "company_about": None,
        "skills": None,
    }
    
    if not description:
        return sections
    
    # Split into paragraphs (double newlines or long single lines)
    paragraphs = []
    current_para = []
    
    lines = description.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            if current_para:
                paragraphs.append('\n'.join(current_para))
                current_para = []
            continue
        
        current_para.append(line)
        
        # If line is very long, it might be a complete paragraph
        if len(line) > 200:
            paragraphs.append('\n'.join(current_para))
            current_para = []
    
    if current_para:
        paragraphs.append('\n'.join(current_para))
    
    # Classify each paragraph
    classified_paragraphs = {
        "requirements": [],
        "benefits": [],
        "interview_process": [],
        "company_about": [],
        "skills": [],
    }
    
    for para in paragraphs:
        if len(para.strip()) < 20:  # Skip very short paragraphs
            continue
        
        section_type = classify_text_section(para)
        if section_type:
            classified_paragraphs[section_type].append(para)
    
    # Combine paragraphs for each section
    for section_type, paras in classified_paragraphs.items():
        if paras:
            sections[section_type] = '\n\n'.join(paras)
    
    # Special handling for skills - try to extract from "Skills:" if present
    if not sections["skills"]:
        skills_match = re.search(r'Skills:\s*([^\n]+(?:\n[^\n]+){0,5})', description, re.IGNORECASE)
        if skills_match:
            skills_text = skills_match.group(1).strip()
            # Clean up - remove company description if present
            if re.search(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, re.IGNORECASE):
                parts = re.split(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, flags=re.IGNORECASE, maxsplit=1)
                if parts:
                    skills_text = parts[0].rstrip(')').strip()
            sections["skills"] = skills_text
    
    return sections


def parse_with_classification(description: str) -> dict:
    """
    Parse description using content-based classification when no explicit headers exist.
    Splits text into paragraphs and classifies each based on keywords and heuristics.
    """
    sections = {
        "requirements": None,
        "benefits": None,
        "interview_process": None,
        "company_about": None,
        "skills": None,
    }
    
    if not description:
        return sections
    
    # Split into paragraphs (double newlines or long single lines)
    paragraphs = []
    current_para = []
    
    lines = description.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            if current_para:
                paragraphs.append('\n'.join(current_para))
                current_para = []
            continue
        
        current_para.append(line)
        
        # If line is very long, it might be a complete paragraph
        if len(line) > 200:
            paragraphs.append('\n'.join(current_para))
            current_para = []
    
    if current_para:
        paragraphs.append('\n'.join(current_para))
    
    # Classify each paragraph
    classified_paragraphs = {
        "requirements": [],
        "benefits": [],
        "interview_process": [],
        "company_about": [],
        "skills": [],
    }
    
    for para in paragraphs:
        if len(para.strip()) < 20:  # Skip very short paragraphs
            continue
        
        section_type = classify_text_section(para)
        if section_type:
            classified_paragraphs[section_type].append(para)
    
    # Combine paragraphs for each section
    for section_type, paras in classified_paragraphs.items():
        if paras:
            sections[section_type] = '\n\n'.join(paras)
    
    # Special handling for skills - try to extract from "Skills:" if present
    if not sections["skills"]:
        skills_match = re.search(r'Skills:\s*([^\n]+(?:\n[^\n]+){0,5})', description, re.IGNORECASE)
        if skills_match:
            skills_text = skills_match.group(1).strip()
            # Clean up - remove company description if present
            if re.search(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, re.IGNORECASE):
                parts = re.split(r'\)(At\s+[A-Z]|We\'re|We are)', skills_text, flags=re.IGNORECASE, maxsplit=1)
                if parts:
                    skills_text = parts[0].rstrip(')').strip()
            sections["skills"] = skills_text
    
    # Extract inline benefits if not found in dedicated section
    if not sections["benefits"]:
        inline_benefits = extract_inline_benefits(description)
        if inline_benefits:
            sections["benefits"] = inline_benefits
    
    # Extract inline interview process if not found in dedicated section
    if not sections["interview_process"]:
        inline_interview = extract_inline_interview_process(description)
        if inline_interview:
            sections["interview_process"] = inline_interview
    
    return sections


def company_has_jobs(company_name: str) -> bool:
    """Check if company already has jobs in the database."""
    try:
        # Check if any jobs exist for this company
        result = supabase.table("jobs").select("id").eq("company_name", company_name).limit(1).execute()
        if result.data and len(result.data) > 0:
            return True
        
        # Try case-insensitive match
        result = supabase.table("jobs").select("id, company_name").ilike("company_name", f"%{company_name}%").limit(5).execute()
        if result.data:
            for job in result.data:
                if job["company_name"].lower() == company_name.lower():
                    return True
        
        return False
    except Exception as e:
        # If check fails, assume no jobs (safer to scrape than skip)
        print(f"   ⚠️  Error checking for existing jobs: {e}")
        return False


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


def scrape_and_save_company_jobs(company_info: dict, limit: Optional[int] = None, driver=None) -> int:
    """Scrape jobs for a company and save to database.
    
    Args:
        company_info: Dict with company_url, company_name, batch
        limit: Optional limit on number of jobs to scrape
        driver: Optional Selenium driver for full description extraction (if None, creates one)
    """
    company_url = company_info["company_url"]
    company_name = company_info["company_name"]
    batch = company_info.get("batch")
    
    print(f"\n📋 Scraping: {company_name} ({batch or 'No batch'})")
    print(f"   URL: {company_url}")
    
    # Extract or construct YC link for the company
    print(f"   🔗 Extracting YC link for {company_name}...")
    yc_link = get_or_construct_yc_link(company_name, company_url)
    if yc_link:
        print(f"   ✅ YC link: {yc_link}")
    else:
        print(f"   ⚠️  Could not find/validate YC link for {company_name}")
    
    # Create driver if not provided (for full description extraction)
    should_close_driver = False
    if driver is None:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        should_close_driver = True
        
        # Login if credentials are provided
        email = os.getenv("WORKATASTARTUP_EMAIL")
        password = os.getenv("WORKATASTARTUP_PASSWORD")
        
        if email and password:
            try:
                # Navigate to login page
                driver.get("https://www.workatastartup.com/companies")
                time.sleep(2)
                
                # Find and click "Log In" link
                login_link = driver.find_element(By.XPATH, "//a[contains(@href, 'authenticate') or contains(text(), 'Log In')]")
                login_link.click()
                time.sleep(2)
                
                # Fill in credentials
                email_input = driver.find_element(By.NAME, "email")
                password_input = driver.find_element(By.NAME, "password")
                email_input.send_keys(email)
                password_input.send_keys(password)
                
                # Submit
                submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")
                submit_button.click()
                time.sleep(3)
                print(f"   ✅ Authenticated Selenium driver for full description extraction")
            except Exception as e:
                print(f"   ⚠️  Could not authenticate driver: {e}")
    
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
        
        # Always scrape individual job URLs to get full descriptions
        # Note: job_data from company page may be incomplete/truncated
        # Individual job pages have the complete description including interview process
        if job_links:
            print(f"   📄 Scraping {len(job_links)} individual job URLs for full descriptions...")
            if limit:
                job_links = job_links[:limit]

            # Create a map of existing jobs by URL to avoid duplicates
            existing_jobs_by_url = {}
            if jobs:
                for job in jobs:
                    if hasattr(job, 'job_url') and job.job_url:
                        existing_jobs_by_url[job.job_url] = job
                    elif hasattr(job, 'model_dump'):
                        job_dict = job.model_dump()
                        if job_dict.get('job_url'):
                            existing_jobs_by_url[job_dict['job_url']] = job

            for idx, job_url in enumerate(job_links, 1):
                try:
                    # Skip if we already have this job from job_data
                    if job_url in existing_jobs_by_url:
                        print(f"   📄 [{idx}/{len(job_links)}] Job already in job_data, scraping for full description: {job_url}")
                        # Still scrape to get full description, will replace the incomplete one
                    else:
                        print(f"   📄 [{idx}/{len(job_links)}] Scraping job: {job_url}")
                    
                    job_data = scraper.scrape_job_data(job_url)
                    if job_data:
                        # Get description from library
                        library_description = None
                        if hasattr(job_data, 'job_description'):
                            library_description = job_data.job_description
                        elif hasattr(job_data, 'model_dump'):
                            job_dict = job_data.model_dump()
                            library_description = job_dict.get('job_description')
                        
                        # Check if description is missing Interview Process section
                        needs_full_extraction = False
                        if library_description:
                            has_interview = 'Interview Process' in library_description or 'interview process' in library_description.lower()
                            # Check if description ends abruptly (common sign of truncation)
                            ends_abruptly = library_description.strip().endswith('workouts.') or \
                                           library_description.strip().endswith('Compensation') or \
                                           not library_description.strip().endswith('.')
                            
                            print(f"      📊 Library description: {len(library_description)} chars")
                            print(f"         - Has 'Interview Process': {has_interview}")
                            
                            if not has_interview or ends_abruptly:
                                needs_full_extraction = True
                                print(f"         ⚠️  Missing Interview Process or seems truncated - will extract full description")
                        else:
                            needs_full_extraction = True
                            print(f"         ⚠️  No description from library - will extract full description")
                        
                        # Extract full description if needed
                        if needs_full_extraction and driver:
                            full_description = extract_full_job_description_with_selenium(job_url, driver)
                            if full_description:
                                # Update job_data with full description
                                if hasattr(job_data, 'job_description'):
                                    job_data.job_description = full_description
                                elif hasattr(job_data, 'model_dump'):
                                    # For Pydantic models, we need to update the dict and potentially recreate
                                    job_dict = job_data.model_dump()
                                    job_dict['job_description'] = full_description
                                    # Try to update in place if possible
                                    try:
                                        job_data.job_description = full_description
                                    except:
                                        # If that fails, we'll use the dict later
                                        pass
                                
                                # Verify we got Interview Process
                                if 'Interview Process' in full_description or 'interview process' in full_description.lower():
                                    print(f"         ✅ Full description now contains 'Interview Process'")
                        
                        # Replace existing job if we had it, or add new one
                        if job_url in existing_jobs_by_url:
                            # Find and replace in jobs list
                            for i, existing_job in enumerate(jobs):
                                existing_url = None
                                if hasattr(existing_job, 'job_url'):
                                    existing_url = existing_job.job_url
                                elif hasattr(existing_job, 'model_dump'):
                                    existing_url = existing_job.model_dump().get('job_url')
                                
                                if existing_url == job_url:
                                    jobs[i] = job_data  # Replace with full description
                                    break
                        else:
                            jobs.append(job_data)
                        print(f"      ✅ Successfully scraped job")
                    else:
                        print(f"      ⚠️  No data returned for job")
                except Exception as e:
                    print(f"      ⚠️  Error scraping job {job_url}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
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
            
            # Comprehensive debug logging for description
            if description:
                print(f"      📝 Description Analysis:")
                print(f"         - Length: {len(description)} characters")
                print(f"         - Lines: {description.count(chr(10))} newlines")
                print(f"         - Words: {len(description.split())} words")
                
                # Check for key sections
                has_interview = 'interview process' in description.lower() or 'interview' in description.lower()
                has_requirements = 'requirements' in description.lower() or 'what we\'re looking for' in description.lower()
                has_benefits = 'benefits' in description.lower() or 'compensation' in description.lower()
                has_skills = 'skills:' in description.lower() or 'technologies' in description.lower()
                
                print(f"         - Has 'Interview Process' section: {has_interview}")
                print(f"         - Has 'Requirements' section: {has_requirements}")
                print(f"         - Has 'Benefits' section: {has_benefits}")
                print(f"         - Has 'Skills' section: {has_skills}")
                
                # Check if description seems complete
                seems_complete = len(description) > 1000 and description.count('\n') > 10
                print(f"         - Seems complete (>1000 chars, >10 lines): {seems_complete}")
                
                # Show first and last 200 characters to check for truncation
                print(f"         - First 200 chars: {description[:200]}...")
                print(f"         - Last 200 chars: ...{description[-200:]}")
                
                # Check for common truncation patterns
                if description.endswith('...') or description.endswith('…'):
                    print(f"         ⚠️  WARNING: Description ends with '...' - likely truncated!")
                
                # Search for "Interview Process" specifically
                interview_matches = re.findall(r'(?i)interview\s+process[^\n]*', description)
                if interview_matches:
                    print(f"         ✅ Found 'Interview Process' mentions: {len(interview_matches)}")
                    for match in interview_matches[:3]:  # Show first 3
                        print(f"            - '{match.strip()}'")
                else:
                    print(f"         ⚠️  No 'Interview Process' section found in description")
                
                # Save full description to file for inspection (first job only)
                if idx == 1:
                    debug_file = f"debug_job_description_{company_name.replace(' ', '_')}_{idx}.txt"
                    try:
                        with open(debug_file, 'w', encoding='utf-8') as f:
                            f.write(f"Job URL: {job_url}\n")
                            f.write(f"Job Title: {job_title}\n")
                            f.write(f"Description Length: {len(description)} characters\n")
                            f.write(f"{'='*80}\n")
                            f.write("FULL DESCRIPTION:\n")
                            f.write(f"{'='*80}\n")
                            f.write(description)
                        print(f"         💾 Saved full description to: {debug_file}")
                    except Exception as e:
                        print(f"         ⚠️  Could not save debug file: {e}")
            else:
                print(f"      ⚠️  No description found in job data!")
            tags = job_dict.get("job_tags")  # Nested list: [[tag1, tag2, ...]]

            # Parse description to extract structured sections
            requirements = None
            benefits = None
            interview_process = None
            company_about = None
            extracted_skills = None
            
            if description:
                sections = parse_job_description(description)
                requirements = sections.get("requirements")
                benefits = sections.get("benefits")
                interview_process = sections.get("interview_process")
                company_about = sections.get("company_about")
                extracted_skills = sections.get("skills")
                
                # Debug: Check what we extracted for interview process
                if 'Interview Process' in description or 'interview process' in description.lower():
                    print(f"      🔍 Description contains 'Interview Process' text")
                    if interview_process:
                        print(f"      ✅ Extracted interview_process: {len(interview_process)} chars")
                        print(f"         Preview: {interview_process[:200]}...")
                    else:
                        print(f"      ⚠️  Found 'Interview Process' in description but didn't extract it!")
                        # Try to find it manually with regex
                        interview_match = re.search(r'(?i)Interview\s+Process\s*\n(.*?)(?=\n\n|\n[A-Z][a-z]+\s|$)', description, re.DOTALL)
                        if interview_match:
                            manual_extract = interview_match.group(1).strip()
                            if manual_extract and len(manual_extract) > 10:
                                interview_process = manual_extract
                                print(f"      ✅ Manually extracted interview_process: {len(interview_process)} chars")
                                print(f"         Content: {interview_process[:300]}...")
                
                # Extract inline benefits/compensation if not found in dedicated section
                if not benefits:
                    inline_benefits = extract_inline_benefits(description)
                    if inline_benefits:
                        benefits = inline_benefits
                
                # Extract inline interview process if not found in dedicated section
                if not interview_process:
                    inline_interview = extract_inline_interview_process(description)
                    if inline_interview:
                        interview_process = inline_interview
                        print(f"      ✅ Extracted interview_process via inline extraction: {len(interview_process)} chars")

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
                skills_from_tags = ", ".join(skill_tags) if skill_tags else None
                
                # Combine skills from tags and extracted skills from description
                if extracted_skills and skills_from_tags:
                    skills = f"{extracted_skills}, {skills_from_tags}"
                elif extracted_skills:
                    skills = extracted_skills
                else:
                    skills = skills_from_tags

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
                    "company_about": company_about,  # Extracted from description "About [Company]" section
                    "salary_range": salary_range,
                    "visa_requirements": visa_requirements,  # Extracted from tags (e.g., "US citizen/visa only")
                    "experience_level": experience_level,  # Extracted from tags (e.g., "Any (new grads ok)")
                    "skills": skills,  # Combined from tags and description "Skills:" section
                    "requirements": requirements,  # Extracted from description "Requirements" section
                    "benefits": benefits,  # Extracted from description "Benefits" or "What we offer" section
                    "interview_process": interview_process,  # Extracted from description "Interview Process" section
                    "full_description": description,  # Full description kept as-is
                    "startup_id": startup_id,
                    "yc_link": yc_link,  # Y Combinator company page URL
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
    
    parser = argparse.ArgumentParser(
        description="Scrape jobs from workatastartup.com directory",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test mode: process 1 company
  python scrape_workatastartup_directory.py --test
  
  # Process 5 companies in batches of 5 (1 batch)
  python scrape_workatastartup_directory.py --limit 5
  
  # Process all companies in batches of 5
  python scrape_workatastartup_directory.py --batch-size 5
  
  # Process 20 companies in batches of 5 (4 batches)
  python scrape_workatastartup_directory.py --limit 20 --batch-size 5
        """
    )
    parser.add_argument("--limit", type=int, help="Limit total number of companies to process (default: all)")
    parser.add_argument("--test", action="store_true", help="Test mode: process 1 company")
    parser.add_argument("--batch-size", type=int, default=5, help="Number of companies to process per batch (default: 5)")
    parser.add_argument("--skip-existing", action="store_true", default=True, help="Skip companies that already have jobs (default: True)")
    parser.add_argument("--no-skip-existing", dest="skip_existing", action="store_false", help="Process all companies even if they already have jobs (overrides --skip-existing)")
    
    args = parser.parse_args()
    
    # Determine limit
    if args.test:
        limit = 1
        batch_size = 1
    else:
        limit = args.limit
        batch_size = args.batch_size
    
    print("🚀 Starting workatastartup.com scraper...")
    if args.test:
        print("🧪 Test mode: processing 1 company")
    else:
        print(f"📦 Batch processing: {batch_size} companies per batch")
        if args.skip_existing:
            print("⏭️  Skipping companies that already have jobs")
    
    # Get company URLs from directory
    # Get all companies first (or up to limit)
    companies = get_company_urls_from_directory(limit)
    
    if not companies:
        print("⚠️  No companies found")
        return
    
    print(f"\n📊 Found {len(companies)} companies to process")
    
    # Filter out companies that already have jobs if skip_existing is enabled
    if args.skip_existing:
        print("\n🔍 Checking for existing jobs...")
        companies_to_process = []
        skipped_count = 0
        for company in companies:
            if company_has_jobs(company["company_name"]):
                print(f"   ⏭️  Skipping {company['company_name']} (already has jobs)")
                skipped_count += 1
            else:
                companies_to_process.append(company)
        print(f"   ✅ {len(companies_to_process)} companies to process, {skipped_count} skipped")
        companies = companies_to_process
    
    if not companies:
        print("⚠️  No new companies to process")
        return
    
    # Process companies in batches
    total_jobs = 0
    total_companies_processed = 0
    
    for batch_start in range(0, len(companies), batch_size):
        batch_end = min(batch_start + batch_size, len(companies))
        batch_companies = companies[batch_start:batch_end]
        batch_num = (batch_start // batch_size) + 1
        total_batches = (len(companies) + batch_size - 1) // batch_size
        
        print(f"\n{'='*80}")
        print(f"📦 Batch {batch_num}/{total_batches}: Processing companies {batch_start + 1}-{batch_end} of {len(companies)}")
        print(f"{'='*80}")
        
        batch_jobs = 0
        for idx, company in enumerate(batch_companies, 1):
            print(f"\n[{batch_num}-{idx}/{len(batch_companies)}] Processing: {company['company_name']}")
            try:
                jobs_saved = scrape_and_save_company_jobs(company)
                batch_jobs += jobs_saved
                total_jobs += jobs_saved
                total_companies_processed += 1
            except Exception as e:
                print(f"   ❌ Error processing {company['company_name']}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"\n✅ Batch {batch_num} complete: {batch_jobs} jobs from {len(batch_companies)} companies")
        
        # If not test mode and not the last batch, add a small delay
        if not args.test and batch_end < len(companies):
            print("⏸️  Pausing 2 seconds before next batch...")
            time.sleep(2)
    
    print(f"\n{'='*80}")
    print(f"✅ Complete! Scraped {total_jobs} total jobs from {total_companies_processed} companies")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()

