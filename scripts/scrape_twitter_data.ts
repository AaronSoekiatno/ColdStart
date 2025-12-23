import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

// Types
interface YCCompany {
  YC_Link?: string;
  YC_link?: string;
  Company_Logo?: string;
  Company_Name: string;
  company_description: string;
  Batch: string;
  business_type?: string;
  industry?: string;
  Industry?: string;
  'Sub-Industry'?: string;
  location?: string;
  Location?: string;
}

interface YCPageData {
  founders: Array<{
    firstName: string;
    lastName: string;
    linkedIn: string;
    twitterUrl?: string;
    description?: string;
  }>;
  website: string;
  teamSize: string;
  jobPostings: Array<{
    title: string;
    description: string;
    location?: string;
  }>;
  location: string;
  oneLineSummary: string;
  companyTwitterUrl?: string;
  fundingAmount?: string;
  roundType?: string;
  fundingDate?: string;
  linkedInCompanyUrl?: string | null;
  tags?: string[];
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
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
  const currentDir = process.cwd();
  const ycDir = currentDir.endsWith('yc_companies') ? currentDir : resolve(currentDir, 'yc_companies');

  const files = fs.readdirSync(ycDir);
  return files
    .filter(file => (file.startsWith('ycombinator') || file.toLowerCase().includes('yc')) && file.endsWith('.csv'))
    .map(file => resolve(ycDir, file))
    .sort();
}

/**
 * Scrape YC company page for Twitter data only
 * Uses the same comprehensive founder extraction logic as the main scraper
 */
