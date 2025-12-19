import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load .env.local file from project root
// Try multiple paths to find .env.local
const currentDir = process.cwd();
const possiblePaths = [
  join(currentDir, '.env.local'),           // Current directory
  join(currentDir, '..', '.env.local'),     // Parent directory (if running from yc_companies)
  join(__dirname, '..', '.env.local'),      // Relative to script location
  join(__dirname, '..', '..', '.env.local'), // Two levels up from script
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  const result = config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No environment variables loaded. Make sure .env.local exists in project root.');
}

import { randomUUID } from 'crypto';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';
import { processImagesInParallel } from './utils/image-storage';

// Types
interface YCCompany {
  YC_Link?: string;
  YC_link?: string; // Alternative column name
  Company_Logo?: string;
  Company_Name: string;
  company_description: string;
  Batch: string;
  business_type?: string;
  industry?: string;
  Industry?: string; // Alternative column name
  'Sub-Industry'?: string;
  location?: string;
  Location?: string; // Alternative column name
}

interface YCPageData {
  founders: Array<{
    firstName: string;
    lastName: string;
    linkedIn: string;
    twitterUrl?: string; // Founder Twitter/X URL
    description?: string; // Founder bio/description
    profilePicture?: string; // Founder profile picture URL
  }>;
  website: string;
  teamSize: string;
  jobPostings: Array<{
    title: string;
    description: string;
    location?: string; // Job location
  }>;
  location: string;
  oneLineSummary: string;
  ycDescription?: string; // Main company description from YC page prose div (before founders section)
  companyTwitterUrl?: string; // Company Twitter/X URL
  fundingAmount?: string; // Funding amount (e.g., "US$ 500.0K", "$20M")
  roundType?: string; // Funding round type (e.g., "Pre seed", "Seed", "Series A")
  fundingDate?: string; // Funding date (e.g., "Oct 9, 2025", "2025-10-09")
  linkedInCompanyUrl?: string | null; // Constructed LinkedIn URL for future enrichment
  tags?: string[]; // Technology/skill tags (excluding locations)
  launchDate?: string; // Launch/founded date (e.g., "2024", "Jan 2024", "2024-01-01")
}

interface EnrichedYCData extends YCCompany {
  founder_first_name: string;
  founder_last_name: string;
  founder_linkedin: string;
  website: string;
  team_size: string;
  job_openings: string;
  hiring_roles: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing'}`);
  console.error(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Found' : '❌ Missing'}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing'}`);
  console.error(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Found' : '❌ Missing'}`);
  throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Normalize company data to handle both CSV formats
 */
function normalizeCompanyData(company: YCCompany): {
  ycLink: string;
  companyLogo: string;
  companyName: string;
  description: string;
  batch: string;
  businessType: string;
  industry: string;
  location: string;
} {
  return {
    ycLink: company.YC_Link || company.YC_link || '',
    companyLogo: company.Company_Logo || '',
    companyName: company.Company_Name || '',
    description: company.company_description || '',
    batch: company.Batch || '',
    businessType: company.business_type || '',
    industry: company.industry || company.Industry || company['Sub-Industry'] || '',
    location: company.location || company.Location || '',
  };
}

/**
 * Extract company slug from YC URL
 */
