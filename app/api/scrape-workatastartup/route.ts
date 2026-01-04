import { NextRequest, NextResponse } from 'next/server';
// Import the scraper functions
import { scrapeAndSaveWorkAtAStartup, scrapeAndSaveCompanyJobs } from '../../../scripts/scrapers/scrape_workatastartup';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution time

/**
 * API Route for Work at a Startup Scraper
 * 
 * This endpoint scrapes job listings from workatastartup.com and:
 * - Saves them to the jobs table
 * - Cross-references with startups table
 * - Creates new startup entries for companies not found
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get parameters from body
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;
    const company = body.company; // Company name or URL

    // If company is provided, scrape that specific company
    if (company) {
      console.log(`Scraping jobs for company: ${company}`);
      const result = await scrapeAndSaveCompanyJobs(company);
      
      return NextResponse.json({
        success: true,
        message: `Work at a Startup scraper completed for company: ${company}`,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    // Otherwise, run the general scraper
    const result = await scrapeAndSaveWorkAtAStartup(limit);

    return NextResponse.json({
      success: true,
      message: 'Work at a Startup scraper completed',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Work at a Startup scraper error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health checks and manual triggers
 */
export async function GET(request: NextRequest) {
  // Optional: Add authentication for manual triggers
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        message: 'Include Authorization header: Bearer <CRON_SECRET>'
      },
      { status: 401 }
    );
  }

  // Check if we should run (for manual triggers)
  const forceRun = request.nextUrl.searchParams.get('force') === 'true';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const companyParam = request.nextUrl.searchParams.get('company');
  
  if (forceRun) {
    // Run scraper
    try {
      // If company is provided, scrape that specific company
      if (companyParam) {
        console.log(`Scraping jobs for company: ${companyParam}`);
        const result = await scrapeAndSaveCompanyJobs(companyParam);
        return NextResponse.json({
          success: true,
          message: `Work at a Startup scraper completed for company: ${companyParam}`,
          result,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Otherwise, run general scraper
      const result = await scrapeAndSaveWorkAtAStartup(limit);
      return NextResponse.json({
        success: true,
        message: 'Work at a Startup scraper completed',
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    message: 'Work at a Startup scraper API',
    endpoints: {
      POST: 'Run scraper with optional limit or company in body',
      'GET ?force=true&limit=50': 'Force run scraper with limit',
      'GET ?force=true&company=CompanyName': 'Scrape jobs for specific company by name',
      'GET ?force=true&company=https://...': 'Scrape jobs for specific company by URL',
    },
    defaultLimit: 50,
    examples: {
      'POST body: { "company": "Stripe" }': 'Scrape all jobs for Stripe',
      'POST body: { "company": "https://www.workatastartup.com/companies/stripe" }': 'Scrape all jobs using URL',
      'POST body: { "limit": 10 }': 'Scrape first 10 companies',
    },
  });
}

