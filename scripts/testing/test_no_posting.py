"""
Quick test script to find a company with "No specific jobs listed" message.
Run this to identify a company URL to test with.
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os

def find_company_with_no_posting():
    """Find a company that has 'No specific jobs listed' message."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    try:
        # Login if credentials are provided
        email = os.getenv("WORKATASTARTUP_EMAIL")
        password = os.getenv("WORKATASTARTUP_PASSWORD")
        
        if email and password:
            driver.get("https://www.workatastartup.com/companies")
            time.sleep(2)
            try:
                login_link = driver.find_element(By.XPATH, "//a[contains(@href, 'authenticate') or contains(text(), 'Log In')]")
                login_link.click()
                time.sleep(2)
                email_field = driver.find_element(By.NAME, "username")
                password_field = driver.find_element(By.NAME, "password")
                email_field.send_keys(email)
                password_field.send_keys(password)
                submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")
                submit_button.click()
                time.sleep(3)
            except:
                pass
        
        # Navigate to directory
        url = "https://www.workatastartup.com/companies?sortBy=most_active&layout=list-compact"
        driver.get(url)
        time.sleep(5)
        
        # Get first 20 company links
        company_links = driver.find_elements(By.XPATH, "//a[contains(@href, '/companies/')]")
        company_urls = []
        for link in company_links[:20]:
            href = link.get_attribute("href")
            if href and "/companies/" in href and href not in company_urls:
                company_urls.append(href.split('?')[0])
        
        print(f"🔍 Checking {len(company_urls)} companies for 'No specific jobs listed' message...\n")
        
        # Check each company
        for company_url in company_urls:
            try:
                driver.get(company_url)
                time.sleep(2)
                
                # Check for the message
                no_posting_elements = driver.find_elements(
                    By.XPATH, 
                    "//*[contains(text(), 'No specific jobs listed')]"
                )
                
                if no_posting_elements:
                    # Get company name
                    try:
                        company_name = driver.find_element(By.TAG_NAME, "h1").text
                    except:
                        company_name = company_url.split('/')[-1]
                    
                    print(f"✅ FOUND: {company_name}")
                    print(f"   URL: {company_url}")
                    print(f"   Message: {no_posting_elements[0].text}\n")
                    return company_url
            except Exception as e:
                continue
        
        print("❌ No companies found with 'No specific jobs listed' message in first 20 companies")
        print("   Try checking more companies or manually find one on workatastartup.com")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    find_company_with_no_posting()