function extractCompanySlug(ycLink: string): string | null {
  const match = ycLink.match(/\/companies\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Load companies from CSV file
 */
function loadCompaniesFromCSV(csvPath: string): YCCompany[] {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records as YCCompany[];
}

/**
 * Get all CSV files from yc_companies directory
 */
function getAllYCCsvFiles(): string[] {
  // Check if we're already in yc_companies directory or if we need to navigate to it
  const currentDir = process.cwd();
  const ycDir = currentDir.endsWith('yc_companies') ? currentDir : resolve(currentDir, 'yc_companies');

  const files = fs.readdirSync(ycDir);
  return files
    .filter(file => (file.startsWith('ycombinator') || file.toLowerCase().includes('yc')) && file.endsWith('.csv'))
    .map(file => resolve(ycDir, file))
    .sort(); // Sort for consistent ordering
}

/**
 * Construct LinkedIn company URL from website domain
 * NOTE: We store this URL for future enrichment via APIs, but don't scrape it directly
 */
function constructLinkedInCompanyUrl(website: string): string | null {
  if (!website) return null;

  try {
    const url = new URL(website);
    const hostname = url.hostname.replace('www.', '');
    const domainParts = hostname.split('.');
    const domain = domainParts[0];

    // LinkedIn company URL format: linkedin.com/company/{company-slug}/
    const linkedInUrl = `https://www.linkedin.com/company/${domain.toLowerCase()}`;
    console.log(`   🔗 Constructed LinkedIn URL: ${linkedInUrl}`);
    return linkedInUrl;
  } catch (error) {
    return null;
  }
}

/**
 * Scrape YC company page for founder, job, and company data
 * Enhanced with better selectors, founder descriptions, and jobs page scraping
 */
async function scrapeYCCompanyPage(page: Page, ycUrl: string): Promise<YCPageData | null> {
  try {
    console.log(`   Navigating to: ${ycUrl}`);
    
    // Check if page is still attached
    if (page.isClosed()) {
      throw new Error('Page is closed');
    }
    
    // Navigate with better error handling and retry logic
    let navigationSuccess = false;
    let navError: any = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Check if page is still attached before navigation
        if (page.isClosed()) {
          throw new Error('Page was closed before navigation');
        }
        
        await page.goto(ycUrl, { 
          waitUntil: attempt === 0 ? 'networkidle2' : 'domcontentloaded', 
          timeout: 30000 
        });
        
        // Wait a bit after navigation to ensure stability
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        navigationSuccess = true;
        break;
      } catch (error: any) {
        navError = error;
        const errorMsg = error?.message || String(error);
        
        // If it's a detached frame error, wait and try again
        if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
          console.warn(`   ⚠️  Detached frame error (attempt ${attempt + 1}/3), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // For other errors, try with domcontentloaded on next attempt
        if (attempt < 2) {
          console.warn(`   ⚠️  Navigation error (attempt ${attempt + 1}/3): ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    if (!navigationSuccess) {
      console.error(`   ❌ Failed to load page after 3 attempts: ${navError instanceof Error ? navError.message : String(navError)}`);
      return null;
    }

    // Wait for content to load
    try {
      await page.waitForSelector('body', { timeout: 10000 });
    } catch (error) {
      console.warn(`   ⚠️  Body selector timeout, continuing anyway...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll to trigger lazy-loaded content
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer after scroll
    } catch (scrollError) {
      console.warn(`   ⚠️  Scroll error (non-critical): ${scrollError instanceof Error ? scrollError.message : String(scrollError)}`);
    }

    // Check if page loaded correctly
    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);
    
    // Check for common error pages with retry logic
    let isErrorPage = false;
    try {
      isErrorPage = await page.evaluate(() => {
        const bodyText = document.body.textContent?.toLowerCase() || '';
        return bodyText.includes('404') || 
               bodyText.includes('not found') || 
               bodyText.includes('page not found') ||
               bodyText.includes('access denied');
      });
    } catch (evalError: any) {
      const errorMsg = evalError?.message || String(evalError);
      if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
        throw new Error('Page detached during error page check');
      }
      throw evalError;
    }
    
    if (isErrorPage) {
      console.error(`   ❌ Page appears to be an error page (404/not found)`);
      return null;
    }

    // Check if page is still attached before evaluation
    if (page.isClosed()) {
      throw new Error('Page was closed before evaluation');
    }

    let pageData;
    try {
      pageData = await page.evaluate(() => {
      const debugInfo: string[] = [];
      try {
      const data: YCPageData = {
        founders: [],
        website: '',
        teamSize: '',
        jobPostings: [],
        location: '',
        oneLineSummary: '',
      };

      // ============================================
      // 1. EXTRACT FOUNDERS WITH DESCRIPTIONS
      // ============================================
      // Strategy: Multiple approaches with increasing complexity
      // 1. Simple text-based extraction (most reliable)
      // 2. CSS selector-based extraction
      // 3. Fallback text extraction
      
      // First, get the company name to filter it out
      const companyName = (document.querySelector('h1')?.textContent?.trim() || '').toLowerCase();
      
      // PRIORITY METHOD: Simple text-based extraction FIRST (before CSS selectors)
      // This is more reliable because it doesn't depend on CSS classes or HTML structure
      // Works whether "Active Founders" is in a heading, div, span, or any element
      const bodyText = document.body.textContent || '';
      const bodyLower = bodyText.toLowerCase();
      
      // Find "Active Founders" or "Founders" in the raw text (works for any element type)
      let simpleExtractionIndex = bodyLower.indexOf('active founders');
      if (simpleExtractionIndex < 0) {
        simpleExtractionIndex = bodyLower.indexOf('founders');
      }
      
      if (simpleExtractionIndex >= 0) {
        // Get text after "Active Founders" (works whether it's in a div, heading, or any element)
        const sectionText = bodyText.slice(simpleExtractionIndex);
        const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Look through first 30 lines after "Active Founders" to find founder names
        for (let i = 1; i < Math.min(31, lines.length); i++) {
          const line = lines[i];
          
          // Skip if we hit another section
          if (line.match(/^(Company|Location|Jobs|Team|Status|Founded|Website|Batch):?$/i)) break;
          
          // Pattern: Line is exactly a name (First Last or First Middle Last)
          const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/;
          const nameMatch = line.match(namePattern);
          
          if (nameMatch) {
            const fullName = nameMatch[1];
            const nameParts = fullName.split(/\s+/);
            
            // Must be 2-4 words
            if (nameParts.length >= 2 && nameParts.length <= 4) {
              // Skip if it's the company name
              if (fullName.toLowerCase() === companyName) continue;
              
              // Skip common words and launch post section headers
              const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location',
                                'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                'San Francisco', 'New York', 'Remote', 'United States',
                                'The Problem', 'Our Solution', 'The Solution', 'Our Team',
                                'Our Mission', 'Our Vision', 'The Challenge', 'The Opportunity',
                                'Key Features', 'Why Now', 'Market Opportunity', 'The Product',
                                'Our Approach', 'Why Us', 'Get Started'];
              if (skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) continue;
              
              // Get description from next line
              let description = '';
              if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.length > 15 && nextLine.length < 500 &&
                    !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                    !nextLine.match(/^(Company|Location|Jobs):?$/i) && // Not a heading
                    (nextLine.includes('Building') || nextLine.includes('Prior') || 
                     nextLine.match(/\b(at|from|worked|led)\b/i))) {
                  description = nextLine;
                }
              }
              
              // Try to find LinkedIn link
              let linkedIn = '';
              const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
              
              // Find links that appear after the founders section
              const linkIndex = bodyText.indexOf('linkedin.com/in/');
              if (linkIndex > simpleExtractionIndex && linkIndex < simpleExtractionIndex + 3000) {
                for (const link of allLinkedInLinks) {
                  const linkHref = (link as HTMLAnchorElement).href;
                  const linkText = link.textContent || '';
                  const linkNearbyText = link.parentElement?.textContent || '';
                  
                  // If the link is near this name
                  if (linkNearbyText.toLowerCase().includes(fullName.toLowerCase().split(' ')[0]) ||
                      linkText.toLowerCase().includes(nameParts[0].toLowerCase())) {
                    linkedIn = linkHref;
                    break;
                  }
                }
              }
              
              // Try to find Twitter link (similar to LinkedIn)
              let twitterUrl = '';
              const allTwitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
              const twitterLinkIndex = bodyText.indexOf('x.com/');
              if (twitterLinkIndex > simpleExtractionIndex && twitterLinkIndex < simpleExtractionIndex + 3000) {
                for (const link of allTwitterLinks) {
                  const linkEl = link as HTMLAnchorElement;
                  const linkHref = linkEl.href;
                  if (!linkHref) continue;
                  
                  const ariaLabel = linkEl.getAttribute('aria-label') || '';
                  const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
                  const linkNearbyText = link.parentElement?.textContent || '';
                  
                  // Check if this is a founder Twitter link
                  const isFounderTwitter = (
                    dataTooltipId.includes('founder-social-tooltip') ||
                    (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
                  );
                  
                  // If the link is near this name and is a founder Twitter link
                  if (isFounderTwitter && 
                      (linkNearbyText.toLowerCase().includes(fullName.toLowerCase().split(' ')[0]) ||
                       linkNearbyText.toLowerCase().includes(nameParts[0].toLowerCase()))) {
                    let normalizedUrl = linkHref;
                    if (normalizedUrl.startsWith('//')) {
                      normalizedUrl = 'https:' + normalizedUrl;
                    } else if (!normalizedUrl.startsWith('http')) {
                      normalizedUrl = 'https://' + normalizedUrl;
                    }
                    normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
                    twitterUrl = normalizedUrl;
                    break;
                  }
                }
              }
              
              const firstName = nameParts[0];
              const lastName = nameParts.slice(1).join(' ');
              
              // Add to founders (will deduplicate later)
              data.founders.push({
                firstName,
                lastName,
                linkedIn,
                twitterUrl: twitterUrl || undefined,
                description: description || undefined,
              });
            }
          }
        }
      }
      
      // If we already found founders with simple extraction, skip CSS-based extraction
      // Otherwise, continue with CSS selector-based approach below
      
      // Find "Active Founders" section - can be in ANY element (heading, div, span, etc.)
      let foundersHeading: Element | null = null;
      
      // Method 1: Search ALL elements for "Active Founders" text (not just headings!)
      const allElements = Array.from(document.querySelectorAll('*'));
      foundersHeading = allElements.find(el => {
        const text = el.textContent?.trim() || '';
        // Match if text is exactly "Active Founders" or contains it
        // This works for divs, spans, headings, or any element
        return text.toLowerCase() === 'active founders' ||
               text.toLowerCase().includes('active founders');
      }) || null;
      
      // Method 2: If not found, try just "Founders"
      if (!foundersHeading) {
        foundersHeading = allElements.find(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'founders';
        }) || null;
      }
      
      // Method 3: Look in headings as fallback
      if (!foundersHeading) {
      const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        foundersHeading = allHeadings.find(h => {
        const text = h.textContent?.trim() || '';
        return text.toLowerCase().includes('active founders') || 
               text.toLowerCase() === 'founders';
        }) || null;
      }
      
      // Track seen founders to avoid duplicates
      const seenFounders = new Set<string>(); // Track by LinkedIn URL or full name
      
      // If we already found founders with simple extraction, mark them as seen for deduplication
      for (const founder of data.founders) {
        const key = founder.linkedIn || `${founder.firstName} ${founder.lastName}`.toLowerCase();
        seenFounders.add(key);
      }
      
      // Continue with CSS selector-based extraction (may find additional founders)
      // Final deduplication will handle duplicates

      // Find the container with founder cards
      let foundersContainer: Element | null = null;
      
      if (foundersHeading) {
        // Look for container with founder cards - typically a parent or sibling
        let current: Element | null = foundersHeading.parentElement;
        while (current && !foundersContainer) {
          // Check if this container has founder name elements
          const nameElements = current.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
          if (nameElements.length > 0) {
            foundersContainer = current;
            break;
          }
          current = current.parentElement;
        }
      }
      
      // If no heading found, try to find founder cards directly
      if (!foundersContainer) {
        const nameElements = document.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        if (nameElements.length > 0) {
          // Find common parent of all name elements
          const parents = Array.from(nameElements).map(el => el.parentElement).filter(Boolean);
          if (parents.length > 0) {
            // Find the deepest common ancestor
            let commonParent = parents[0];
            for (let i = 1; i < parents.length && commonParent; i++) {
              while (commonParent && !commonParent.contains(parents[i] as Node)) {
                commonParent = commonParent.parentElement;
              }
            }
            foundersContainer = commonParent;
          }
        }
      }
      
      if (foundersContainer) {
        // Find all founder name elements in the container
        const nameElements = foundersContainer.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        
        nameElements.forEach(nameEl => {
          const fullName = nameEl.textContent?.trim() || '';
          
          if (!fullName || fullName.length < 3 || fullName.length > 100) return;
          
          // Skip if it's not a person's name (has numbers, special chars, etc.)
          if (!/^[A-Za-z\s\.\-\']+$/.test(fullName)) return;
          
          // Find the founder card container (parent that likely contains both name and description)
          let founderCard = nameEl.parentElement;
          let attempts = 0;
          while (founderCard && attempts < 5) {
            // Check if this container has a description element
            const descEl = founderCard.querySelector('.prose.max-w-full.whitespace-pre-line, div[class*="prose"][class*="max-w-full"]');
            if (descEl) {
              break; // Found the right container
            }
            founderCard = founderCard.parentElement;
            attempts++;
          }
          
          // If no card found, use the name element's parent
          if (!founderCard) {
            founderCard = nameEl.parentElement;
          }
          
          // Extract description/background
          // Use broader extraction when we're in Active Founders section - don't require "founder" keyword
          let description = '';
          
          // PRIORITY: Try to find description in prose div (this is the main location for founder descriptions)
          // Target: div.prose.max-w-full.whitespace-pre-line
          // This matches the exact element structure: <div class="prose max-w-full whitespace-pre-line">
          const proseDiv = founderCard?.querySelector('.prose.max-w-full.whitespace-pre-line, div[class*="prose"][class*="max-w-full"][class*="whitespace-pre-line"]') as HTMLElement;
          if (proseDiv) {
            // Get full text content - try multiple methods to ensure we get complete text
            // Use innerText first (preserves line breaks and ignores hidden elements)
            description = proseDiv.innerText?.trim() || '';
            
            // If innerText is short or empty, try textContent (includes hidden text)
            if (!description || description.length < 30) {
              description = proseDiv.textContent?.trim() || '';
            }
            
            // Also check for any child elements that might contain the full text
            if (description.length < 50 && proseDiv.children.length > 0) {
              const childText = Array.from(proseDiv.children)
                .map((el: Element) => {
                  const htmlEl = el as HTMLElement;
                  return htmlEl.innerText || htmlEl.textContent || '';
                })
                .filter(text => text.length > 0)
                .join(' ')
                .trim();
              if (childText.length > description.length) {
                description = childText;
              }
            }
            
            // Check for data attributes that might contain full text
            if (description.length < 50) {
              const dataText = proseDiv.getAttribute('data-text') || 
                              proseDiv.getAttribute('data-content') ||
                              proseDiv.getAttribute('content');
              if (dataText && dataText.length > description.length) {
                description = dataText.trim();
              }
            }
          }
          
          // Fallback: Try to find ForwardRef component with content attribute
          if (!description && founderCard) {
            // Look for elements that might have the description in a content attribute
            const forwardRef = founderCard.querySelector('[content]') as HTMLElement;
            if (forwardRef) {
              const contentAttr = forwardRef.getAttribute('content');
              if (contentAttr && contentAttr.length > 20) {
                description = contentAttr;
              }
            }
          }
          
          // Fallback: Look for paragraph text in the founder card
          if (!description && founderCard) {
            const paragraphs = founderCard.querySelectorAll('p');
            for (const p of Array.from(paragraphs)) {
              const pText = p.textContent?.trim() || '';
              // If we're in Active Founders section, be more lenient - accept any descriptive text
              const isInFoundersSection = foundersHeading && foundersContainer && foundersContainer.contains(nameEl);
              
              if (pText.length > 20 && pText.length < 1000) {
                // Check if it looks like a bio/description
                const looksLikeBio = pText.includes('Prior') || 
                                    pText.includes('studied') || 
                                    pText.includes('worked') || 
                                    pText.includes('led') ||
                                    pText.includes('Building') ||
                                    pText.includes('Previously') ||
                                    pText.includes('Experience') ||
                                    pText.match(/\b(at|from|co-founded|founded)\b/i);
                
                // If in Active Founders section, accept any descriptive text
                // Otherwise, require "founder" keyword or bio-like content
                if (isInFoundersSection && looksLikeBio) {
                  description = pText;
                  break;
                } else if (!isInFoundersSection && 
                          (pText.includes('Co-founder') || pText.includes('Founder') || looksLikeBio)) {
                description = pText;
                break;
                }
              }
            }
          }
          
          // Additional fallback: Look for prose div in sibling or nearby elements
          if (!description && founderCard) {
            // Check next sibling
            let sibling = founderCard.nextElementSibling;
            if (sibling) {
              const siblingProse = sibling.querySelector('.prose.max-w-full.whitespace-pre-line') as HTMLElement;
              if (siblingProse) {
                description = siblingProse.innerText?.trim() || siblingProse.textContent?.trim() || '';
              }
            }
            
            // Check previous sibling
            if (!description) {
              sibling = founderCard.previousElementSibling;
              if (sibling) {
                const siblingProse = sibling.querySelector('.prose.max-w-full.whitespace-pre-line') as HTMLElement;
                if (siblingProse) {
                  description = siblingProse.innerText?.trim() || siblingProse.textContent?.trim() || '';
                }
              }
            }
          }
          
          // Additional fallback: Search in parent containers if we're in Active Founders section
          if (!description && founderCard && foundersHeading && foundersContainer) {
            let searchContainer: Element | null = founderCard.parentElement;
            let searchAttempts = 0;
            
            while (!description && searchContainer && searchAttempts < 3) {
              const paragraphs = searchContainer.querySelectorAll('p');
              for (const p of Array.from(paragraphs)) {
                const pText = p.textContent?.trim() || '';
                // Accept any descriptive text near the founder name in Active Founders section
                if (pText.length > 20 && pText.length < 1000 && 
                    (pText.includes('Building') || pText.includes('Prior') || 
                     pText.includes('studied') || pText.match(/\b(at|from)\b/i))) {
                  description = pText;
                  break;
                }
              }
              searchContainer = searchContainer.parentElement;
              searchAttempts++;
            }
          }
          
          // Extract LinkedIn link - look for LinkedIn link near this founder card
          // Use broader search when we're in the Active Founders section
          let linkedIn = '';
          if (founderCard) {
            // First try in the founder card itself
            let linkedInLink = founderCard.querySelector('a[href*="linkedin.com"]') as HTMLAnchorElement;
            
            // If not found, search in parent containers (broader search)
            if (!linkedInLink && foundersHeading) {
              let searchContainer: Element | null = founderCard.parentElement;
              let searchAttempts = 0;
              while (!linkedInLink && searchContainer && searchAttempts < 5) {
                linkedInLink = searchContainer.querySelector('a[href*="linkedin.com"]') as HTMLAnchorElement;
                searchContainer = searchContainer.parentElement;
                searchAttempts++;
              }
            }
            
            // If still not found and we're in Active Founders section, search more broadly
            if (!linkedInLink && foundersHeading && foundersContainer) {
              // Look for LinkedIn links near this name element in the founders container
              const nameElementParent = nameEl.parentElement;
              if (nameElementParent) {
                // Search in siblings and nearby elements
                const allLinks = foundersContainer.querySelectorAll('a[href*="linkedin.com"]');
                if (allLinks.length > 0) {
                  // Find the closest LinkedIn link to this name element
                  let closestLink: HTMLAnchorElement | null = null;
                  let closestDistance = Infinity;
                  
                  allLinks.forEach(link => {
                    const linkEl = link as HTMLAnchorElement;
                    const namePos = Array.from(nameEl.parentElement?.children || []).indexOf(nameEl.parentElement || nameEl);
                    const linkPos = Array.from(linkEl.parentElement?.children || []).indexOf(linkEl);
                    const distance = Math.abs(linkPos - namePos);
                    
                    if (distance < closestDistance) {
                      closestDistance = distance;
                      closestLink = linkEl;
                    }
                  });
                  
                  if (closestLink && closestDistance < 10) {
                    linkedInLink = closestLink;
                  }
                }
              }
            }
            
            if (linkedInLink) {
              linkedIn = linkedInLink.href;
            }
          }
          
          // Extract Twitter/X link - look for Twitter link in the same founder card container
          let twitterUrl = '';
          if (founderCard) {
            // Look for Twitter/X links in the founder card
            const twitterLinks = founderCard.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]');
            
            for (const twitterLink of Array.from(twitterLinks)) {
              const linkEl = twitterLink as HTMLAnchorElement;
              const href = linkEl.href;
              if (!href) continue;
              
              // Check if this is a founder Twitter link (not company Twitter)
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              const dataTooltipContent = linkEl.getAttribute('data-tooltip-content') || '';
              
              // Founder Twitter has data-tooltip-id containing "founder-social-tooltip" OR aria-label="Twitter account"
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                // Normalize URL - ensure it has https://
                let normalizedUrl = href;
                if (normalizedUrl.startsWith('//')) {
                  normalizedUrl = 'https:' + normalizedUrl;
                } else if (!normalizedUrl.startsWith('http')) {
                  normalizedUrl = 'https://' + normalizedUrl;
                }
                
                // Prefer x.com over twitter.com
                normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
                
                twitterUrl = normalizedUrl;
                break;
              }
            }
          }
          
          // Skip if this is the company name
          if (fullName.toLowerCase() === companyName) return;
          
          // Skip if name is too short or looks like a company name (single word, all caps, etc.)
          if (fullName.split(/\s+/).length < 2) return;
          if (fullName === fullName.toUpperCase() && fullName.length > 10) return; // Likely company name
          
          // Check if we're in the Active Founders section
          // Use more lenient check - if we found the heading and this name element is anywhere after it, trust it
          let isInFoundersSection = false;
          if (foundersHeading && foundersContainer) {
            // Check if nameEl is a descendant of foundersContainer
            isInFoundersSection = foundersContainer.contains(nameEl);
            
            // Also check if nameEl comes after foundersHeading in the DOM (broader check)
            if (!isInFoundersSection) {
              const namePos = Array.from(document.querySelectorAll('*')).indexOf(nameEl as Element);
              const headingPos = Array.from(document.querySelectorAll('*')).indexOf(foundersHeading);
              isInFoundersSection = namePos > headingPos && namePos < headingPos + 50; // Within 50 elements after heading
            }
          }
          
          const hasFounderDescription = description && (
            description.toLowerCase().includes('founder') || 
            description.toLowerCase().includes('co-founder')
          );
          
          // If we're in the Active Founders section, trust it - don't require "founder" in description
          // This fixes cases like mlop where description doesn't mention "founder" but we're clearly in the right section
          if (!isInFoundersSection && !hasFounderDescription) return;
          
          // Split name into first and last
          const nameParts = fullName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Create unique key for deduplication
          const founderKey = linkedIn || fullName.toLowerCase();
          
          // Skip if we've already seen this founder
          if (seenFounders.has(founderKey)) return;
          seenFounders.add(founderKey);
          
          // Only add if we have at least a first name
          if (firstName) {
            data.founders.push({
              firstName,
              lastName,
              linkedIn,
              twitterUrl: twitterUrl || undefined,
              description: description || undefined,
            });
          }
        });
      }
      
      // Enhanced Fallback 1: If we found Active Founders heading but no founders, use text-based extraction
      if (data.founders.length === 0 && foundersHeading) {
        // More aggressive text-based extraction - get all text after the heading
        let sectionText = '';
        let currentElement: Element | null = foundersHeading.nextElementSibling;
        
        // Collect text from the next several siblings
        for (let i = 0; i < 20 && currentElement; i++) {
          const text = currentElement.textContent?.trim() || '';
          if (text) {
            sectionText += ' ' + text;
          }
          currentElement = currentElement.nextElementSibling;
        }
        
        // Also try getting text from parent's children after the heading
        if (sectionText.length < 100 && foundersHeading.parentElement) {
          const parent = foundersHeading.parentElement;
          const headingIndex = Array.from(parent.children).indexOf(foundersHeading);
          const siblings = Array.from(parent.children).slice(headingIndex + 1, headingIndex + 10);
          
          for (const sibling of siblings) {
            const text = sibling.textContent?.trim() || '';
            if (text) {
              sectionText += ' ' + text;
            }
          }
        }
        
        // Extract all potential names using multiple patterns
        const namePatterns = [
          /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,  // "First Last" or "First Middle Last"
          /^([A-Z][a-z]+\s+[A-Z][a-z]+)$/gm,  // Standalone names on lines
        ];
        
        const foundNames = new Set<string>();
        
        for (const pattern of namePatterns) {
          const matches = sectionText.match(pattern);
          if (matches) {
            matches.forEach(match => {
              const name = match.trim();
              if (name.length >= 3 && name.length <= 100) {
                foundNames.add(name);
              }
            });
          }
        }
        
        // Process each found name
        for (const potentialName of foundNames) {
          const nameParts = potentialName.split(/\s+/);
          
          // Validate it looks like a name
          if (nameParts.length >= 2 && nameParts.length <= 4) {
            // Skip if it's the company name
            if (potentialName.toLowerCase() === companyName) continue;
            
            // Skip common words/phrases and launch post section headers
            const commonWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 'Team', 'Size',
                                'San Francisco', 'New York', 'Remote', 'United States',
                                'The Problem', 'Our Solution', 'The Solution', 'Our Team',
                                'Our Mission', 'Our Vision', 'The Challenge', 'The Opportunity',
                                'Key Features', 'Why Now', 'Market Opportunity', 'The Product',
                                'Our Approach', 'Why Us', 'Get Started'];
            if (commonWords.some(word => potentialName.toLowerCase().includes(word.toLowerCase()))) continue;
            
            // Skip if it's all caps (likely not a name)
            if (potentialName === potentialName.toUpperCase() && potentialName.length > 10) continue;
            
            // Look for LinkedIn link anywhere after the heading
            let linkedIn = '';
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            // Find LinkedIn links that appear after the Active Founders heading
            const headingIndex = Array.from(document.querySelectorAll('*')).indexOf(foundersHeading);
            for (const link of allLinkedInLinks) {
              const linkIndex = Array.from(document.querySelectorAll('*')).indexOf(link);
              if (linkIndex > headingIndex && linkIndex < headingIndex + 200) {
                // Check if this link might belong to this founder
                const linkContainer = link.closest('div, section, article');
                const linkText = linkContainer?.textContent || '';
                
                // If the name appears near this LinkedIn link, associate them
                if (linkText.toLowerCase().includes(potentialName.toLowerCase().split(' ')[0])) {
                  linkedIn = (link as HTMLAnchorElement).href;
                  break;
                }
              }
            }
            
            // Look for Twitter link anywhere after the heading (similar to LinkedIn)
            let twitterUrl = '';
            const allTwitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
            for (const link of allTwitterLinks) {
              const linkEl = link as HTMLAnchorElement;
              const linkHref = linkEl.href;
              if (!linkHref) continue;
              
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              
              // Check if this is a founder Twitter link
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                const linkIndex = Array.from(document.querySelectorAll('*')).indexOf(link);
                if (linkIndex > headingIndex && linkIndex < headingIndex + 200) {
                  const linkContainer = link.closest('div, section, article');
                  const linkText = linkContainer?.textContent || '';
                  
                  // If the name appears near this Twitter link, associate them
                  if (linkText.toLowerCase().includes(potentialName.toLowerCase().split(' ')[0])) {
                    let normalizedUrl = linkHref;
                    if (normalizedUrl.startsWith('//')) {
                      normalizedUrl = 'https:' + normalizedUrl;
                    } else if (!normalizedUrl.startsWith('http')) {
                      normalizedUrl = 'https://' + normalizedUrl;
                    }
                    normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
                    twitterUrl = normalizedUrl;
                    break;
                  }
                }
              }
            }
            
            // Extract description - look for text after the name that looks like a bio
            let description = '';
            const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(potentialName)) {
                // Look at lines after the name for description
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                  const line = lines[j];
                  if (line.length > 20 && line.length < 500 &&
                      line !== potentialName &&
                      !line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      (line.includes('Building') || line.includes('Prior') || 
                       line.includes('studied') || line.match(/\b(at|from|worked|led)\b/i))) {
                    description = line;
                    break;
                  }
                }
                break;
              }
            }
            
            const founderKey = linkedIn || potentialName.toLowerCase();
            
            if (!seenFounders.has(founderKey)) {
              seenFounders.add(founderKey);
              data.founders.push({
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(' '),
                linkedIn,
                twitterUrl: twitterUrl || undefined,
                description: description || undefined,
              });
            }
          }
        }
      }
      
      // Ultra-Simple Fallback 2: Direct line-by-line text extraction
      if (data.founders.length === 0) {
        // Get all text on the page, split into lines
        const bodyText = document.body.textContent || '';
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Look for "Active Founders" or just "Founders" in the lines
        let foundersSectionStart = -1;
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (lineLower.includes('active founders') || lineLower === 'founders') {
            foundersSectionStart = i;
            break;
          }
        }
        
        if (foundersSectionStart >= 0) {
          // Look at lines after the heading (skip the heading line itself)
          const sectionLines = lines.slice(foundersSectionStart + 1, foundersSectionStart + 30);
          
          for (let i = 0; i < sectionLines.length; i++) {
            const line = sectionLines[i];
            
            // Stop if we hit another section heading
            if (line.match(/^(Company|Location|Jobs|Team|Status|Founded|Website|Batch):?$/i)) break;
            
            // Pattern: Line is exactly "First Last" or "First Middle Last" (2-4 capitalized words)
            // This matches lines that are standalone names
            const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/);
            
            if (nameMatch) {
              const potentialName = nameMatch[1];
              const nameParts = potentialName.split(/\s+/);
              
              // Must be 2-4 words
              if (nameParts.length >= 2 && nameParts.length <= 4) {
                // Skip if it's the company name
                if (potentialName.toLowerCase() === companyName) continue;
                
                // Skip common section headings/words and launch post section headers
                const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location',
                                  'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                  'San Francisco', 'New York', 'Remote', 'United States',
                                  'The Problem', 'Our Solution', 'The Solution', 'Our Team',
                                  'Our Mission', 'Our Vision', 'The Challenge', 'The Opportunity',
                                  'Key Features', 'Why Now', 'Market Opportunity', 'The Product',
                                  'Our Approach', 'Why Us', 'Get Started'];
                const shouldSkip = skipWords.some(word => {
                  return potentialName.toLowerCase() === word.toLowerCase() ||
                         potentialName.toLowerCase().startsWith(word.toLowerCase() + ' ') ||
                         potentialName.toLowerCase().endsWith(' ' + word.toLowerCase());
                });
                
                if (shouldSkip) continue;
                
                // Extract description from next line if available
                let description = '';
                if (i + 1 < sectionLines.length) {
                  const nextLine = sectionLines[i + 1];
                  // If next line looks like a description (not another name, has descriptive words)
                  if (nextLine.length > 15 && nextLine.length < 500 &&
                      !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      !nextLine.match(/^(Company|Location|Jobs|Team|Status):?$/i) && // Not a heading
                      (nextLine.includes('Building') || 
                       nextLine.includes('Prior') || 
                       nextLine.includes('studied') ||
                       nextLine.match(/\b(at|from|worked|led|co-founded|founded)\b/i))) {
                    description = nextLine;
                  }
                }
                
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                const founderKey = potentialName.toLowerCase();
                
                if (!seenFounders.has(founderKey)) {
                  seenFounders.add(founderKey);
                  data.founders.push({
                    firstName,
                    lastName,
                    linkedIn: '',
                    twitterUrl: undefined,
                    description: description || undefined,
                  });
                }
              }
            }
          }
          
          // Try to associate LinkedIn links with found founders
          if (data.founders.length > 0) {
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            for (const link of allLinkedInLinks) {
              const linkElement = link as HTMLAnchorElement;
              const linkHref = linkElement.href;
              
              // Skip navigation/footer links
              const parent = link.closest('nav, footer, header');
              if (parent) continue;
              
              // Get container text around the link
              const linkContainer = link.closest('div, section, article, p');
              const containerText = (linkContainer?.textContent || '').toLowerCase();
              
              // Try to match with a founder
              for (const founder of data.founders) {
                if (!founder.linkedIn && containerText.includes(founder.firstName.toLowerCase())) {
                  founder.linkedIn = linkHref;
                  break;
                }
              }
            }
            
            // Try to associate Twitter links with found founders
            const allTwitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
            for (const link of allTwitterLinks) {
              const linkEl = link as HTMLAnchorElement;
              const linkHref = linkEl.href;
              if (!linkHref) continue;
              
              // Skip navigation/footer links
              const parent = link.closest('nav, footer, header');
              if (parent) continue;
              
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              
              // Check if this is a founder Twitter link
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                const linkContainer = link.closest('div, section, article, p');
                const containerText = (linkContainer?.textContent || '').toLowerCase();
                
                // Try to match with a founder
                for (const founder of data.founders) {
                  if (!founder.twitterUrl && containerText.includes(founder.firstName.toLowerCase())) {
                    let normalizedUrl = linkHref;
                    if (normalizedUrl.startsWith('//')) {
                      normalizedUrl = 'https:' + normalizedUrl;
                    } else if (!normalizedUrl.startsWith('http')) {
                      normalizedUrl = 'https://' + normalizedUrl;
                    }
                    normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
                    founder.twitterUrl = normalizedUrl;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Ultra-Simple Fallback: Direct text extraction from page body
      if (data.founders.length === 0) {
        // Get all text from the page
        const bodyText = document.body.textContent || '';
        const bodyLower = bodyText.toLowerCase();
        
        // Find "Active Founders" in text
        const activeFoundersIndex = bodyLower.indexOf('active founders');
        const foundersIndex = activeFoundersIndex >= 0 ? activeFoundersIndex : bodyLower.indexOf('founders');
        
        if (foundersIndex >= 0) {
          // Get text after "Active Founders" or "Founders"
          const afterFounders = bodyText.slice(foundersIndex);
          const lines = afterFounders.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          // Look through first 30 lines after heading
          for (let i = 1; i < Math.min(31, lines.length); i++) {
            const line = lines[i];
            
            // Skip empty lines, common headings
            if (line.length < 3) continue;
            if (line.toLowerCase().includes('company') || 
                line.toLowerCase().includes('location') ||
                line.toLowerCase().includes('jobs')) break; // Stop if we hit another section
            
            // Pattern: Line contains just "First Last" (two capitalized words, possibly with middle name)
            const simpleNamePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/;
            const nameMatch = line.match(simpleNamePattern);
            
            if (nameMatch) {
              const fullName = nameMatch[1];
              const nameParts = fullName.split(/\s+/);
              
              // Must be 2-4 words (First Last or First Middle Last)
              if (nameParts.length >= 2 && nameParts.length <= 4) {
                // Skip if company name
                if (fullName.toLowerCase() === companyName) continue;
                
                // Skip common non-name words and launch post section headers
                const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 'Team', 'Size',
                                 'San Francisco', 'New York', 'Remote', 'United States', 'Founded',
                                 'Website', 'Jobs', 'Batch', 'Status', 'The Problem', 'Our Solution',
                                 'The Solution', 'Our Team', 'Our Mission', 'Our Vision', 'The Challenge',
                                 'The Opportunity', 'Key Features', 'Why Now', 'Market Opportunity',
                                 'The Product', 'Our Approach', 'Why Us', 'Get Started'];
                if (skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) continue;
                
                // Extract description from next line if it looks like a bio
                let description = '';
                if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1];
                  if (nextLine.length > 15 && nextLine.length < 500 &&
                      !nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/) && // Not another name
                      (nextLine.includes('Building') || 
                       nextLine.includes('Prior') || 
                       nextLine.includes('studied') ||
                       nextLine.match(/\b(at|from|worked|led|co-founded)\b/i))) {
                    description = nextLine;
                  }
                }
                
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                const founderKey = fullName.toLowerCase();
                
                if (!seenFounders.has(founderKey)) {
                  seenFounders.add(founderKey);
                  data.founders.push({
                    firstName,
                    lastName,
                    linkedIn: '',
                    twitterUrl: undefined,
                    description: description || undefined,
                  });
                }
              }
            }
          }
          
          // Try to associate LinkedIn links
          if (data.founders.length > 0) {
            const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
            
            for (const link of allLinkedInLinks) {
              const linkElement = link as HTMLAnchorElement;
              const linkHref = linkElement.href;
              
              // Get text around the link
              const linkContainer = link.closest('div, section, article, p');
              const containerText = (linkContainer?.textContent || '').toLowerCase();
              
              for (const founder of data.founders) {
                if (!founder.linkedIn && containerText.includes(founder.firstName.toLowerCase())) {
                  founder.linkedIn = linkHref;
                  break;
                }
              }
            }
            
            // Try to associate Twitter links with found founders
            const allTwitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
            for (const link of allTwitterLinks) {
              const linkEl = link as HTMLAnchorElement;
              const linkHref = linkEl.href;
              if (!linkHref) continue;
              
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              
              // Check if this is a founder Twitter link
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                const linkContainer = link.closest('div, section, article, p');
                const containerText = (linkContainer?.textContent || '').toLowerCase();
                
                for (const founder of data.founders) {
                  if (!founder.twitterUrl && containerText.includes(founder.firstName.toLowerCase())) {
                    let normalizedUrl = linkHref;
                    if (normalizedUrl.startsWith('//')) {
                      normalizedUrl = 'https:' + normalizedUrl;
                    } else if (!normalizedUrl.startsWith('http')) {
                      normalizedUrl = 'https://' + normalizedUrl;
                    }
                    normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
                    founder.twitterUrl = normalizedUrl;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Fallback 3: If still no founders found, try finding by LinkedIn links
      if (data.founders.length === 0) {
        const allLinkedInLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
        
        allLinkedInLinks.forEach(link => {
          const linkedIn = (link as HTMLAnchorElement).href;
          
          // Skip if we've already seen this LinkedIn
          if (seenFounders.has(linkedIn)) return;
          
          // Skip if it's in navigation or footer
          const parent = link.closest('nav, footer, header');
          if (parent) return;
          
          // Find nearby name - look for text-xl font-bold div
          const container = link.closest('div, section, article') || link.parentElement;
          if (!container) return;
          
          const nameEl = container.querySelector('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]') as HTMLElement;
          if (nameEl) {
            const fullName = nameEl.textContent?.trim() || '';
            
            // Skip if this is the company name
            if (fullName.toLowerCase() === companyName) return;
            
            // Skip if name is too short or looks like company name
            if (fullName.split(/\s+/).length < 2) return;
            if (fullName === fullName.toUpperCase() && fullName.length > 10) return;
            
            if (fullName && fullName.length > 3 && fullName.length < 100) {
              const nameParts = fullName.trim().split(/\s+/);
              if (nameParts.length >= 2) {
                // Try to find description
                const proseDiv = container.querySelector('.prose.max-w-full.whitespace-pre-line') as HTMLElement;
                const description = proseDiv?.textContent?.trim() || undefined;
                
                // Only add if description mentions founder
                if (description && description.toLowerCase().includes('founder')) {
                  seenFounders.add(linkedIn);
                  
                  data.founders.push({
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    linkedIn,
                    twitterUrl: undefined,
                    description,
                  });
                }
              }
            }
          }
        });
      }
      
      // Final deduplication pass - remove any remaining duplicates
      const uniqueFounders: typeof data.founders = [];
      const seenKeys = new Set<string>();
      
      for (const founder of data.founders) {
        const key = founder.linkedIn || `${founder.firstName} ${founder.lastName}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueFounders.push(founder);
        }
      }
      
      data.founders = uniqueFounders;

      // ============================================
      // 1.5. EXTRACT FOUNDER PROFILE PICTURES
      // ============================================
      // Extract profile pictures from bookface-images URLs by matching alt text to founder names
      // STRICT: Only extract from the "Active Founders" section
      if (data.founders.length > 0) {
        // STRICT: Find the "Active Founders" section using the specific DOM structure
        const foundersSection = Array.from(document.querySelectorAll('section')).find(section => {
          const classes = section.className || '';
          const text = section.textContent?.toLowerCase() || '';
          // Match the specific section: has the border-retro-sectionBorder class AND contains "active founders"
          return (classes.includes('border-retro-sectionBorder') || 
                  (classes.includes('relative') && classes.includes('isolate'))) &&
                 text.includes('active founders');
        }) as HTMLElement | undefined;
        
        if (!foundersSection) {
          console.log('   ⚠️  Could not find Active Founders section for profile pictures');
        } else {
          // STRICT: Only search for images WITHIN the founders section
          const allImages = Array.from(foundersSection.querySelectorAll('img[src*="bookface-images"]')) as HTMLImageElement[];
          
          // Filter out logos - keep only avatar images
          const avatarImages = allImages.filter(img => {
            const src = img.src || '';
            const altText = (img.alt || '').toLowerCase();
            
            // Skip logos - they're in small_logos or /logos/ paths
            if (src.includes('small_logos') || src.includes('/logos/') || altText.includes('logo')) {
              return false;
            }
            
            // Keep avatars (usually in /avatars/ path or have alt text with a name)
            // Alt text should be a reasonable name length (2-50 chars) and look like a name
            const isAvatar = src.includes('/avatars/');
            const hasNameLikeAlt = altText.length >= 2 && 
                                  altText.length <= 50 && 
                                  !altText.includes('http') &&
                                  /^[A-Za-z\s\.\-\']+$/.test(img.alt || ''); // Looks like a name
            
            return isAvatar || hasNameLikeAlt;
          });
          
          // Track which images have been assigned to avoid duplicates
          const assignedImages = new Set<string>();
          
          for (const founder of data.founders) {
            const fullName = `${founder.firstName} ${founder.lastName}`.trim();
            const firstName = founder.firstName.toLowerCase().trim();
            const lastName = founder.lastName.toLowerCase().trim();
            const fullNameLower = fullName.toLowerCase();
            
            // Try to find matching image by alt text - be more flexible with matching
            for (const img of avatarImages) {
              const altText = (img.alt || '').trim(); // Keep original case
              const altTextLower = altText.toLowerCase();
              const src = img.src || '';
              
              // Skip if already assigned to another founder
              if (!src || src.length === 0 || assignedImages.has(src)) continue;
              
              // More flexible matching:
              // 1. Exact match (case-insensitive) - "Juan Casian" matches "Juan Casian"
              // 2. Contains both first and last name
              // 3. First name matches exactly and alt looks like a name
              const exactMatch = altTextLower === fullNameLower;
              const containsBothNames = firstName && lastName && 
                                        altTextLower.includes(firstName) && 
                                        altTextLower.includes(lastName);
              
              // Also try matching with different name formats
              const nameVariations = [
                fullNameLower,
                `${firstName} ${lastName}`,
                `${lastName}, ${firstName}`, // "Casian, Juan"
                `${firstName}${lastName}`, // No space
                `${lastName} ${firstName}`, // Reversed
              ];
              
              const matchesVariation = nameVariations.some(variation => 
                altTextLower === variation || 
                altTextLower.startsWith(variation + ' ') || 
                altTextLower.endsWith(' ' + variation)
              );
              
              // Also check if alt text is just the first name (if it's short and looks like a name)
              const firstNameOnlyMatch = firstName && 
                                         altTextLower === firstName && 
                                         altText.length < 20 && 
                                         /^[A-Za-z\s]+$/.test(altText);
              
              if (exactMatch || containsBothNames || matchesVariation || firstNameOnlyMatch) {
                founder.profilePicture = src;
                assignedImages.add(src);
                break; // Found match, move to next founder
              }
            }
            
            // If no match found by alt text, try to find by proximity to founder name element
            // STRICT: Only search within the founders section
            if (!founder.profilePicture) {
              // Find the founder's name element within the founders section
              const nameElements = Array.from(foundersSection.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.trim() || '';
                return text === fullName || 
                       (text.includes(firstName) && text.includes(lastName)) ||
                       text.toLowerCase() === fullNameLower;
              });
              
              for (const nameEl of nameElements) {
                // Look in the same card/container as the name - use more specific selectors
                // STRICT: Make sure we're still within the founders section
                const container = nameEl.closest('div.ycdc-card-new, div[class*="ycdc-card"], div[class*="card"], div[class*="founder"], section, article, div') || nameEl.parentElement;
                if (container && foundersSection.contains(container)) {
                  const nearbyImages = container.querySelectorAll('img[src*="bookface-images"]') as NodeListOf<HTMLImageElement>;
                  for (const img of Array.from(nearbyImages)) {
                    const src = img.src || '';
                    // Skip logos
                    if (src.includes('small_logos') || src.includes('/logos/')) continue;
                    
                    // Skip if already assigned
                    if (assignedImages.has(src)) continue;
                    
                    // STRICT: Double-check the image is within the founders section
                    if (!foundersSection.contains(img)) continue;
                    
                    // If we find an image in the same container as the name, it's likely the founder's picture
                    founder.profilePicture = src;
                    assignedImages.add(src);
                    break;
                  }
                  if (founder.profilePicture) break;
                }
              }
            }
          }
        }
      }

      // ============================================
      // 1.6. EXTRACT YC COMPANY DESCRIPTION
      // ============================================
      // Extract the main company description from the prose div BEFORE founders section
      // This is the div.prose.max-w-full.whitespace-pre-line that appears before "Active Founders"
      try {
        // First, find where the "Active Founders" section starts
        const allElements = Array.from(document.querySelectorAll('*'));
        const foundersHeading = allElements.find(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'active founders' ||
                 text.toLowerCase().includes('active founders') ||
                 text.toLowerCase() === 'founders';
        });
        
        // Find the company link/header to locate description nearby
        const companyLink = document.querySelector('a[href*="/companies/"]') as HTMLElement;
        
        // Find ALL divs with the exact classes: prose max-w-full whitespace-pre-line
        // Try multiple approaches since React might render classes differently
        // Define selectors inline since proseSelectors was not defined
        const proseSelectors = [
          'div.prose.max-w-full.whitespace-pre-line',
          'div.prose.whitespace-pre-line',
          'div[class*="prose"][class*="whitespace-pre-line"]',
        ];
        let proseDivs: HTMLElement[] = [];
        for (const selector of proseSelectors) {
          try {
            const found = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
            if (found.length > 0) {
              proseDivs = found;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (proseDivs.length > 0) {
          // If we found a founders heading, only get prose divs that appear BEFORE it
          let targetProseDiv: HTMLElement | null = null;
          
          if (foundersHeading) {
            // Get all elements in document order
            const allDocElements = Array.from(document.querySelectorAll('*'));
            const foundersHeadingIndex = allDocElements.indexOf(foundersHeading);
            
            // Find the first prose div that appears before the founders heading
            for (const proseDiv of proseDivs) {
              const proseDivIndex = allDocElements.indexOf(proseDiv);
              
              // Only consider prose divs that come before the founders section
              if (proseDivIndex < foundersHeadingIndex) {
                // Check that this prose div is not within a founder card
                // (founder cards also have prose divs for descriptions)
                const closestContainer = proseDiv.closest('div, section, article');
                const isInFounderCard = closestContainer?.querySelector('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"], h2, h3, h4');
                
                // Also check if it's near founder images
                const hasFounderImages = closestContainer?.querySelector('img[src*="bookface-images"]');
                
                // If it's not in a founder card area and doesn't have founder images nearby, it's likely the company description
                if (!isInFounderCard && !hasFounderImages) {
                  targetProseDiv = proseDiv;
                  break; // Use the first valid one
                }
              }
            }
          } else {
            // No founders heading found, use the first prose div that's not in a founder context
            for (const proseDiv of proseDivs) {
              // Check that this prose div is not within a founder card
              const closestContainer = proseDiv.closest('div, section, article');
              const isInFounderCard = closestContainer?.querySelector('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"], h2, h3, h4');
              const hasFounderImages = closestContainer?.querySelector('img[src*="bookface-images"]');
              
              if (!isInFounderCard && !hasFounderImages) {
                targetProseDiv = proseDiv;
                break;
              }
            }
          }
          
          if (targetProseDiv) {
            // Extract text directly from the div
            let descriptionText = targetProseDiv.textContent?.trim() || targetProseDiv.innerText?.trim() || '';
            
            // Clean up whitespace (normalize multiple spaces to single space)
            descriptionText = descriptionText.replace(/\s+/g, ' ').trim();
            
            // Validate it's a reasonable company description (at least 100 chars, not too long)
            if (descriptionText && descriptionText.length >= 100 && descriptionText.length <= 2000) {
              // Make sure it doesn't contain founder-specific keywords that might indicate bleeding
              const lowerText = descriptionText.toLowerCase();
              const hasFounderKeywords = (lowerText.includes('prior to') || lowerText.includes('before')) && 
                                        (lowerText.includes('co-founded') || lowerText.includes('founded') || lowerText.includes('worked at') || lowerText.includes('was at'));
              
              // Exclude navigation/footer text patterns
              const isNavigationText = lowerText.includes('startup directory') ||
                                      lowerText.includes('founder directory') ||
                                      lowerText.includes('launch yc') ||
                                      (lowerText.includes('companies') && descriptionText.length < 200) ||
                                      lowerText.split(/\s+/).length < 10;
              
              // If it doesn't have founder keywords and isn't navigation text, it's likely the company description
              if (!hasFounderKeywords && !isNavigationText) {
                data.ycDescription = descriptionText;
              }
            }
          }
        }
      } catch (descError) {
        // Ignore errors in description extraction
        // Don't log warnings as it's expected that some pages might not have this
      }

      // ============================================
      // 2. EXTRACT WEBSITE
      // ============================================
      // Look for external website links - YC pages typically show the company website prominently
      const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
      const excludedDomains = ['ycombinator.com', 'linkedin.com', 'twitter.com', 'x.com', 
                                'facebook.com', 'instagram.com', 'github.com', 'youtube.com'];
      
      for (const link of allLinks) {
        try {
          const href = (link as HTMLAnchorElement).href;
          if (!href) continue;
          
          // Skip excluded domains
          if (excludedDomains.some(domain => href.includes(domain))) continue;
          
          // Look for common TLDs
          if (href.match(/\.(com|io|ai|co|org|net|dev|app|tech)(\/|$)/i)) {
            // Prefer links that are visible and in main content (not nav/footer)
            const parent = link.closest('nav, footer, header');
            if (!parent) {
              data.website = href;
              break;
            }
          }
        } catch (linkError) {
          continue;
        }
      }

      // ============================================
      // 2.5. EXTRACT COMPANY TWITTER
      // ============================================
      // Extract from social media icons section (same area as website and LinkedIn)
      const twitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
      
      for (const link of twitterLinks) {
        try {
          const href = (link as HTMLAnchorElement).href;
          if (!href) continue;
          
          // Skip if in nav/footer
          const parent = link.closest('nav, footer, header');
          if (parent) continue;
          
          // Check for company Twitter indicators
          const ariaLabel = link.getAttribute('aria-label') || '';
          const dataTooltip = link.getAttribute('data-tooltip-content') || '';
          const dataTooltipId = link.getAttribute('data-tooltip-id') || '';
          
          // Company Twitter has aria-label containing "X" or "Twitter" (but not "founder-social-tooltip")
          const isCompanyTwitter = (
            (ariaLabel.toLowerCase().includes('x') || ariaLabel.toLowerCase().includes('twitter')) &&
            !dataTooltipId.includes('founder-social-tooltip') &&
            (dataTooltip === 'X' || ariaLabel.toLowerCase().includes('twitter'))
          );
          
          if (isCompanyTwitter) {
            // Normalize URL - ensure it has https://
            let normalizedUrl = href;
            if (normalizedUrl.startsWith('//')) {
              normalizedUrl = 'https:' + normalizedUrl;
            } else if (!normalizedUrl.startsWith('http')) {
              normalizedUrl = 'https://' + normalizedUrl;
            }
            
            // Prefer x.com over twitter.com (Twitter rebranded to X)
            normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
            
            data.companyTwitterUrl = normalizedUrl;
            break;
          }
        } catch (linkError) {
          continue;
        }
      }

      // ============================================
      // 3. EXTRACT TEAM SIZE
      // ============================================
      const bodyTextForTeamSize = document.body.innerText || '';
      const teamSizePatterns = [
        /team\s+size[:\s]+(\d+)/i,
        /(\d+)\s+employees/i,
        /team\s+of\s+(\d+)/i,
      ];
      
      for (const pattern of teamSizePatterns) {
        const match = bodyTextForTeamSize.match(pattern);
        if (match && match[1]) {
          data.teamSize = match[1];
          break;
        }
      }

      // ============================================
      // 4. EXTRACT JOBS (from main page)
      // ============================================
      // Look for "Jobs" tab or section
      const jobsHeading = Array.from(document.querySelectorAll('h2, h3, button, [role="tab"]'))
        .find(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('jobs') && !text.includes('guide');
        });
      
      if (jobsHeading) {
        // Find job listings near the heading
        const container = jobsHeading.closest('section, div, [role="tabpanel"]') || 
                         jobsHeading.parentElement;
        
        if (container) {
          // Look for job title patterns - typically in headings or links
          const jobElements = container.querySelectorAll('h3, h4, h5, a, div[class*="job"]');
          
          jobElements.forEach(jobEl => {
            const text = jobEl.textContent?.trim() || '';
            
            // Job titles are typically 5-80 characters, not navigation text
            if (text.length >= 5 && 
                text.length <= 80 &&
                !text.match(/^(view|apply|see|all|jobs?)$/i) &&
                !text.includes('View all') &&
                !text.includes('Apply Now') &&
                !text.includes('Jobs at')) {
              
              // Check if it looks like a job title (has common job words or is in a job container)
              const isJobTitle = /engineer|developer|designer|manager|director|lead|intern|analyst|scientist|specialist/i.test(text) ||
                                jobEl.closest('[class*="job"], [class*="position"], [class*="opening"]');
              
              if (isJobTitle) {
                // Extract location if present in the same element or nearby
                const parentText = jobEl.parentElement?.textContent || '';
                const locationMatch = parentText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*),\s*(United States|US|USA|California|New York|Texas)/);
                const location = locationMatch ? locationMatch[0] : undefined;
                
                // Extract description from nearby paragraph
                const descEl = jobEl.parentElement?.querySelector('p');
                const description = descEl?.textContent?.trim() || '';
                
                data.jobPostings.push({
                  title: text,
                  description: description.substring(0, 500),
                  location: location,
                });
              }
            }
          });
        }
      }

      // ============================================
      // 5. EXTRACT LOCATION
      // ============================================
      const locationPatterns = [
        /location[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
        /based\s+in[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
        /headquarters[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z]+)?)/i,
      ];
      
      for (const pattern of locationPatterns) {
        const match = bodyText.match(pattern);
        if (match && match[1]) {
          const loc = match[1].trim();
          // Filter out obviously wrong matches
          if (loc.length > 3 && loc.length < 100 && !loc.includes('http')) {
            data.location = loc;
            break;
          }
        }
      }

      // ============================================
      // 6. EXTRACT FUNDING DATA
      // ============================================
      // Look for funding information (LinkedIn-style pattern)
      try {
        // Pattern 1: Look for funding amount in text-display-lg class (LinkedIn pattern)
        const fundingAmountEl = document.querySelector('p.text-display-lg, p[class*="text-display-lg"]') as HTMLElement;
        if (fundingAmountEl) {
          const amountText = fundingAmountEl.textContent?.trim() || '';
          // Match patterns like "US$ 500.0K", "$20M", "$1.5M", etc.
          const amountMatch = amountText.match(/(?:US\$|USD\$|\$)?\s*([\d.,]+[KMB]?)/i);
          if (amountMatch) {
            data.fundingAmount = amountText.trim();
          }
        }
        
        // Pattern 2: Look for funding round and date in link-styled elements (LinkedIn pattern)
        const fundingLink = Array.from(document.querySelectorAll('a[class*="link-styled"], a[class*="text-sm"]'))
          .find(link => {
            const text = link.textContent?.toLowerCase() || '';
            return text.includes('seed') || 
                   text.includes('series') || 
                   text.includes('pre-seed') ||
                   text.includes('round') ||
                   (text.match(/\d{4}/) && (text.includes('jan') || text.includes('feb') || text.includes('mar') || 
                    text.includes('apr') || text.includes('may') || text.includes('jun') ||
                    text.includes('jul') || text.includes('aug') || text.includes('sep') ||
                    text.includes('oct') || text.includes('nov') || text.includes('dec')));
          }) as HTMLAnchorElement;
        
        if (fundingLink) {
          const fundingText = fundingLink.textContent?.trim() || '';
          
          // Extract round type (Pre seed, Seed, Series A, etc.)
          const roundMatch = fundingText.match(/(pre[- ]?seed|seed|series\s+[a-z]|angel|bridge|convertible|grant)/i);
          if (roundMatch) {
            data.roundType = roundMatch[1].trim();
          }
          
          // Extract date (e.g., "Oct 9, 2025", "2025-10-09")
          const dateMatch = fundingText.match(/([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            data.fundingDate = dateMatch[1].trim();
          }
        }
        
        // Pattern 3: Look for "Funding" section header and extract nearby data
        const fundingSection = Array.from(document.querySelectorAll('h2, h3'))
          .find(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('funding');
          });
        
        if (fundingSection && !data.fundingAmount) {
          const container = fundingSection.closest('section, div') || fundingSection.parentElement;
          if (container) {
            // Look for amount in the container
            const containerText = container.textContent || '';
            const amountMatch = containerText.match(/(?:US\$|USD\$|\$)?\s*([\d.,]+[KMB]?)/i);
            if (amountMatch) {
              data.fundingAmount = amountMatch[0].trim();
            }
            
            // Look for round type
            if (!data.roundType) {
              const roundMatch = containerText.match(/(pre[- ]?seed|seed|series\s+[a-z]|angel|bridge|convertible|grant)/i);
              if (roundMatch) {
                data.roundType = roundMatch[1].trim();
              }
            }
            
            // Look for date
            if (!data.fundingDate) {
              const dateMatch = containerText.match(/([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                data.fundingDate = dateMatch[1].trim();
              }
            }
          }
        }
      } catch (fundingError) {
        // Funding extraction failed, continue
      }

      // ============================================
      // 7. EXTRACT ONE-LINE SUMMARY / DESCRIPTION
      // ============================================
      // Try multiple strategies to find the company description
      
      // Strategy 1: Meta description
      const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (metaDesc?.content && metaDesc.content.length > 20) {
        data.oneLineSummary = metaDesc.content.trim();
      }
      
      // Strategy 2: First paragraph after h1 (company name)
      if (!data.oneLineSummary) {
        const h1 = document.querySelector('h1');
        if (h1) {
          let next = h1.nextElementSibling;
          while (next && !data.oneLineSummary) {
            if (next.tagName === 'P' || next.tagName === 'DIV') {
              const text = next.textContent?.trim() || '';
              if (text.length > 20 && text.length < 500) {
                data.oneLineSummary = text;
                break;
              }
            }
            next = next.nextElementSibling;
          }
        }
      }
      
      // Strategy 3: Look for description in main content area
      if (!data.oneLineSummary) {
        const mainContent = document.querySelector('main, [role="main"], article') || document.body;
        const paragraphs = mainContent.querySelectorAll('p');
        
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          // Good description is usually 50-400 chars, not too short, not too long
          if (text.length >= 50 && text.length <= 400 && 
              !text.includes('Apply') && 
              !text.includes('View') &&
              !text.includes('LinkedIn')) {
            data.oneLineSummary = text;
            break;
          }
        }
      }

      // ============================================
      // 8. EXTRACT LAUNCH/FOUNDED DATE
      // ============================================
      // Look for patterns like "Founded: 2024", "Launched: 2024", "Established: 2024"
      try {
        const bodyText = document.body.textContent || '';
        
        // Pattern 1: Look for "Founded: YYYY" or "Launched: YYYY"
        const foundedMatch = bodyText.match(/(?:Founded|Launched|Established):\s*(\d{4})/i);
        if (foundedMatch) {
          data.launchDate = foundedMatch[1];
        } else {
          // Pattern 2: Look for "Founded YYYY" or "Launched YYYY" (without colon)
          const foundedMatch2 = bodyText.match(/(?:Founded|Launched|Established)\s+(\d{4})/i);
          if (foundedMatch2) {
            data.launchDate = foundedMatch2[1];
          } else {
            // Pattern 3: Look for date patterns near "founded" or "launch" keywords
            const foundedContext = bodyText.match(/(?:founded|launched|established)[^.]{0,50}(\d{4})/i);
            if (foundedContext) {
              const year = parseInt(foundedContext[1]);
              // Only accept reasonable years (2000-2030)
              if (year >= 2000 && year <= 2030) {
                data.launchDate = foundedContext[1];
              }
            }
          }
        }
      } catch (launchDateError) {
        // Launch date extraction failed, continue
      }

      // ============================================
      // 9. EXTRACT TAGS (Technology/Skills, excluding locations)
      // ============================================
      // YC pages display tags as clickable elements, often in a tags/badges section
      // We need to extract all tags and filter out location tags
      
      const allTags: string[] = [];
      
      // Strategy 1: Look for links to /tags/ or /tag/ pages (most reliable)
      const tagLinks = document.querySelectorAll('a[href*="/tags/"], a[href*="/tag/"]');
      for (const link of Array.from(tagLinks)) {
        const href = (link as HTMLAnchorElement).href;
        const tagText = link.textContent?.trim() || '';
        
        // Extract tag from URL (most reliable)
        if (href) {
          const urlMatch = href.match(/\/tags?\/([^/?]+)/);
          if (urlMatch && urlMatch[1]) {
            const tagFromUrl = decodeURIComponent(urlMatch[1])
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            if (tagFromUrl && tagFromUrl.length > 1 && !allTags.includes(tagFromUrl)) {
              allTags.push(tagFromUrl);
            }
          }
        }
        
        // Also use link text if available and different from URL
        // Skip if it's pure numbers (likely an index or count, not a tag)
        if (tagText && !/^\d+$/.test(tagText) && tagText.length > 1 && tagText.length < 50 && !allTags.includes(tagText)) {
          allTags.push(tagText);
        }
      }
      
      // Strategy 2: Look for elements with tag-related classes (broader search)
      const tagClassSelectors = [
        '[class*="tag"]',
        '[class*="Tag"]',
        '[class*="badge"]',
        '[class*="Badge"]',
        '[class*="chip"]',
        '[class*="Chip"]',
        '[class*="label"]',
        '[class*="Label"]',
        '[class*="pill"]',
        '[class*="Pill"]',
      ];
      
      for (const selector of tagClassSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            const tagText = element.textContent?.trim() || '';
            // Skip if it's a link (already handled above)
            if (element.tagName === 'A') continue;
            // Skip if it contains a link (likely navigation)
            if (element.querySelector('a')) continue;
            // Skip if it's pure numbers or mostly numbers
            if (/^\d+$/.test(tagText) || (tagText.match(/\d/g) || []).length / tagText.length > 0.7) {
              continue;
            }
            // Skip if it's too long (likely not a tag)
            if (tagText && tagText.length > 1 && tagText.length < 50) {
              const normalized = tagText.replace(/\s+/g, ' ').trim();
              if (normalized && !allTags.includes(normalized)) {
                allTags.push(normalized);
              }
            }
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      
      // Strategy 3: Look for buttons or clickable elements that might be tags
      const clickableElements = document.querySelectorAll('button, [role="button"], [onclick]');
      for (const element of Array.from(clickableElements)) {
        const tagText = element.textContent?.trim() || '';
        // Skip if it's pure numbers or mostly numbers
        if (/^\d+$/.test(tagText) || (tagText.match(/\d/g) || []).length / tagText.length > 0.7) {
          continue;
        }
        // Check if it looks like a tag (short, single word or short phrase)
        if (tagText && tagText.length > 1 && tagText.length < 30 && 
            tagText.split(/\s+/).length <= 3 && 
            !tagText.match(/^(click|view|see|more|less|show|hide|expand|collapse)$/i)) {
          const normalized = tagText.replace(/\s+/g, ' ').trim();
          if (normalized && !allTags.includes(normalized)) {
            allTags.push(normalized);
          }
        }
      }
      
      // Strategy 4: Look for data attributes that might contain tags
      const elementsWithDataTags = document.querySelectorAll('[data-tag], [data-keyword], [data-category]');
      for (const element of Array.from(elementsWithDataTags)) {
        const dataTag = element.getAttribute('data-tag') || 
                       element.getAttribute('data-keyword') || 
                       element.getAttribute('data-category');
        // Skip if it's pure numbers (likely an ID, not a tag)
        if (dataTag && !/^\d+$/.test(dataTag) && dataTag.length > 1 && dataTag.length < 50 && !allTags.includes(dataTag)) {
          allTags.push(dataTag);
        }
      }
      
      // Filter out location tags and keep only technology/skill tags
      // Location detection: common city names, country names, state abbreviations, etc.
      const locationKeywords = [
        // Major cities
        'san francisco', 'new york', 'los angeles', 'chicago', 'boston', 'seattle',
        'austin', 'denver', 'atlanta', 'miami', 'dallas', 'philadelphia', 'phoenix',
        'london', 'paris', 'berlin', 'tokyo', 'sydney', 'toronto', 'vancouver',
        'amsterdam', 'dublin', 'stockholm', 'copenhagen', 'zurich', 'singapore',
        'hong kong', 'tel aviv', 'bangalore', 'mumbai', 'delhi', 'sao paulo',
        'mexico city', 'buenos aires', 'santiago', 'bogota', 'lima',
        // US States
        'california', 'new york', 'texas', 'florida', 'illinois', 'massachusetts',
        'washington', 'colorado', 'georgia', 'north carolina', 'virginia',
        // Countries
        'usa', 'united states', 'united kingdom', 'uk', 'canada', 'australia',
        'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium',
        'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria',
        'poland', 'portugal', 'greece', 'ireland', 'israel', 'japan', 'china',
        'india', 'brazil', 'mexico', 'argentina', 'chile', 'colombia',
        // State abbreviations
        'ca', 'ny', 'tx', 'fl', 'il', 'ma', 'wa', 'co', 'ga', 'nc', 'va',
        // Common location phrases
        'remote', 'hybrid', 'onsite', 'on-site', 'united states', 'united kingdom',
        'san francisco bay area', 'silicon valley', 'bay area', 'new york city',
        'greater boston', 'greater seattle', 'greater chicago',
      ];
      
      // Technology/skill keywords that indicate tech tags (not locations)
      const techKeywords = [
        'ai', 'ml', 'machine learning', 'deep learning', 'neural network',
        'python', 'javascript', 'typescript', 'react', 'vue', 'angular',
        'node', 'java', 'c++', 'c#', 'go', 'rust', 'swift', 'kotlin',
        'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'terraform',
        'blockchain', 'crypto', 'web3', 'defi', 'nft', 'ethereum', 'bitcoin',
        'saas', 'api', 'rest', 'graphql', 'microservices', 'serverless',
        'mobile', 'ios', 'android', 'react native', 'flutter',
        'data science', 'analytics', 'big data', 'sql', 'nosql', 'mongodb',
        'postgresql', 'redis', 'elasticsearch', 'kafka', 'spark',
        'devops', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
        'frontend', 'backend', 'full stack', 'fullstack',
        'fintech', 'healthtech', 'edtech', 'proptech', 'insurtech',
        'e-commerce', 'marketplace', 'b2b', 'b2c', 'enterprise',
        'security', 'cybersecurity', 'encryption', 'authentication',
        'iot', 'hardware', 'robotics', 'automation',
        'design', 'ux', 'ui', 'product', 'growth', 'marketing',
      ];
      
      // Store debug info to return
      const debugInfo: { rawTagsCount: number; rawTags: string[]; filteredCount: number } = {
        rawTagsCount: allTags.length,
        rawTags: [...allTags],
        filteredCount: 0
      };
      
      // If no tags found, try more aggressive extraction
      if (allTags.length === 0) {
        // Fallback 1: Look for any clickable elements with short text that might be tags
        const allClickable = document.querySelectorAll('a, button, [role="button"]');
        for (const el of Array.from(allClickable).slice(0, 100)) {
          const text = el.textContent?.trim() || '';
          // Skip if it's pure numbers or mostly numbers
          if (/^\d+$/.test(text) || (text.match(/\d/g) || []).length / text.length > 0.7) {
            continue;
          }
          // Skip navigation, common UI elements
          if (text && text.length > 1 && text.length < 30 && 
              !text.match(/^(click|view|see|more|less|show|hide|expand|collapse|apply|jobs|company|location|team|founded|website|batch|active|founders)$/i) &&
              !text.includes('http') && !text.includes('@') && !text.includes('://')) {
            const normalized = text.replace(/\s+/g, ' ').trim();
            if (normalized && !allTags.includes(normalized)) {
              allTags.push(normalized);
            }
          }
        }
        
        // Fallback 2: Look for text in common tag container patterns
        const tagContainers = document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="chip"], [class*="label"], [class*="pill"]');
        for (const container of Array.from(tagContainers).slice(0, 50)) {
          const text = container.textContent?.trim() || '';
          // Skip if it's pure numbers or mostly numbers
          if (/^\d+$/.test(text) || (text.match(/\d/g) || []).length / text.length > 0.7) {
            continue;
          }
          if (text && text.length > 1 && text.length < 50 && !allTags.includes(text)) {
            allTags.push(text);
          }
        }
        
        // Fallback 3: Look for any div/span with very short text that might be a tag
        const shortTextElements = document.querySelectorAll('div, span, p');
        for (const el of Array.from(shortTextElements).slice(0, 200)) {
          const text = el.textContent?.trim() || '';
          // Skip if it's pure numbers or mostly numbers
          if (/^\d+$/.test(text) || (text.match(/\d/g) || []).length / text.length > 0.7) {
            continue;
          }
          // Very short text (1-3 words, < 25 chars) that's capitalized might be a tag
          if (text && text.length > 1 && text.length < 25 && 
              text.split(/\s+/).length <= 3 &&
              /^[A-Z]/.test(text) &&
              !text.match(/^(The|And|For|With|From|This|That|Company|Location|Team|Jobs|Founded|Website|Batch|Active|Founders|View|See|More|Less)$/i) &&
              !allTags.includes(text)) {
            allTags.push(text);
          }
        }
        
        debugInfo.rawTagsCount = allTags.length;
        debugInfo.rawTags = [...allTags];
      }
      
      // Filter tags: Simple blacklist - exclude only what we know ISN'T a tag
      const filteredTags: string[] = [];
      
      for (const tag of allTags) {
        const tagLower = tag.toLowerCase().trim();
        
        // Normalize tag: convert hyphens to spaces and title case
        const normalizedTag = tag
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
          .trim();
        const normalizedTagLower = normalizedTag.toLowerCase();
        
        // Skip if empty or too long (likely not a tag)
        if (!normalizedTag || normalizedTag.length < 2 || normalizedTag.length > 50) {
          continue;
        }
        
        // BLACKLIST: Skip only what we know ISN'T a tag
        
        // 1. Skip pure numbers or mostly numeric (years, versions, etc.)
        if (/^\d+$/.test(normalizedTag) || // Pure numbers like "2025", "24"
            /^\d{4}$/.test(normalizedTag) || // 4-digit years
            /^v?\d+\.?\d*$/.test(normalizedTagLower) || // Version numbers like "v2", "3.0", "1.5"
            /^\d+%$/.test(normalizedTag) || // Percentages like "50%"
            /^#\d+$/.test(normalizedTag)) { // Hashtag numbers like "#2025"
          continue;
        }
        
        // 2. Skip tags that are mostly numbers (more than 50% digits)
        const digitCount = (normalizedTag.match(/\d/g) || []).length;
        const totalChars = normalizedTag.replace(/\s/g, '').length;
        if (totalChars > 0 && digitCount / totalChars > 0.5) {
          continue;
        }
        
        // 3. Skip activity/status words
        if (['active', 'inactive', 'pending', 'completed', 'failed'].includes(normalizedTagLower)) {
          continue;
        }
        
        // 4. Skip UI components and navigation
        if (/^(open|close|menu|logo|button|icon|nav|header|footer|view|see|more|less|show|hide|expand|collapse|click|apply|all)$/i.test(normalizedTagLower)) {
          continue;
        }
        
        // 5. Skip batch/year patterns (e.g., "Summer 2025", "W24", "S25", "2025 Summer")
        if (/^(summer|winter|spring|fall|w|s)\s*\d{2,4}$/i.test(normalizedTagLower) || 
            /^\d{4}\s*(summer|winter|spring|fall)$/i.test(normalizedTagLower) ||
            /summer \d{4}|winter \d{4}|spring \d{4}|fall \d{4}/i.test(normalizedTagLower) ||
            /^[ws]\d{2,4}$/i.test(normalizedTagLower)) { // W24, S25, etc.
          continue;
        }
        
        // 6. Skip tags that end with year numbers (e.g., "Something 2025")
        if (/\s+\d{4}$/.test(normalizedTag) || /-\d{4}$/.test(normalizedTag)) {
          continue;
        }
        
        // 7. Skip company metadata
        if (['founders', 'founder', 'company', 'team', 'size', 'jobs', 'status', 'founded', 'website', 'batch'].includes(normalizedTagLower)) {
          continue;
        }
        
        // 8. Skip locations (exact matches only to avoid false positives)
        const isLocation = locationKeywords.some(loc => {
          // Exact match
          if (normalizedTagLower === loc) return true;
          // For major cities/states, check if tag is exactly the location
          if (loc.length > 5 && normalizedTagLower === loc) return true;
          return false;
        });
        
        // 9. Skip location abbreviations
        const isLocationAbbr = /^(sf|nyc|la|chi|bos|sea|aus|den|atl|mia|dal|phi|phx|ca|ny|tx|fl|il|ma|wa|co|ga|nc|va|usa|uk|us)$/i.test(normalizedTagLower);
        
        // 10. Skip if it looks like a location pattern (contains comma, city/state keywords)
        const looksLikeLocation = /,|city|state|country|region|area|valley|bay|street|avenue|road/i.test(normalizedTag);
        
        // 11. Skip UI elements with logo/menu patterns
        const isUIElement = (normalizedTagLower.includes('logo') || normalizedTagLower.includes('menu')) && 
                           (normalizedTagLower.includes('y combinator') || 
                            normalizedTagLower.includes('summer') ||
                            normalizedTagLower.includes('open') ||
                            normalizedTagLower.includes('close'));
        
        // Skip if it's a location or UI element
        if (isLocation || isLocationAbbr || looksLikeLocation || isUIElement) {
          continue;
        }
        
        // Keep everything else - it's likely a valid tag (technology, skill, industry, domain, etc.)
        filteredTags.push(normalizedTag);
      }
      
      // Remove duplicates and sort
      // Final safety check: Remove any pure numbers that might have slipped through
      const finalTags = [...new Set(filteredTags)]
        .filter(tag => {
          // Remove pure numbers
          if (/^\d+$/.test(tag)) return false;
          // Remove tags that are mostly numbers (>70% digits)
          const digitCount = (tag.match(/\d/g) || []).length;
          const totalChars = tag.replace(/\s/g, '').length;
          if (totalChars > 0 && digitCount / totalChars > 0.7) return false;
          return true;
        })
        .sort();
      
      data.tags = finalTags;
      debugInfo.filteredCount = data.tags.length;

        // Store debug info in a way we can access it
        (data as any)._tagDebug = debugInfo;
        
        // Store yc_description debug info if available
        if ((window as any).__ycDescriptionDebug) {
          (data as any)._ycDescriptionDebug = (window as any).__ycDescriptionDebug;
        }

        return data;
      } catch (evalError) {
        console.error('   ❌ Error in page evaluation:', evalError);
        // Return empty data structure instead of throwing
        return {
          founders: [],
          website: '',
          teamSize: '',
          jobPostings: [],
          location: '',
          oneLineSummary: '',
          ycDescription: undefined,
          fundingAmount: undefined,
          roundType: undefined,
          fundingDate: undefined,
          tags: [],
          launchDate: undefined,
        };
      }
      });
    } catch (evalError: any) {
      const errorMsg = evalError?.message || String(evalError);
      if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
        throw new Error('Page detached during data extraction');
      }
      throw evalError;
    }

    // Check if we got valid data
    if (!pageData) {
      console.error(`   ❌ Page evaluation returned null`);
      return null;
    }

    // Log debug info about tags if available
    if ((pageData as any)._tagDebug) {
      const debug = (pageData as any)._tagDebug;
      if (debug.rawTagsCount > 0) {
        console.log(`   🔍 Found ${debug.rawTagsCount} raw tags: ${debug.rawTags.slice(0, 10).join(', ')}${debug.rawTags.length > 10 ? '...' : ''}`);
        console.log(`   🔍 After filtering: ${debug.filteredCount} tags`);
      } else {
        console.log(`   ⚠️  No tags found on page - tried multiple extraction strategies`);
      }
      // Remove debug info from pageData
      delete (pageData as any)._tagDebug;
    }
    
    // Log debug info about yc_description extraction if available
    if ((pageData as any)._ycDescriptionDebug) {
      const debug = (pageData as any)._ycDescriptionDebug;
      console.log(`   🔍 YC Description Debug: ${debug}`);
      // Remove debug info from pageData
      delete (pageData as any)._ycDescriptionDebug;
    }

    // ============================================
    // 7. CONSTRUCT LINKEDIN URL (for future enrichment)
    // ============================================
    // Construct LinkedIn company URL from website domain (stored for future API enrichment)
    pageData.linkedInCompanyUrl = pageData.website ? constructLinkedInCompanyUrl(pageData.website) : null;

    return pageData;
  } catch (error) {
    console.error(`   ❌ Error scraping YC page: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace: ${error.stack}`);
    }
    return null;
  }
}

