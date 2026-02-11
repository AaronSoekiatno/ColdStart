/**
 * PhantomBuster API Integration
 * Per product spec: linkedin-scraping-product-spec.md section 3.2
 */

const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY;
const PHANTOMBUSTER_API_URL = 'https://api.phantombuster.com/api/v2';
const LINKEDIN_NETWORK_AGENT_ID = '3488619173951569'; // LinkedIn Network Booster

interface PhantomBusterLaunchResponse {
  status: string;
  message?: string;
  containerId: string;
}

interface PhantomBusterStatusResponse {
  status: 'running' | 'success' | 'error';
  progress?: number;
  message?: string;
  output?: string;
}

interface PhantomBusterOutputResponse {
  data: LinkedInConnectionData[];
}

export interface LinkedInConnectionData {
  firstName: string;
  lastName: string;
  fullName: string;
  company?: string;
  jobTitle?: string;
  profileUrl: string;
  email?: string;
  connectedDate?: string;
}

/**
 * Launch a PhantomBuster agent to scrape LinkedIn connections
 */
export async function launchLinkedInScrape(
  email: string,
  password: string
): Promise<{ containerId: string; error?: string }> {
  if (!PHANTOMBUSTER_API_KEY) {
    throw new Error('PHANTOMBUSTER_API_KEY not configured');
  }

  try {
    const response = await fetch(`${PHANTOMBUSTER_API_URL}/agents/launch`, {
      method: 'POST',
      headers: {
        'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: LINKEDIN_NETWORK_AGENT_ID,
        argument: {
          sessionCookie: null,
          emailAddress: email,
          password: password,
          numberOfProfiles: 5000,
          removeDuplicates: true,
        },
      }),
    });

    const data: PhantomBusterLaunchResponse = await response.json();

    if (!response.ok || !data.containerId) {
      return {
        containerId: '',
        error: data.message || 'Failed to launch PhantomBuster agent',
      };
    }

    return {
      containerId: data.containerId,
    };
  } catch (error) {
    console.error('PhantomBuster launch error:', error);
    return {
      containerId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check the status of a PhantomBuster container
 */
export async function checkScrapeStatus(
  containerId: string
): Promise<PhantomBusterStatusResponse> {
  if (!PHANTOMBUSTER_API_KEY) {
    throw new Error('PHANTOMBUSTER_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `${PHANTOMBUSTER_API_URL}/containers/fetch/${containerId}`,
      {
        headers: {
          'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
        },
      }
    );

    const data: PhantomBusterStatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error('PhantomBuster status check error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch output/results from a completed PhantomBuster container
 */
export async function fetchScrapeOutput(
  containerId: string
): Promise<{ data: LinkedInConnectionData[]; error?: string }> {
  if (!PHANTOMBUSTER_API_KEY) {
    throw new Error('PHANTOMBUSTER_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `${PHANTOMBUSTER_API_URL}/containers/fetch-output/${containerId}`,
      {
        headers: {
          'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return {
        data: [],
        error: `Failed to fetch output: ${response.statusText}`,
      };
    }

    const output: PhantomBusterOutputResponse = await response.json();
    return { data: output.data || [] };
  } catch (error) {
    console.error('PhantomBuster fetch output error:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Poll for scrape completion (use sparingly, prefer webhook or client polling)
 * Returns when scrape is complete or fails
 */
export async function waitForScrapeCompletion(
  containerId: string,
  maxWaitMinutes: number = 15
): Promise<PhantomBusterStatusResponse> {
  const maxIterations = (maxWaitMinutes * 60) / 15; // Check every 15 seconds
  let iterations = 0;

  while (iterations < maxIterations) {
    const status = await checkScrapeStatus(containerId);

    if (status.status === 'success' || status.status === 'error') {
      return status;
    }

    // Wait 15 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 15000));
    iterations++;
  }

  return {
    status: 'error',
    message: 'Scrape timed out',
  };
}