async function scrapeTwitterData(page: Page, ycUrl: string): Promise<{ companyTwitterUrl?: string; founderTwitterUrls: string[] } | null> {
  try {
    console.log(`   Navigating to: ${ycUrl}`);
    
    if (page.isClosed()) {
      throw new Error('Page is closed');
    }
    
    // Navigate with retry logic
    let navigationSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (page.isClosed()) {
          throw new Error('Page was closed before navigation');
        }
        
        await page.goto(ycUrl, { 
          waitUntil: attempt === 0 ? 'networkidle2' : 'domcontentloaded', 
          timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        navigationSuccess = true;
        break;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
          console.warn(`   ⚠️  Detached frame error (attempt ${attempt + 1}/3), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        if (attempt < 2) {
          console.warn(`   ⚠️  Navigation error (attempt ${attempt + 1}/3): ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    if (!navigationSuccess) {
      console.error(`   ❌ Failed to load page after 3 attempts`);
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (scrollError) {
      // Non-critical
    }

    // Check for error pages with retry logic
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

    if (page.isClosed()) {
      throw new Error('Page was closed before evaluation');
    }

    // Extract Twitter data using comprehensive founder extraction logic
    let twitterData;
    try {
      twitterData = await page.evaluate(() => {
      const result: { companyTwitterUrl?: string; founderTwitterUrls: string[] } = {
        founderTwitterUrls: []
      };

      // Track found founders with their Twitter URLs
      interface Founder {
        firstName: string;
        lastName: string;
        twitterUrl?: string;
      }
      const founders: Founder[] = [];
      const seenFounders = new Set<string>();

      // Get company name to filter it out
      const companyName = (document.querySelector('h1')?.textContent?.trim() || '').toLowerCase();
      
      // PRIORITY METHOD: Simple text-based extraction FIRST
      const bodyText = document.body.textContent || '';
      const bodyLower = bodyText.toLowerCase();
      
      // Find "Active Founders" or "Founders" in the raw text
      let simpleExtractionIndex = bodyLower.indexOf('active founders');
      if (simpleExtractionIndex < 0) {
        simpleExtractionIndex = bodyLower.indexOf('founders');
      }
      
      if (simpleExtractionIndex >= 0) {
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
              
              // Skip common words
              const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 
                                'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                'San Francisco', 'New York', 'Remote', 'United States'];
              if (skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) continue;
              
              // Try to find Twitter link
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
              const founderKey = fullName.toLowerCase();
              
              if (!seenFounders.has(founderKey)) {
                seenFounders.add(founderKey);
                founders.push({
                  firstName,
                  lastName,
                  twitterUrl: twitterUrl || undefined,
                });
              }
            }
          }
        }
      }
      
      // CSS selector-based extraction (may find additional founders)
      let foundersHeading: Element | null = null;
      const allElements = Array.from(document.querySelectorAll('*'));
      foundersHeading = allElements.find(el => {
        const text = el.textContent?.trim() || '';
        return text.toLowerCase() === 'active founders' ||
               text.toLowerCase().includes('active founders');
      }) || null;
      
      if (!foundersHeading) {
        foundersHeading = allElements.find(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'founders';
        }) || null;
      }
      
      if (!foundersHeading) {
        const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        foundersHeading = allHeadings.find(h => {
          const text = h.textContent?.trim() || '';
          return text.toLowerCase().includes('active founders') || 
                 text.toLowerCase() === 'founders';
        }) || null;
      }
      
      // Mark already found founders as seen
      for (const founder of founders) {
        const key = `${founder.firstName} ${founder.lastName}`.toLowerCase();
        seenFounders.add(key);
      }
      
      // Find the container with founder cards
      let foundersContainer: Element | null = null;
      
      if (foundersHeading) {
        let current: Element | null = foundersHeading.parentElement;
        while (current && !foundersContainer) {
          const nameElements = current.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
          if (nameElements.length > 0) {
            foundersContainer = current;
            break;
          }
          current = current.parentElement;
        }
      }
      
      if (!foundersContainer) {
        const nameElements = document.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        if (nameElements.length > 0) {
          const parents = Array.from(nameElements).map(el => el.parentElement).filter(Boolean);
          if (parents.length > 0) {
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
        const nameElements = foundersContainer.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"][class*="font-bold"]');
        
        nameElements.forEach(nameEl => {
          const fullName = nameEl.textContent?.trim() || '';
          
          if (!fullName || fullName.length < 3 || fullName.length > 100) return;
          if (!/^[A-Za-z\s\.\-\']+$/.test(fullName)) return;
          
          // Find the founder card container
          let founderCard = nameEl.parentElement;
          let attempts = 0;
          while (founderCard && attempts < 5) {
            const descEl = founderCard.querySelector('.prose.max-w-full.whitespace-pre-line, div[class*="prose"][class*="max-w-full"]');
            if (descEl) {
              break;
            }
            founderCard = founderCard.parentElement;
            attempts++;
          }
          
          if (!founderCard) {
            founderCard = nameEl.parentElement;
          }
          
          // Extract Twitter/X link
          let twitterUrl = '';
          if (founderCard) {
            const twitterLinks = founderCard.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]');
            
            for (const twitterLink of Array.from(twitterLinks)) {
              const linkEl = twitterLink as HTMLAnchorElement;
              const href = linkEl.href;
              if (!href) continue;
              
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                let normalizedUrl = href;
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
          
          // Skip if this is the company name
          if (fullName.toLowerCase() === companyName) return;
          if (fullName.split(/\s+/).length < 2) return;
          if (fullName === fullName.toUpperCase() && fullName.length > 10) return;
          
          // Check if we're in the Active Founders section
          let isInFoundersSection = false;
          if (foundersHeading && foundersContainer) {
            isInFoundersSection = foundersContainer.contains(nameEl);
            if (!isInFoundersSection) {
              const namePos = Array.from(document.querySelectorAll('*')).indexOf(nameEl as Element);
              const headingPos = Array.from(document.querySelectorAll('*')).indexOf(foundersHeading);
              isInFoundersSection = namePos > headingPos && namePos < headingPos + 50;
            }
          }
          
          const nameParts = fullName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Only add if we're in founders section or have a description mentioning founder
          if (!isInFoundersSection) {
            const proseDiv = founderCard?.querySelector('.prose.max-w-full.whitespace-pre-line') as HTMLElement;
            const description = proseDiv?.textContent?.trim() || '';
            if (!description.toLowerCase().includes('founder') && !description.toLowerCase().includes('co-founder')) {
              return;
            }
          }
          
          const founderKey = fullName.toLowerCase();
          
          if (!seenFounders.has(founderKey) && firstName) {
            seenFounders.add(founderKey);
            founders.push({
              firstName,
              lastName,
              twitterUrl: twitterUrl || undefined,
            });
          }
        });
      }
      
      // Ultra-Simple Fallback: Direct line-by-line text extraction
      if (founders.length === 0) {
        const bodyText = document.body.textContent || '';
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let foundersSectionStart = -1;
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (lineLower.includes('active founders') || lineLower === 'founders') {
            foundersSectionStart = i;
            break;
          }
        }
        
        if (foundersSectionStart >= 0) {
          const sectionLines = lines.slice(foundersSectionStart + 1, foundersSectionStart + 30);
          
          for (let i = 0; i < sectionLines.length; i++) {
            const line = sectionLines[i];
            
            if (line.match(/^(Company|Location|Jobs|Team|Status|Founded|Website|Batch):?$/i)) break;
            
            const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z][a-z]+)$/);
            
            if (nameMatch) {
              const potentialName = nameMatch[1];
              const nameParts = potentialName.split(/\s+/);
              
              if (nameParts.length >= 2 && nameParts.length <= 4) {
                if (potentialName.toLowerCase() === companyName) continue;
                
                const skipWords = ['Active', 'Founders', 'Founder', 'Company', 'Location', 
                                  'Team', 'Size', 'Jobs', 'Status', 'Founded', 'Website', 'Batch',
                                  'San Francisco', 'New York', 'Remote', 'United States'];
                if (skipWords.some(word => potentialName.toLowerCase().includes(word.toLowerCase()))) continue;
                
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                const founderKey = potentialName.toLowerCase();
                
                if (!seenFounders.has(founderKey)) {
                  seenFounders.add(founderKey);
                  founders.push({
                    firstName,
                    lastName,
                    twitterUrl: undefined,
                  });
                }
              }
            }
          }
          
          // Try to associate Twitter links with found founders
          if (founders.length > 0) {
            const allTwitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
            for (const link of allTwitterLinks) {
              const linkEl = link as HTMLAnchorElement;
              const linkHref = linkEl.href;
              if (!linkHref) continue;
              
              const parent = link.closest('nav, footer, header');
              if (parent) continue;
              
              const ariaLabel = linkEl.getAttribute('aria-label') || '';
              const dataTooltipId = linkEl.getAttribute('data-tooltip-id') || '';
              
              const isFounderTwitter = (
                dataTooltipId.includes('founder-social-tooltip') ||
                (ariaLabel.toLowerCase().includes('twitter') && dataTooltipId.includes('founder'))
              );
              
              if (isFounderTwitter) {
                const linkContainer = link.closest('div, section, article, p');
                const containerText = (linkContainer?.textContent || '').toLowerCase();
                
                for (const founder of founders) {
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
      
      // Extract company Twitter URL
      const twitterLinks = Array.from(document.querySelectorAll('a[href*="x.com/"], a[href*="twitter.com/"]'));
      
      for (const link of twitterLinks) {
        try {
          const href = (link as HTMLAnchorElement).href;
          if (!href) continue;
          
          const parent = link.closest('nav, footer, header');
          if (parent) continue;
          
          const ariaLabel = link.getAttribute('aria-label') || '';
          const dataTooltipId = link.getAttribute('data-tooltip-id') || '';
          const dataTooltip = link.getAttribute('data-tooltip-content') || '';
          
          // Company Twitter has aria-label containing "X" or "Twitter" (but not "founder-social-tooltip")
          const isCompanyTwitter = (
            (ariaLabel.toLowerCase().includes('x') || ariaLabel.toLowerCase().includes('twitter')) &&
            !dataTooltipId.includes('founder-social-tooltip') &&
            (dataTooltip === 'X' || ariaLabel.toLowerCase().includes('twitter'))
          );
          
          if (isCompanyTwitter) {
            let normalizedUrl = href;
            if (normalizedUrl.startsWith('//')) {
              normalizedUrl = 'https:' + normalizedUrl;
            } else if (!normalizedUrl.startsWith('http')) {
              normalizedUrl = 'https://' + normalizedUrl;
            }
            normalizedUrl = normalizedUrl.replace(/twitter\.com\//g, 'x.com/');
            result.companyTwitterUrl = normalizedUrl;
            break;
          }
        } catch (linkError) {
          continue;
        }
      }
      
      // Collect all founder Twitter URLs
      for (const founder of founders) {
        if (founder.twitterUrl && !result.founderTwitterUrls.includes(founder.twitterUrl)) {
          result.founderTwitterUrls.push(founder.twitterUrl);
        }
      }

      return result;
      });
    } catch (evalError: any) {
      const errorMsg = evalError?.message || String(evalError);
      if (errorMsg.includes('detached') || errorMsg.includes('Target closed')) {
        throw new Error('Page detached during data extraction');
      }
      throw evalError;
    }

    return twitterData;
  } catch (error) {
    console.error(`   ❌ Error scraping Twitter data: ${error instanceof Error ? error.message : String(error)}`);
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
      .eq('data_source', 'yc')
      .not('yc_link', 'is', null);

    if (error) {
      console.warn('  ⚠️  Could not fetch already-processed companies:', error);
      return new Set();
    }

    const links = new Set<string>();
    data?.forEach((row: any) => {
      if (row.yc_link) {
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
    const { data, error } = await supabase
      .from('startups3')
      .select('yc_link, company_twitter_url, founder_twitter_urls')
      .eq('data_source', 'yc')
      .not('yc_link', 'is', null);

    if (error) {
      console.warn('  ⚠️  Could not fetch companies with Twitter data:', error);
      return new Set();
    }

    const links = new Set<string>();
    data?.forEach((row: any) => {
      // Check if Twitter data exists (either has actual data or placeholder indicating it was scraped)
      // If either field has a value (including 'NO_TWITTER' placeholder), it means it was already processed
      const hasCompanyTwitter = row.company_twitter_url && 
                                 row.company_twitter_url.trim().length > 0;
      const hasFounderTwitter = row.founder_twitter_urls && 
                                row.founder_twitter_urls.trim().length > 0;
      
      // If company has Twitter data (including placeholder), it means it was already processed
      if (row.yc_link && (hasCompanyTwitter || hasFounderTwitter)) {
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
 * Store Twitter data in Supabase
 */
async function storeTwitterData(company: YCCompany, twitterData: { companyTwitterUrl?: string; founderTwitterUrls: string[] }): Promise<boolean> {
  try {
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

    // Format founder Twitter URLs as comma-separated string
    const founderTwitterUrls = twitterData.founderTwitterUrls.length > 0
      ? twitterData.founderTwitterUrls.join(', ')
      : 'NO_TWITTER';

    const updateData: {
      company_twitter_url?: string;
      founder_twitter_urls?: string;
    } = {
      company_twitter_url: toPlaceholder(twitterData.companyTwitterUrl, 'NO_TWITTER'),
      founder_twitter_urls: founderTwitterUrls,
    };
    
    console.log(`   💾 Updating Twitter data:`);
    console.log(`      Company Twitter: ${updateData.company_twitter_url}`);
    console.log(`      Founder Twitter: ${updateData.founder_twitter_urls}`);
    
    const { data, error } = await supabase
      .from('startups3')
      .update(updateData)
      .eq('yc_link', normalized.ycLink)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('  ⚠️  Company not found in database, skipping...');
        return false;
      }
      console.error(`  ❌ Supabase update error: ${error.message}`);
      throw error;
    }

    if (data) {
      if (updateData.company_twitter_url && updateData.company_twitter_url !== 'NO_TWITTER') {
        console.log(`   ✅ Company Twitter stored: ${updateData.company_twitter_url}`);
      } else if (updateData.company_twitter_url === 'NO_TWITTER') {
        console.log(`   ✅ Company Twitter: NO_TWITTER (scraped, no data found)`);
      }
      
      if (updateData.founder_twitter_urls && updateData.founder_twitter_urls !== 'NO_TWITTER') {
        console.log(`   ✅ Founder Twitter stored: ${updateData.founder_twitter_urls}`);
      } else if (updateData.founder_twitter_urls === 'NO_TWITTER') {
        console.log(`   ✅ Founder Twitter: NO_TWITTER (scraped, no data found)`);
      }
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error updating Twitter data in Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main scraping function for Twitter data only
 */
async function scrapeTwitterDataForCompanies() {
  console.log('🚀 Starting Twitter Data Extraction for YC Companies...\n');

  // Get command line arguments
  const args = process.argv.slice(2);
  const batchFilter = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];
  const companyFilter = args.find(arg => arg.startsWith('--company='))?.split('=')[1];

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

  // Get already processed companies
  console.log('🔍 Checking for already-processed companies...');
  const processedLinks = await getAlreadyProcessedLinks();
  console.log(`   Found ${processedLinks.size} already-processed companies`);

  // Get companies that already have Twitter data
  console.log('🔍 Checking for companies with Twitter data...');
  const companiesWithTwitter = await getCompaniesWithTwitterData();
  console.log(`   Found ${companiesWithTwitter.size} companies with Twitter data already populated\n`);

  // Load all companies from CSV files
  console.log('📂 Loading YC companies from CSV files...');
  const csvFiles = getAllYCCsvFiles();
  console.log(`   Found ${csvFiles.length} CSV file(s)`);

  let allCompanies: YCCompany[] = [];
  for (const csvFile of csvFiles) {
    const companies = loadCompaniesFromCSV(csvFile);
    console.log(`   Loaded ${companies.length} companies from ${csvFile.split(/[/\\]/).pop()}`);
    allCompanies = allCompanies.concat(companies);
  }

  // Filter by batch if specified
  if (batchFilter) {
    console.log(`\n🔍 Filtering for batch: ${batchFilter}`);
    allCompanies = allCompanies.filter(c => {
      const normalized = normalizeCompanyData(c);
      return normalized.batch.toLowerCase() === batchFilter.toLowerCase();
    });
  }

  // Filter by company name or URL if specified
  if (companyFilter) {
    console.log(`\n🔍 Filtering for company: ${companyFilter}`);
    const beforeFilter = allCompanies.length;
    allCompanies = allCompanies.filter(c => {
      const normalized = normalizeCompanyData(c);
      const nameMatch = normalized.companyName.toLowerCase().includes(companyFilter.toLowerCase());
      const urlMatch = normalized.ycLink.toLowerCase().includes(companyFilter.toLowerCase());
      return nameMatch || urlMatch;
    });
    console.log(`   Found ${allCompanies.length} matching company(ies) in CSV (from ${beforeFilter} total)`);
  }

  console.log(`\n📊 Total companies to process: ${allCompanies.length}`);

  // Filter to get companies that ARE in database but DON'T have Twitter data
  const companiesToUpdate = allCompanies.filter(company => {
    const normalized = normalizeCompanyData(company);
    if (!normalized.ycLink) return false;
    const normalizedLink = normalized.ycLink.toLowerCase().replace(/\/$/, '');
    const inDatabase = processedLinks.has(normalizedLink);
    const hasTwitter = companiesWithTwitter.has(normalizedLink);
    
    if (companyFilter && normalized.companyName.toLowerCase().includes(companyFilter.toLowerCase())) {
      console.log(`   🔍 ${normalized.companyName}:`);
      console.log(`      YC Link: ${normalized.ycLink}`);
      console.log(`      In database: ${inDatabase ? '✅' : '❌'}`);
      console.log(`      Has Twitter: ${hasTwitter ? '✅' : '❌'}`);
      console.log(`      Will process: ${inDatabase && !hasTwitter ? '✅' : '❌'}`);
    }
    
    return inDatabase && !hasTwitter;
  });

  const initiallySkippedCount = allCompanies.length - companiesToUpdate.length;
  console.log(`📋 Companies to update Twitter data: ${companiesToUpdate.length} (${initiallySkippedCount} skipped - not in DB or already have Twitter data)\n`);
  
  if (companyFilter && companiesToUpdate.length === 0 && allCompanies.length > 0) {
    console.log(`   ⚠️  Company "${companyFilter}" found in CSV but:`);
    const normalized = normalizeCompanyData(allCompanies[0]);
    const normalizedLink = normalized.ycLink.toLowerCase().replace(/\/$/, '');
    if (!processedLinks.has(normalizedLink)) {
      console.log(`      - Not in database (yc_link: ${normalized.ycLink})`);
      console.log(`      💡 The company needs to be imported to the database first`);
    } else if (companiesWithTwitter.has(normalizedLink)) {
      console.log(`      - Already has Twitter data in database`);
    }
    console.log();
  }

  if (companiesToUpdate.length === 0 && !companyFilter) {
    console.log('✅ All companies already have Twitter data!');
    return;
  }
  
  if (companiesToUpdate.length === 0 && companyFilter) {
    console.log(`❌ No companies to process for "${companyFilter}"`);
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
      const company = companiesToUpdate[i];
      const normalized = normalizeCompanyData(company);

      try {
        console.log(`\n[${i + 1}/${companiesToUpdate.length}] 🏢 Processing: ${normalized.companyName}`);
        console.log(`   Batch: ${normalized.batch}`);
        console.log(`   URL: ${normalized.ycLink}`);

        // Scrape Twitter data with retry logic for detached frames
        let twitterData = null;
        let scrapeAttempts = 0;
        const maxScrapeAttempts = 3;
        
        while (!twitterData && scrapeAttempts < maxScrapeAttempts) {
          try {
            // Check if page is closed or detached, recreate if needed
            if (page.isClosed()) {
              console.log('   🔄 Page is closed, recreating...');
              page = await recreatePage();
            }
            
            twitterData = await scrapeTwitterData(page, normalized.ycLink);
            
            if (twitterData) {
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

        if (!twitterData) {
          console.log('  ⚠️  Failed to scrape Twitter data after retries, skipping...');
          errorCount++;
          continue;
        }

        // Log what we found
        console.log(`   Found company Twitter: ${twitterData.companyTwitterUrl || 'Not found'}`);
        console.log(`   Found ${twitterData.founderTwitterUrls.length} founder Twitter URL(s)`);
        if (twitterData.founderTwitterUrls.length > 0) {
          twitterData.founderTwitterUrls.forEach((url, idx) => {
            console.log(`      ${idx + 1}. ${url}`);
          });
        }

        // Store in Supabase
        const success = await storeTwitterData(company, twitterData);

        if (success) {
          successCount++;
          console.log('   ✅ Successfully updated Twitter data in Supabase');
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
  console.log('📊 Twitter Data Extraction Complete');
  console.log('='.repeat(60));
  console.log(`Total processed: ${companiesToUpdate.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Skipped (duplicates): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run the scraper
if (require.main === module) {
  scrapeTwitterDataForCompanies()
    .then(() => {
      console.log('\n✅ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Process failed:', error);
      process.exit(1);
    });
}