/**
 * Get already processed company links from Supabase
 */
async function getAlreadyProcessedLinks(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('startups3')
      .select('yc_link')
      .not('yc_link', 'is', null);

    if (error) {
      console.warn('  ⚠️  Could not fetch already-processed companies:', error);
      return new Set();
    }

    const links = new Set<string>();
    data?.forEach((row: any) => {
      if (row.yc_link) {
        // Normalize URL for comparison (lowercase, remove trailing slash)
        const normalized = row.yc_link.toLowerCase().replace(/\/$/, '');
        links.add(normalized);
      }
    });

    return links;
  } catch (error) {
    console.warn('  ⚠️  Error fetching already-processed companies:', error);
    return new Set();
  }
}

/**
 * Get companies that already have Twitter data populated
 */
async function getCompaniesWithTwitterData(): Promise<Set<string>> {
  try {
    // Fetch all YC companies with their Twitter fields
    const { data, error } = await supabase
      .from('startups3')
      .select('yc_link, company_twitter_url, founder_twitter_urls')
      .not('yc_link', 'is', null);

    if (error) {
      console.warn('  ⚠️  Could not fetch companies with Twitter data:', error);
      return new Set();
    }

    const links = new Set<string>();
    data?.forEach((row: any) => {
      // Check if company has either Twitter field populated
      const hasCompanyTwitter = row.company_twitter_url && row.company_twitter_url.trim().length > 0;
      const hasFounderTwitter = row.founder_twitter_urls && row.founder_twitter_urls.trim().length > 0;
      
      if (row.yc_link && (hasCompanyTwitter || hasFounderTwitter)) {
        // Normalize URL for comparison (lowercase, remove trailing slash)
        const normalized = row.yc_link.toLowerCase().replace(/\/$/, '');
        links.add(normalized);
      }
    });

    return links;
  } catch (error) {
    console.warn('  ⚠️  Error fetching companies with Twitter data:', error);
    return new Set();
  }
}

