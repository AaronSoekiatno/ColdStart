import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { randomUUID } from 'crypto';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
interface JobListing {
  companyName: string;
  jobTitle: string;
  jobType: string;
  location: string;
  jobRole: string;
  postedDate: string;
  jobUrl: string;
  companyBatch?: string;
  companyTagline?: string; // Short tagline (e.g., "AI Agents for collections")
  companyAbout?: string; // Full "About [Company]" section
  salaryRange?: string; // e.g., "$75K - $90K"
  visaRequirements?: string; // e.g., "US citizen/visa only"
  experienceLevel?: string; // e.g., "Any (new grads ok)"
  skills?: string; // Comma-separated skills
  requirements?: string; // Requirements section
  benefits?: string; // Benefits section
  interviewProcess?: string; // Interview process description
  fullDescription?: string; // Complete job description
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Helper function to wait for a specified number of milliseconds
 * Replaces the deprecated waitForTimeout method
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper function to find and click element by XPath
 * Replaces the deprecated $x method
 * Returns true if element was found and clicked
 */
async function clickElementByXPath(page: Page, xpath: string): Promise<boolean> {
  try {
    const clicked = await page.evaluate((xpathExpr) => {
      const result = document.evaluate(
        xpathExpr,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = result.singleNodeValue as Element | null;
      if (element && element instanceof HTMLElement) {
        element.click();
        return true;
      }
      return false;
    }, xpath);
    return clicked;
  } catch (e) {
    return false;
  }
}

/**
 * Logs into workatastartup.com if credentials are provided
 * First navigates to the companies page, clicks the "Log In" link, then authenticates
 */
async function loginToWorkAtAStartup(page: Page): Promise<boolean> {
  const email = process.env.WORKATASTARTUP_EMAIL;
  const password = process.env.WORKATASTARTUP_PASSWORD;

  if (!email || !password) {
    console.warn('⚠️  WORKATASTARTUP_EMAIL and WORKATASTARTUP_PASSWORD not set. Skipping login.');
    return false;
  }

  try {
    console.log('🔐 Attempting to log in...');
    
    // Step 1: Navigate to the companies page first
    const companiesUrl = 'https://www.workatastartup.com/companies?demographic=any&hasEquity=any&hasSalary=any&industry=any&interviewProcess=any&jobType=any&layout=list-compact&sortBy=created_desc&tab=any&usVisaNotRequired=any';
    console.log('   📄 Step 1: Navigating to companies page...');
    await page.goto(companiesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Step 2: Find and click the "Log In" link/button
    console.log('   🔍 Step 2: Looking for "Log In" link...');
    const loginLinkSelectors = [
      'a[href*="account.ycombinator.com/authenticate"]',
      'a:contains("Log In")',
      'a[href*="authenticate"]',
      'a[class*="orange"]', // The orange button
      'a[class*="bg-orange"]',
    ];
    
    let loginLinkClicked = false;
    for (const selector of loginLinkSelectors) {
      try {
        const loginLink = await page.$(selector);
        if (loginLink) {
          const linkText = await page.evaluate(el => el.textContent, loginLink);
          if (linkText && (linkText.includes('Log In') || linkText.includes('Login'))) {
            console.log(`   ✅ Found login link with selector: ${selector} (text: "${linkText}")`);
            await loginLink.click();
            loginLinkClicked = true;
            await delay(2000);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Try XPath if CSS selectors didn't work
    if (!loginLinkClicked) {
      console.log('   🔄 Trying XPath to find login link...');
      const loginXPaths = [
        '//a[contains(@href, "authenticate")]',
        '//a[contains(text(), "Log In")]',
        '//a[contains(text(), "Login")]',
        '//a[@class and contains(@class, "orange")]',
      ];
      
      for (const xpath of loginXPaths) {
        const clicked = await clickElementByXPath(page, xpath);
        if (clicked) {
          console.log(`   ✅ Clicked login link via XPath: ${xpath}`);
          loginLinkClicked = true;
          await delay(2000);
          break;
        }
      }
    }
    
    if (!loginLinkClicked) {
      console.warn('   ⚠️  Could not find "Log In" link. The page might already be logged in or structure changed.');
      // Check if we're already logged in
      const currentUrl = page.url();
      if (currentUrl.includes('workatastartup.com') && !currentUrl.includes('authenticate') && !currentUrl.includes('login')) {
        console.log('   ✅ Already on workatastartup.com, might be logged in already');
        return true;
      }
      // If we couldn't find the login link, try to continue anyway
      console.log('   ⚠️  Continuing without clicking login link...');
    }
    
    // Step 3: Wait for redirect to authentication page
    await delay(3000);
    const authUrl = page.url();
    console.log(`   📍 Current URL after clicking login: ${authUrl}`);
    
    // Check if we're already logged in (redirected back to workatastartup.com)
    if (authUrl.includes('workatastartup.com') && !authUrl.includes('authenticate') && !authUrl.includes('login')) {
      console.log('   ✅ Already logged in! Redirected to workatastartup.com');
      return true;
    }
    
    // Step 4: Now we should be on the authentication page, proceed with login
    console.log('   🔐 Step 4: Filling in login credentials...');

    // Look for login form elements - YC account page might have different structure
    // Try multiple possible selectors for email/username field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="user[email]"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[id*="email" i]',
      '#email',
      '#username',
      '#user_email',
      '[data-testid*="email"]',
    ];

    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        emailField = await page.$(selector);
        if (emailField) {
          console.log(`   ✅ Found email field with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!emailField) {
      // Try to find by XPath
      try {
        const emailXPath = '//input[@type="email"] | //input[@name="email"] | //input[contains(@placeholder, "email")]';
        const emailElements = await page.evaluate((xpath) => {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue;
        }, emailXPath);
        
        if (emailElements) {
          emailField = await page.$('input[type="email"], input[name="email"]');
        }
      } catch (e) {
        // Continue
      }
    }

    if (!emailField) {
      console.warn('⚠️  Could not find email input field. Page structure may have changed.');
      console.log('   📄 Current URL:', page.url());
      console.log('   💡 Try checking the page manually or update selectors');
      return false;
    }

    // Type email
    await emailField.type(email, { delay: 100 });
    await delay(500);

    // Find and fill password field
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="user[password]"]',
      'input[id*="password" i]',
      '#password',
      '#user_password',
      '[data-testid*="password"]',
    ];

    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        passwordField = await page.$(selector);
        if (passwordField) {
          console.log(`   ✅ Found password field with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!passwordField) {
      console.warn('⚠️  Could not find password input field.');
      return false;
    }

    await passwordField.type(password, { delay: 100 });
    await delay(500);

    // Find and click submit button - YC account page might have different button structure
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Sign in")',
      'button:contains("Log in")',
      'button:contains("Login")',
      'button:contains("Continue")',
      '[type="submit"]',
      'button[class*="submit"]',
      'button[class*="login"]',
      'button[class*="sign"]',
      '[data-testid*="submit"]',
      '[data-testid*="login"]',
      '[class*="login"] button',
      '[class*="submit"] button',
      'form button',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const submitButton = await page.$(selector);
        if (submitButton) {
          const buttonText = await page.evaluate(el => el.textContent, submitButton);
          // Check for login/sign in/continue buttons
          if (buttonText && (
            buttonText.toLowerCase().includes('log') || 
            buttonText.toLowerCase().includes('sign') ||
            buttonText.toLowerCase().includes('continue') ||
            buttonText.toLowerCase().includes('submit')
          )) {
            console.log(`   ✅ Found submit button with text: "${buttonText}"`);
            await submitButton.click();
            submitted = true;
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If no submit button found, try XPath
    if (!submitted) {
      try {
        const xpathSelectors = [
          '//button[contains(text(), "Log In")]',
          '//button[contains(text(), "Sign In")]',
          '//button[contains(text(), "Login")]',
          '//button[contains(text(), "Continue")]',
          '//button[@type="submit"]',
          '//input[@type="submit"]',
        ];
        
        for (const xpath of xpathSelectors) {
          const clicked = await clickElementByXPath(page, xpath);
          if (clicked) {
            submitted = true;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (!submitted) {
      // Try pressing Enter on the password field
      await passwordField.press('Enter');
    }

    // Wait for navigation or login to complete
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    } catch (e) {
      console.log('⏳ Waiting for login redirect...');
      await delay(3000);
    }

    await delay(3000);

    // Check if we're logged in by looking for user-specific elements or checking URL
    const currentUrl = page.url();
    console.log(`   📍 Current URL after login attempt: ${currentUrl}`);
    
    // Check if we're still on login/account page
    if (currentUrl.includes('account.ycombinator.com') && currentUrl.includes('login')) {
      console.warn('⚠️  Still on login page. Login may have failed.');
      // Take a screenshot for debugging
      try {
        await page.screenshot({ path: 'login-debug.png' });
        console.log('   📸 Screenshot saved to login-debug.png for debugging');
      } catch (e) {
        // Ignore screenshot errors
      }
      return false;
    }
    
    // If we're redirected to workatastartup.com, we're likely logged in
    if (currentUrl.includes('workatastartup.com') && !currentUrl.includes('login')) {
      console.log('✅ Successfully logged in! Redirected to workatastartup.com');
      return true;
    }
    
    // Check for error messages on the page
    const errorText = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="error"], [class*="alert"], [role="alert"]');
      for (const el of errorElements) {
        const text = el.textContent || '';
        if (text.toLowerCase().includes('invalid') || text.toLowerCase().includes('incorrect') || text.toLowerCase().includes('error')) {
          return text;
        }
      }
      return null;
    });
    
    if (errorText) {
      console.warn(`⚠️  Login error detected: ${errorText}`);
      return false;
    }

    console.log('✅ Login appears successful (redirected away from login page)');
    return true;
  } catch (error) {
    console.error('❌ Error during login:', error);
    return false;
  }
}

/**
 * Performs the required clicks to reveal all job data
 */
async function performRequiredClicks(page: Page): Promise<void> {
  try {
    console.log('🖱️  Performing required clicks to reveal job data...');

    // First click: Look for common elements that might need clicking
    // This could be a "Show more" button, filter button, or tab switch
    const firstClickSelectors = [
      '[class*="show-more"]',
      '[class*="load-more"]',
      '[class*="expand"]',
      'button[aria-label*="more" i]',
      '[role="tab"]',
      'button[class*="tab"]',
    ];

    let firstClicked = false;
    for (const selector of firstClickSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', element);
          if (text.includes('show more') || text.includes('load more') || text.includes('view all') || 
              text.includes('see more') || text.includes('jobs') || text.includes('all')) {
            console.log(`   Clicking first element: ${selector} (${text})`);
            await element.click();
            await delay(2000);
            firstClicked = true;
            break;
          }
        }
        if (firstClicked) break;
      } catch (e) {
        // Continue to next selector
      }
    }

    // Try XPath for text-based selection
    if (!firstClicked) {
      try {
        const xpathSelectors = [
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "show more")]',
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "load more")]',
          '//a[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "see more jobs")]',
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "jobs")]',
        ];
        
        for (const xpath of xpathSelectors) {
          const clicked = await clickElementByXPath(page, xpath);
          if (clicked) {
            console.log(`   Clicking first element via XPath: ${xpath}`);
            await delay(2000);
            firstClicked = true;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (!firstClicked) {
      console.log('   ⚠️  Could not find first click element. Trying alternative approach...');
      // Try clicking on the main content area or a specific tab
      const mainContent = await page.$('main, [role="main"], [class*="content"]');
      if (mainContent) {
        await mainContent.click();
        await delay(1000);
      }
    }

    // Second click: Look for "View Job" links/buttons to reveal full job details
    const viewJobSelectors = [
      'a:has-text("View Job")',
      'button:has-text("View Job")',
      'a[href*="view"]',
      'a[href*="job"]',
    ];
    
    // Try to find and click "View Job" links
    let viewJobClicked = false;
    for (const selector of viewJobSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', element);
          if (text.includes('view job') || text.includes('viewjob')) {
            console.log(`   Clicking "View Job" element: ${selector}`);
            await element.click();
            await delay(2000);
            viewJobClicked = true;
            break;
          }
        }
        if (viewJobClicked) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Try XPath for "View Job" links
    if (!viewJobClicked) {
      try {
        const xpathSelectors = [
          '//a[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "view job")]',
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "view job")]',
        ];
        
        for (const xpath of xpathSelectors) {
          const clicked = await clickElementByXPath(page, xpath);
          if (clicked) {
            console.log(`   Clicking "View Job" via XPath: ${xpath}`);
            await delay(2000);
            viewJobClicked = true;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Second click: Another element that reveals more data (if View Job wasn't found)
    if (!viewJobClicked) {
      const secondClickSelectors = [
        '[class*="expand"]',
        '[class*="toggle"]',
        '[aria-expanded="false"]',
        'details summary', // HTML details element
        '[class*="accordion"] button',
        // Try clicking on a specific job listing to expand it
        'article:first-child',
        '[class*="job"]:first-child',
        '[class*="listing"]:first-child',
      ];

      let secondClicked = false;
      for (const selector of secondClickSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', element);
            const ariaExpanded = await page.evaluate(el => el.getAttribute('aria-expanded'), element);
            
            if (text.includes('expand') || text.includes('view details') || ariaExpanded === 'false') {
              console.log(`   Clicking second element: ${selector} (${text || ariaExpanded})`);
              await element.click();
              await delay(2000);
              secondClicked = true;
              break;
            }
          }
          if (secondClicked) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      // Try XPath for second click
      if (!secondClicked) {
      try {
        const xpathSelectors = [
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "expand")]',
          '//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "view details")]',
          '//*[@aria-expanded="false"]',
        ];
        
        for (const xpath of xpathSelectors) {
          const clicked = await clickElementByXPath(page, xpath);
          if (clicked) {
            console.log(`   Clicking second element via XPath: ${xpath}`);
            await delay(2000);
            secondClicked = true;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

      if (!secondClicked) {
        console.log('   ⚠️  Could not find second click element. Trying scroll and wait...');
        // Scroll to trigger lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await delay(2000);
      }
    }

    // Wait for any dynamic content to load after clicks
    await delay(2000);
    console.log('✅ Completed required clicks');
  } catch (error) {
    console.error('❌ Error performing clicks:', error);
    // Don't throw - continue even if clicks fail
  }
}

/**
 * Scrapes job listings from workatastartup.com
 * @param limit - Maximum number of jobs to scrape (default: 50 for testing)
 */
export async function scrapeWorkAtAStartup(limit: number = 50): Promise<JobListing[]> {
  let browser: Browser | null = null;
  const jobs: JobListing[] = [];

  try {
    console.log('🚀 Starting Work at a Startup scraper...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Step 1: Login if credentials are provided
    const loggedIn = await loginToWorkAtAStartup(page);

    // Step 2: Navigate to the jobs page (login should have already happened)
    const url = 'https://www.workatastartup.com/companies?demographic=any&hasEquity=any&hasSalary=any&industry=any&interviewProcess=any&jobType=any&layout=list-compact&sortBy=created_desc&tab=any&usVisaNotRequired=any';
    
    // Check if we're already on the right page
    const currentUrl = page.url();
    if (!currentUrl.includes('workatastartup.com/companies')) {
      console.log(`📄 Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(2000);
    } else {
      console.log(`📄 Already on companies page: ${currentUrl}`);
    }

    // Step 3: Perform the required clicks to reveal all data
    await performRequiredClicks(page);

    // Step 4: Wait for content to load
    await delay(3000);
    
    // Step 5: Scroll gradually to load more content (lazy loading)
    console.log('📜 Scrolling to load content...');
    const scrollSteps = 5;
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate((step, total) => {
        window.scrollTo(0, (document.body.scrollHeight / total) * (step + 1));
      }, i, scrollSteps);
      await delay(1000);
    }
    
    // Scroll to bottom to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await delay(3000);
    
    // Scroll back to top to ensure all content is loaded
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await delay(1000);

    // Step 1: Find all company links with "See all X jobs"
    console.log('🔍 Step 1: Finding company links with "See all X jobs"...');
    
    // First, let's debug what's actually on the page
    const pageDebug = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const linkTexts = allLinks.map(link => ({
        text: link.textContent?.trim() || '',
        href: (link as HTMLAnchorElement).href || (link as HTMLAnchorElement).getAttribute('href') || '',
        hasSeeAll: (link.textContent || '').includes('See all'),
        hasJobs: (link.textContent || '').includes('jobs'),
      })).filter(l => l.hasSeeAll || l.hasJobs || l.href.includes('/companies/'));
      
      return {
        totalLinks: allLinks.length,
        relevantLinks: linkTexts.slice(0, 20), // First 20 relevant links
        pageText: document.body.textContent?.substring(0, 500) || '', // First 500 chars
      };
    });
    
    console.log(`   📊 Page debug: Found ${pageDebug.totalLinks} total links`);
    console.log(`   📋 Relevant links (first 20):`);
    pageDebug.relevantLinks.forEach((link, i) => {
      console.log(`      ${i + 1}. "${link.text}" -> ${link.href.substring(0, 80)}`);
    });
    
    const companyLinks = await page.evaluate(() => {
      const links: Array<{ href: string; text: string; companyName: string; batch?: string }> = [];
      
      // Find all links that contain "See all" and "jobs"
      const allLinks = Array.from(document.querySelectorAll('a'));
      
      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const href = (link as HTMLAnchorElement).href || (link as HTMLAnchorElement).getAttribute('href') || '';
        
        // More flexible matching - check for variations
        const hasSeeAll = text.toLowerCase().includes('see all') || text.toLowerCase().includes('seeall');
        const hasJobs = text.toLowerCase().includes('job');
        
        if (hasSeeAll && hasJobs) {
          // Try to extract company name and batch from nearby text or parent elements
          let companyName = '';
          let batch = '';
          
          // Look for company name in parent elements
          let parent = link.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const parentText = parent.textContent || '';
            // Look for pattern like "Company Name (S24)" or just before the link
            const companyMatch = parentText.match(/([A-Z][a-zA-Z\s&.]+?)\s*\(([SW]\d{2})\)/);
            if (companyMatch) {
              companyName = companyMatch[1].trim();
              batch = companyMatch[2];
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
          
          // If no company name found, try to extract from href
          if (!companyName && href.includes('/companies/')) {
            const hrefMatch = href.match(/\/companies\/([^\/\?]+)/);
            if (hrefMatch) {
              // Convert slug to readable name (e.g., "domu-technology-inc" -> "Domu Technology Inc")
              companyName = hrefMatch[1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
          }
          
          // If still no company name, just copy the text before "See all" or use href
          if (!companyName) {
            // Try to find company name in the link's context
            const linkContext = link.closest('div, article, section')?.textContent || '';
            const contextMatch = linkContext.match(/([A-Z][a-zA-Z\s&.]+?)\s*\(([SW]\d{2})\)/);
            if (contextMatch) {
              companyName = contextMatch[1].trim();
              batch = contextMatch[2];
            } else {
              // Last resort: use href slug
              const hrefMatch = href.match(/\/companies\/([^\/\?]+)/);
              if (hrefMatch) {
                companyName = hrefMatch[1]
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              } else {
                companyName = 'Unknown Company';
              }
            }
          }
          
          links.push({
            href: href.startsWith('http') ? href : `https://www.workatastartup.com${href}`,
            text: text.trim(),
            companyName: companyName || 'Unknown Company',
            batch: batch || undefined,
          });
        }
      }
      
      return links;
    });
    
    console.log(`✅ Found ${companyLinks.length} companies with job listings`);
    
    // If no links found, take a screenshot for debugging
    if (companyLinks.length === 0) {
      console.log('⚠️  No company links found. Taking screenshot for debugging...');
      try {
        await page.screenshot({ path: 'no-links-debug.png', fullPage: true });
        console.log('   📸 Screenshot saved to no-links-debug.png');
      } catch (e) {
        console.log('   ⚠️  Could not take screenshot:', e);
      }
      
      // Try alternative approach: look for any links to /companies/
      console.log('   🔄 Trying alternative: looking for any /companies/ links...');
      const altLinks = await page.evaluate(() => {
        const links: Array<{ href: string; text: string; companyName: string }> = [];
        const allLinks = Array.from(document.querySelectorAll('a'));
        
        for (const link of allLinks) {
          const href = (link as HTMLAnchorElement).href || (link as HTMLAnchorElement).getAttribute('href') || '';
          if (href.includes('/companies/') && !href.includes('/companies?') && !href.includes('/companies#')) {
            const text = (link.textContent || '').trim();
            const hrefMatch = href.match(/\/companies\/([^\/\?]+)/);
            let companyName = 'Unknown';
            if (hrefMatch) {
              companyName = hrefMatch[1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
            links.push({ href, text, companyName });
          }
        }
        return links;
      });
      
      console.log(`   📊 Found ${altLinks.length} alternative company links`);
      if (altLinks.length > 0) {
        console.log('   💡 First few alternative links:');
        altLinks.slice(0, 5).forEach(link => {
          console.log(`      - "${link.text}" -> ${link.href.substring(0, 80)}`);
        });
      }
    } else {
      for (const link of companyLinks) {
        console.log(`   - ${link.companyName}: ${link.text} (${link.href})`);
      }
    }
    
    // Step 2: For each company, click through and get all job listings
    // For testing, process only 1 company (limit applies to companies, not jobs)
    const companiesToProcess = Math.min(companyLinks.length, limit);
    
    console.log(`\n📊 Processing ${companiesToProcess} company/companies (will get all jobs for each)...`);
    
    const allJobs: JobListing[] = [];
    
    for (let i = 0; i < companiesToProcess; i++) {
      const companyLink = companyLinks[i];
      console.log(`\n🏢 Processing company ${i + 1}/${Math.min(companyLinks.length, limit)}: ${companyLink.companyName}`);
      
      try {
        // Navigate to company's job page
        console.log(`   📄 Navigating to ${companyLink.href}...`);
        await page.goto(companyLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);
        
        // Step 3: Find all "View job" links on this company's page
        console.log(`   🔍 Looking for "View job" links...`);
        const jobLinks = await page.evaluate(() => {
          const links: Array<{ href: string; jobTitle: string }> = [];
          
          // Find all links/buttons with "View job" text
          const allElements = Array.from(document.querySelectorAll('a, button'));
          
          for (const el of allElements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const href = (el as HTMLAnchorElement).href || (el as HTMLAnchorElement).getAttribute('href') || '';
            
            if (text.includes('view job') || text.includes('viewjob')) {
              // Try to find job title nearby
              let jobTitle = 'Unknown Position';
              
              // Look in parent elements for job title
              let parent = el.parentElement;
              let depth = 0;
              while (parent && depth < 5) {
                const parentText = parent.textContent || '';
                // Look for common job title patterns
                const titleMatch = parentText.match(/(Senior\s+)?(Staff\s+)?(Software\s+)?(Full\s+Stack\s+)?(Product\s+)?(AI\s+)?(ML\s+)?(Backend\s+)?(Frontend\s+)?(Engineer|Developer|Product\s+Engineer|Engineering\s+Lead|Director|Manager|Intern)/i);
                if (titleMatch) {
                  jobTitle = titleMatch[0].trim();
                  break;
                }
                parent = parent.parentElement;
                depth++;
              }
              
              links.push({
                href: href.startsWith('http') ? href : `https://www.workatastartup.com${href}`,
                jobTitle: jobTitle,
              });
            }
          }
          
          return links;
        });
        
        console.log(`   ✅ Found ${jobLinks.length} job listings for ${companyLink.companyName}`);
        
        // Step 4: For each job, click through and extract details
        for (let j = 0; j < jobLinks.length; j++) {
          const jobLink = jobLinks[j];
          console.log(`\n   💼 Processing job ${j + 1}/${jobLinks.length}: ${jobLink.jobTitle}`);
          console.log(`      🔗 ${jobLink.href}`);
          
          try {
            // Navigate to individual job page
            await page.goto(jobLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
            await delay(2000);
            
            // Extract all job details from the individual job page
            const jobDetails = await page.evaluate((companyName, companyBatch) => {
              const job: any = {
                companyName: companyName,
                companyBatch: companyBatch,
                jobTitle: '',
                jobType: 'fulltime',
                location: 'Unknown',
                jobRole: '',
                postedDate: 'Unknown',
                jobUrl: window.location.href,
                companyTagline: '',
                companyAbout: '',
                salaryRange: '',
                visaRequirements: '',
                experienceLevel: '',
                skills: '',
                requirements: '',
                benefits: '',
                interviewProcess: '',
                fullDescription: document.body.textContent || '',
              };
              
              const text = document.body.textContent || '';
              const html = document.body.innerHTML || '';
              
              // Extract job title (usually at the top)
              const titleSelectors = ['h1', 'h2', '[class*="title"]', '[class*="job-title"]'];
              for (const selector of titleSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                  const titleText = el.textContent?.trim();
                  if (titleText && titleText.length > 5 && titleText.length < 100) {
                    job.jobTitle = titleText;
                    break;
                  }
                }
              }
              
              // Extract salary range
              const salaryMatch = text.match(/\$(\d+K?)\s*-\s*\$(\d+K?)/);
              if (salaryMatch) {
                job.salaryRange = `$${salaryMatch[1]} - $${salaryMatch[2]}`;
              }
              
              // Extract location
              const locationLines = text.split('\n').map(l => l.trim());
              for (const line of locationLines) {
                if (line.match(/(San Francisco|New York|London|Boston|Seattle|Austin|Los Angeles|Palo Alto|Mountain View|Redwood City|Bangalore|Remote)/i) &&
                    (line.includes('CA') || line.includes('NY') || line.includes('US') || line.includes('GB') || line.includes('UK') || line.includes('WA') || line.includes('MA') || line.includes('TX') || line.match(/Remote/i))) {
                  job.location = line;
                  break;
                }
              }
              
              // Extract job type (normalize to lowercase with hyphens)
              const jobTypeMatch = text.match(/(Full-time|Part-time|Contract|Internship|fulltime|parttime|contract|internship)/i);
              if (jobTypeMatch) {
                const rawType = jobTypeMatch[1].toLowerCase();
                // Normalize to lowercase with hyphens: full-time, part-time, contract, internship
                if (rawType.includes('full') || rawType === 'fulltime') {
                  job.jobType = 'full-time';
                } else if (rawType.includes('part') || rawType === 'parttime') {
                  job.jobType = 'part-time';
                } else if (rawType.includes('intern')) {
                  job.jobType = 'internship';
                } else if (rawType.includes('contract')) {
                  job.jobType = 'contract';
                }
              }
              
              // Extract visa requirements
              for (const line of locationLines) {
                if (line.match(/(US citizen|visa|sponsor|US visa not required)/i)) {
                  job.visaRequirements = line;
                  break;
                }
              }
              
              // Extract experience level
              for (const line of locationLines) {
                if (line.match(/(Any|new grads|\d+\+?\s*years?|entry|senior|intern)/i) && 
                    (line.includes('new grads') || line.includes('Any') || line.match(/\d+\+?\s*years?/))) {
                  job.experienceLevel = line;
                  break;
                }
              }
              
              // Extract skills
              let skillsFound = false;
              for (let i = 0; i < locationLines.length; i++) {
                const line = locationLines[i];
                if (line.match(/^Skills:/i)) {
                  let skillsText = line.replace(/^Skills:\s*/i, '');
                  for (let j = i + 1; j < Math.min(i + 3, locationLines.length); j++) {
                    if (locationLines[j] && !locationLines[j].match(/^[A-Z][a-z]+\s+[A-Z]/)) {
                      skillsText += ', ' + locationLines[j];
                    } else {
                      break;
                    }
                  }
                  job.skills = skillsText.trim();
                  skillsFound = true;
                  break;
                }
              }
              
              if (!skillsFound) {
                const techKeywords = ['Node.js', 'Python', 'React', 'TypeScript', 'JavaScript', 'Java', 'Go', 'Rust', 'C++', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Django', 'Flask', 'Express', 'Vue', 'Angular', 'Next.js', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes'];
                const foundTech: string[] = [];
                for (const keyword of techKeywords) {
                  if (text.includes(keyword)) {
                    foundTech.push(keyword);
                  }
                }
                if (foundTech.length > 0) {
                  job.skills = foundTech.join(', ');
                }
              }
              
              // Extract structured sections
              const lines = text.split('\n').map(l => l.trim());
              let currentSection = '';
              let currentSectionText = '';
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.match(/^About\s+[A-Z]/i) && !line.match(/About the role/i)) {
                  if (currentSection && currentSectionText) {
                    if (currentSection === 'companyAbout') {
                      job.companyAbout = currentSectionText.trim();
                    }
                  }
                  currentSection = 'companyAbout';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^(About the role|The role)$/i)) {
                  if (currentSection && currentSectionText) {
                    if (currentSection === 'companyAbout') {
                      job.companyAbout = currentSectionText.trim();
                    }
                  }
                  currentSection = 'aboutRole';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^Requirements$/i)) {
                  if (currentSection && currentSectionText) {
                    job[currentSection] = currentSectionText.trim();
                  }
                  currentSection = 'requirements';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^(Benefits|What we offer)$/i)) {
                  if (currentSection && currentSectionText) {
                    job[currentSection] = currentSectionText.trim();
                  }
                  currentSection = 'benefits';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^Interview Process$/i)) {
                  if (currentSection && currentSectionText) {
                    job[currentSection] = currentSectionText.trim();
                  }
                  currentSection = 'interviewProcess';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^(Technology|Stack|Our stack)$/i)) {
                  if (currentSection && currentSectionText) {
                    job[currentSection] = currentSectionText.trim();
                  }
                  currentSection = 'technology';
                  currentSectionText = '';
                  continue;
                } else if (line.match(/^(What You|How we|Why|Preferred)/i)) {
                  if (currentSection) {
                    currentSectionText += '\n' + line;
                  }
                  continue;
                }
                
                if (currentSection && line.length > 0) {
                  if (line.match(/^(About|Requirements|Benefits|Interview|Technology|What You|How we|Why)/i) && !currentSectionText) {
                    continue;
                  }
                  currentSectionText += (currentSectionText ? '\n' : '') + line;
                }
              }
              
              if (currentSection && currentSectionText) {
                if (currentSection === 'companyAbout') {
                  job.companyAbout = currentSectionText.trim();
                } else if (currentSection !== 'aboutRole' && currentSection !== 'technology') {
                  job[currentSection] = currentSectionText.trim();
                }
              }
              
              // Extract company tagline (short description, usually near the top)
              const taglineMatch = text.match(new RegExp(`${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*\\n([^\\n]{10,150})`, 'i'));
              if (taglineMatch && !taglineMatch[1].includes('$') && !taglineMatch[1].includes('Apply')) {
                job.companyTagline = taglineMatch[1].trim();
              }
              
              return job;
            }, companyLink.companyName, companyLink.batch || '');
            
            // Set job role from title if not set
            if (!jobDetails.jobRole) {
              jobDetails.jobRole = jobDetails.jobTitle;
            }
            
            allJobs.push(jobDetails);
            
            // Log the extracted job details
            console.log(`      ✅ Extracted job details:`);
            console.log(`         Title: ${jobDetails.jobTitle}`);
            console.log(`         Type: ${jobDetails.jobType}`);
            console.log(`         Location: ${jobDetails.location}`);
            if (jobDetails.salaryRange) console.log(`         Salary: ${jobDetails.salaryRange}`);
            if (jobDetails.skills) console.log(`         Skills: ${jobDetails.skills.substring(0, 80)}...`);
            
          } catch (jobError) {
            console.error(`      ❌ Error processing job ${jobLink.jobTitle}:`, jobError);
            // Continue to next job
          }
        }
        
      } catch (companyError) {
        console.error(`   ❌ Error processing company ${companyLink.companyName}:`, companyError);
        // Continue to next company
      }
    }
    
    // Return the jobs we collected
    console.log(`\n✅ Completed scraping. Found ${allJobs.length} total jobs.`);
    
    // Process and clean the data with comprehensive logging
    for (const job of allJobs) {
      if (job.companyName || job.jobTitle) {
        // Log all gathered information
        console.log('\n📋 Job Listing:');
        console.log(`   Company: ${job.companyName}${job.companyBatch ? ` (${job.companyBatch})` : ''}`);
        console.log(`   Job Title: ${job.jobTitle}`);
        console.log(`   Type: ${job.jobType}`);
        console.log(`   Location: ${job.location}`);
        console.log(`   Role: ${job.jobRole}`);
        console.log(`   Posted: ${job.postedDate}`);
        console.log(`   URL: ${job.jobUrl}`);
        if (job.companyTagline) console.log(`   Tagline: ${job.companyTagline}`);
        if (job.salaryRange) console.log(`   Salary: ${job.salaryRange}`);
        if (job.visaRequirements) console.log(`   Visa: ${job.visaRequirements}`);
        if (job.experienceLevel) console.log(`   Experience: ${job.experienceLevel}`);
        if (job.skills) console.log(`   Skills: ${job.skills}`);
        if (job.companyAbout) console.log(`   About: ${job.companyAbout.substring(0, 100)}...`);
        if (job.requirements) console.log(`   Requirements: ${job.requirements.substring(0, 100)}...`);
        if (job.benefits) console.log(`   Benefits: ${job.benefits.substring(0, 100)}...`);
        if (job.interviewProcess) console.log(`   Interview: ${job.interviewProcess.substring(0, 100)}...`);
        
        jobs.push({
          companyName: (job.companyName || '').trim(),
          jobTitle: (job.jobTitle || 'Unknown Position').trim(),
          jobType: job.jobType || 'fulltime',
          location: job.location || 'Unknown',
          jobRole: job.jobRole || job.jobTitle?.trim() || 'Unknown',
          postedDate: job.postedDate || 'Unknown',
          jobUrl: job.jobUrl || '',
          companyBatch: job.companyBatch,
          companyTagline: job.companyTagline,
          companyAbout: job.companyAbout,
          salaryRange: job.salaryRange,
          visaRequirements: job.visaRequirements,
          experienceLevel: job.experienceLevel,
          skills: job.skills,
          requirements: job.requirements,
          benefits: job.benefits,
          interviewProcess: job.interviewProcess,
          fullDescription: job.fullDescription,
        });
      }
    }
    
    console.log(`\n📊 Processed ${jobs.length} valid job listings`);
    
    return jobs;

  } catch (error) {
    console.error('❌ Error scraping Work at a Startup:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return jobs;
}

/**
 * Saves job listings to Supabase and cross-references with startups table
 */
export async function saveJobsAndEnrichStartups(jobs: JobListing[]): Promise<{ saved: number; enriched: number }> {
  let saved = 0;
  let enriched = 0;

  for (const job of jobs) {
    try {
      // First, try to find matching startup in our database
      let startupId: string | null = null;

      // Try exact name match first
      const { data: exactMatch } = await supabase
        .from('startups3')
        .select('id')
        .ilike('name', job.companyName)
        .limit(1)
        .single();

      if (exactMatch) {
        startupId = exactMatch.id;
        console.log(`✅ Found exact match for ${job.companyName}`);
      } else {
        // Try partial match (company name contains or is contained in startup name)
        const { data: partialMatches } = await supabase
          .from('startups3')
          .select('id, name')
          .or(`name.ilike.%${job.companyName}%,name.ilike.${job.companyName}%`);

        if (partialMatches && partialMatches.length > 0) {
          startupId = partialMatches[0].id;
          console.log(`✅ Found partial match for ${job.companyName} -> ${partialMatches[0].name}`);
        }
      }

      // If no startup found, create a basic entry for enrichment
      if (!startupId) {
        console.log(`⚠️  No startup found for ${job.companyName}, creating entry for enrichment...`);
        
        // Generate a unique ID (UUID as string for TEXT column)
        const startupIdGenerated = randomUUID();
        
        console.log(`   📝 Generated startup ID: ${startupIdGenerated} for ${job.companyName}`);
        
        const { data: newStartup, error: startupError } = await supabase
          .from('startups3')
          .insert({
            id: startupIdGenerated,
            name: job.companyName,
            description: job.companyAbout || job.companyTagline || '',
            industry: '',
            location: job.location !== 'Unknown' ? job.location : '',
            website: '',
            job_openings: job.jobTitle,
            batch: job.companyBatch || null,
            data_source: 'workatastartup',
            needs_enrichment: true,
            enrichment_status: 'pending',
          })
          .select('id')
          .single();

        if (newStartup && !startupError) {
          startupId = newStartup.id;
          enriched++;
          console.log(`✅ Created new startup entry for ${job.companyName}`);
        } else if (startupError) {
          console.error(`❌ Error creating startup for ${job.companyName}:`, startupError.message);
        }
      }

      // Save the job listing with all fields
      const { error: jobError } = await supabase
        .from('jobs')
        .upsert({
          company_name: job.companyName,
          job_title: job.jobTitle,
          job_type: job.jobType,
          location: job.location,
          job_role: job.jobRole,
          posted_date: job.postedDate,
          job_url: job.jobUrl,
          company_batch: job.companyBatch,
          company_tagline: job.companyTagline || null,
          company_about: job.companyAbout || null,
          salary_range: job.salaryRange || null,
          visa_requirements: job.visaRequirements || null,
          experience_level: job.experienceLevel || null,
          skills: job.skills || null,
          requirements: job.requirements || null,
          benefits: job.benefits || null,
          interview_process: job.interviewProcess || null,
          full_description: job.fullDescription || null,
          startup_id: startupId,
        }, {
          onConflict: 'company_name,job_title,job_url',
        });

      if (!jobError) {
        saved++;
      } else {
        console.error(`❌ Error saving job ${job.companyName} - ${job.jobTitle}:`, jobError.message);
      }

    } catch (error) {
      console.error(`❌ Error processing job ${job.companyName}:`, error);
    }
  }

  return { saved, enriched };
}

/**
 * Main function to scrape and save jobs
 */
export async function scrapeAndSaveWorkAtAStartup(limit: number = 50) {
  try {
    console.log('🚀 Starting Work at a Startup scraper...');
    
    const jobs = await scrapeWorkAtAStartup(limit);
    console.log(`📊 Scraped ${jobs.length} job listings`);

    if (jobs.length === 0) {
      console.log('⚠️  No jobs found. The page structure might have changed.');
      return { saved: 0, enriched: 0 };
    }

    const result = await saveJobsAndEnrichStartups(jobs);
    console.log(`✅ Saved ${result.saved} jobs and enriched ${result.enriched} startups`);
    
    return result;
  } catch (error) {
    console.error('❌ Error in scrapeAndSaveWorkAtAStartup:', error);
    throw error;
  }
}

// Allow running as a script
if (require.main === module) {
  // First argument is the number of companies to process (default: 1 for testing)
  // This limits how many companies we process, but we get ALL jobs for each company
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 1;
  
  console.log(`🧪 Testing with ${limit} company/companies (will get all jobs for each)`);
  
  scrapeAndSaveWorkAtAStartup(limit)
    .then((result) => {
      console.log('✅ Scraping completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Scraping failed:', error);
      process.exit(1);
    });
}