/**
 * Store YC company data in Supabase
 */
async function storeYCCompanyInSupabase(company: YCCompany, pageData: YCPageData): Promise<boolean> {
  try {
    // Normalize company data to handle both CSV formats
    const normalized = normalizeCompanyData(company);

    const slug = extractCompanySlug(normalized.ycLink);
    if (!slug) {
      console.warn('  ⚠️  Could not extract slug from YC link');
      return false;
    }

    // Helper to convert empty strings to placeholder (so we know it was scraped but no data found)
    const toPlaceholder = (value: string | undefined, placeholder: string): string => {
      return value && value.trim() ? value.trim() : placeholder;
    };

    // Format founder descriptions for founder_backgrounds field
    // Combine all founder descriptions into a single string
    let founderBackgrounds = '';
    if (pageData.founders && pageData.founders.length > 0) {
      const descriptions = pageData.founders
        .filter(f => f.description && f.description.trim().length > 0)
        .map(f => {
          // TypeScript doesn't narrow the type after filter, so we need to check again
          if (!f.description) return '';
          const fullName = `${f.firstName}${f.lastName ? ' ' + f.lastName : ''}`.trim();
          if (fullName) {
            return `${fullName}: ${f.description.trim()}`;
          }
          return f.description.trim();
        })
        .filter(desc => desc.length > 0);
      
      if (descriptions.length > 0) {
        founderBackgrounds = descriptions.join('\n\n');
      }
    }

    // Collect founder profile picture URLs and download/store them permanently
    const founderPfpUrls: string[] = [];
    const founderNamesForPfp: string[] = [];
    
    if (pageData.founders && pageData.founders.length > 0) {
      pageData.founders.forEach(f => {
        if (f.profilePicture && f.profilePicture.trim()) {
          const fullName = `${f.firstName}${f.lastName ? ' ' + f.lastName : ''}`.trim();
          founderPfpUrls.push(f.profilePicture.trim());
          founderNamesForPfp.push(fullName || 'Unknown');
        }
      });
    }

    // Download and store images permanently in Supabase Storage
    let permanentPfpUrls: string[] = [];
    if (founderPfpUrls.length > 0) {
      console.log(`   📥 Downloading and storing ${founderPfpUrls.length} founder profile picture(s)...`);
      try {
        permanentPfpUrls = await processImagesInParallel(
          founderPfpUrls,
          supabase,
          normalized.companyName,
          founderNamesForPfp,
          3 // Process 3 images at a time
        );
        console.log(`   ✅ Successfully stored ${permanentPfpUrls.length}/${founderPfpUrls.length} images`);
      } catch (error: any) {
        console.error(`   ❌ Error storing images: ${error.message}`);
        // Fallback to original URLs if storage fails
        permanentPfpUrls = founderPfpUrls;
      }
    }
    
    const foundersPfp = permanentPfpUrls;

    // Format founder names and LinkedIn
    const founderNames = pageData.founders
      .map(f => `${f.firstName}${f.lastName ? ' ' + f.lastName : ''}`.trim())
      .filter(name => name.length > 0)
      .join(', ');

    const founderLinkedIn = pageData.founders
      .map(f => f.linkedIn)
      .filter(linkedin => linkedin && linkedin.trim().length > 0)
      .join(', ');

    // Format founder Twitter URLs
    const founderTwitterUrls = pageData.founders
      .map(f => f.twitterUrl)
      .filter(twitter => twitter && twitter.trim().length > 0)
      .join(', ');

    // Update all company data
    const updateData: {
      founder_names?: string;
      founder_linkedin?: string;
      founder_twitter_urls?: string;
      company_twitter_url?: string;
      website?: string;
      team_size?: string;
      founder_backgrounds?: string;
      founders_pfp?: string[];
      yc_description?: string;
    } = {
      // Founder information
      founder_names: founderNames || undefined,
      founder_linkedin: founderLinkedIn || undefined,
      founder_twitter_urls: founderTwitterUrls || undefined,
      
      // Company information
      company_twitter_url: pageData.companyTwitterUrl || undefined,
      website: pageData.website || undefined,
      team_size: pageData.teamSize || undefined,

      // Additional YC data
      founder_backgrounds: founderBackgrounds || undefined,
      founders_pfp: foundersPfp.length > 0 ? foundersPfp : undefined,
      yc_description: pageData.ycDescription || undefined,
    };
    
    // Log what we're updating
    if (founderNames) {
      console.log(`   👤 Found ${pageData.founders.length} founder(s): ${founderNames}`);
    }
    if (founderLinkedIn) {
      console.log(`   🔗 Found ${pageData.founders.filter(f => f.linkedIn).length} founder LinkedIn profile(s)`);
    }
    if (founderTwitterUrls) {
      console.log(`   🐦 Found ${pageData.founders.filter(f => f.twitterUrl).length} founder Twitter profile(s)`);
    }
    if (pageData.companyTwitterUrl) {
      console.log(`   🐦 Company Twitter: ${pageData.companyTwitterUrl}`);
    }
    if (pageData.website) {
      console.log(`   🌐 Website: ${pageData.website}`);
    }
    if (pageData.teamSize) {
      console.log(`   👥 Team size: ${pageData.teamSize}`);
    }
    if (founderBackgrounds) {
      console.log(`   👤 Found ${pageData.founders.filter(f => f.description).length} founder description(s)`);
      console.log(`   💾 Updating founder_backgrounds with descriptions from YC page (${founderBackgrounds.length} characters)`);
    }
    if (permanentPfpUrls.length > 0) {
      console.log(`   📸 Found ${founderPfpUrls.length} founder profile picture(s), stored ${permanentPfpUrls.length} permanently`);
    }
    if (pageData.ycDescription) {
      console.log(`   📝 Found YC description (${pageData.ycDescription.length} characters)`);
    }
    
    const { data, error } = await supabase
      .from('startups3')
      .update(updateData)
      .eq('yc_link', normalized.ycLink)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - company doesn't exist
        console.log('  ⚠️  Company not found in database, skipping...');
        return false;
      }
      console.error(`  ❌ Supabase update error: ${error.message}`);
      throw error;
    }

    if (data) {
      const updatedFields = Object.keys(updateData).filter(key => updateData[key as keyof typeof updateData] !== undefined);
      console.log(`   ✅ Successfully updated: ${updatedFields.join(', ')}`);
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error updating Twitter data in Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main scraping function
 */
async function scrapeYCCompanies() {
  console.log('🚀 Starting YC Company Scraping...\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const batchFilter = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('startups3').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Fetch ALL companies from startups3 table
  console.log('📂 Fetching all companies from startups3 table...');
  const companyFilter = args.find(arg => arg.startsWith('--company='))?.split('=')[1];
  
  let query = supabase
    .from('startups3')
    .select('id, name, yc_link, batch')
    .not('yc_link', 'is', null);
  
  // Apply filters if specified
  if (batchFilter) {
    query = query.eq('batch', batchFilter);
    console.log(`   Filtering by batch: ${batchFilter}`);
  }
  
  if (companyFilter) {
    query = query.ilike('name', `%${companyFilter}%`);
    console.log(`   Filtering by company: ${companyFilter}`);
  }
  
  const { data: allStartups, error: fetchError } = await query;
  
  if (fetchError) {
    throw new Error(`Failed to fetch startups: ${fetchError.message}`);
  }
  
  if (!allStartups || allStartups.length === 0) {
    console.log('❌ No companies found in database');
    return;
  }
  
  console.log(`   Found ${allStartups.length} company(ies) to process\n`);

  // Convert startups to YCCompany format for compatibility
  let companiesToUpdate: Array<{ startup: any; company: YCCompany }> = allStartups
    .filter((startup: any) => startup.yc_link) // Only process if has YC link
    .map((startup: any) => ({
      startup,
      company: {
        Company_Name: startup.name || 'Unknown',
        YC_Link: startup.yc_link,
        company_description: '',
        Batch: startup.batch || '',
      } as YCCompany
    }));

  // Apply limit if specified
  if (limit && limit > 0) {
    companiesToUpdate = companiesToUpdate.slice(0, limit);
    console.log(`   ⚠️  Limited to first ${limit} companies for testing\n`);
  }

  console.log(`📋 Companies to process: ${companiesToUpdate.length}\n`);
  
  if (companiesToUpdate.length === 0) {
    console.log('❌ No companies to process');
    return;
  }

  // Launch Puppeteer browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Helper function to recreate page if needed
  const recreatePage = async (): Promise<Page> => {
    try {
      if (!page.isClosed()) {
        try {
          await page.close();
        } catch (e) {
          // Ignore errors when closing
        }
      }
    } catch (e) {
      // Ignore errors
    }
    const newPage = await browser.newPage();
    await newPage.setViewport({ width: 1920, height: 1080 });
    await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return newPage;
  };

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    for (let i = 0; i < companiesToUpdate.length; i++) {
      const { startup, company } = companiesToUpdate[i];
      const normalized = normalizeCompanyData(company);

      try {
        console.log(`\n[${i + 1}/${companiesToUpdate.length}] 🏢 Processing: ${normalized.companyName}`);
        console.log(`   Batch: ${normalized.batch}`);
        console.log(`   URL: ${normalized.ycLink}`);

        // Scrape YC page with retry logic for detached frames
        let pageData = null;
        let scrapeAttempts = 0;
        const maxScrapeAttempts = 3;
        
        while (!pageData && scrapeAttempts < maxScrapeAttempts) {
          try {
            // Check if page is closed or detached, recreate if needed
            if (page.isClosed()) {
              console.log('   🔄 Page is closed, recreating...');
              page = await recreatePage();
            }
            
            pageData = await scrapeYCCompanyPage(page, normalized.ycLink);
            
            if (pageData) {
              break; // Success
            }
          } catch (error: any) {
            scrapeAttempts++;
            const errorMsg = error?.message || String(error);
            
            if (errorMsg.includes('detached') || errorMsg.includes('Target closed') || errorMsg.includes('closed')) {
              console.warn(`   ⚠️  Detached frame error (attempt ${scrapeAttempts}/${maxScrapeAttempts}), recreating page...`);
              try {
                page = await recreatePage();
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
              } catch (recreateError) {
                console.error(`   ❌ Failed to recreate page: ${recreateError instanceof Error ? recreateError.message : String(recreateError)}`);
                if (scrapeAttempts >= maxScrapeAttempts) {
                  throw error; // Re-throw if we've exhausted attempts
                }
              }
            } else {
              // For other errors, don't retry
              throw error;
            }
          }
        }

        if (!pageData) {
          console.log('  ⚠️  Failed to scrape page data after retries, skipping...');
          errorCount++;
          continue;
        }

        // Log what we found
        console.log(`   Found ${pageData.founders.length} founder(s)`);
        if (pageData.founders.length > 0) {
          const foundersWithDescriptions = pageData.founders.filter(f => f.description).length;
          const foundersWithTwitter = pageData.founders.filter(f => f.twitterUrl).length;
          const foundersWithPfp = pageData.founders.filter(f => f.profilePicture).length;
          console.log(`   Founders with descriptions: ${foundersWithDescriptions}/${pageData.founders.length}`);
          console.log(`   Founders with Twitter: ${foundersWithTwitter}/${pageData.founders.length}`);
          console.log(`   Founders with profile pictures: ${foundersWithPfp}/${pageData.founders.length}`);
        }
        console.log(`   Website: ${pageData.website || 'Not found'}`);
        console.log(`   Company Twitter: ${pageData.companyTwitterUrl || 'Not found'}`);
        console.log(`   Team size: ${pageData.teamSize || 'Not found'}`);
        console.log(`   Job postings: ${pageData.jobPostings.length}`);
        if (pageData.tags && pageData.tags.length > 0) {
          console.log(`   🏷️  Technology/Skill tags (${pageData.tags.length}): ${pageData.tags.join(', ')}`);
        } else {
          console.log(`   🏷️  Technology/Skill tags: None found`);
        }
        if (pageData.fundingAmount || pageData.roundType || pageData.fundingDate) {
          console.log(`   💰 Funding: ${pageData.fundingAmount || 'N/A'} | ${pageData.roundType || 'N/A'} | ${pageData.fundingDate || 'N/A'}`);
        }
        if (pageData.ycDescription) {
          console.log(`   📝 YC Description: ${pageData.ycDescription.substring(0, 100)}${pageData.ycDescription.length > 100 ? '...' : ''}`);
        } else {
          console.log(`   📝 YC Description: Not found`);
        }

        // Store in Supabase
        const success = await storeYCCompanyInSupabase(company, pageData);

        if (success) {
          successCount++;
          console.log('   ✅ Successfully updated founder profile pictures in Supabase');
        } else {
          skippedCount++;
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error processing ${normalized.companyName}: ${errorMsg}`);
        
        // If it's a detached frame error, try to recreate page for next iteration
        if (errorMsg.includes('detached') || errorMsg.includes('Target closed') || errorMsg.includes('closed')) {
          try {
            console.log('   🔄 Recreating page for next iteration...');
            page = await recreatePage();
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (recreateError) {
            console.warn(`   ⚠️  Failed to recreate page: ${recreateError instanceof Error ? recreateError.message : String(recreateError)}`);
          }
        }
      }
    }
  } finally {
    // Close browser
    try {
      await browser.close();
      console.log('\n🌐 Browser closed');
    } catch (closeError) {
      console.warn('⚠️  Browser cleanup warning:', closeError instanceof Error ? closeError.message : String(closeError));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Scraping Complete');
  console.log('='.repeat(60));
  console.log(`Total processed: ${companiesToUpdate.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Skipped (duplicates): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run the scraper
if (require.main === module) {
  scrapeYCCompanies()
    .then(() => {
      console.log('\n✅ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

export { scrapeYCCompanies, extractCompanySlug, scrapeYCCompanyPage };
