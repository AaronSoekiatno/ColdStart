/**
 * ATS Filter API Client
 * Client library for interacting with the FastAPI ATS Filter service
 */

const ATS_API_URL = process.env.ATS_API_URL || 'http://localhost:8000';

export interface FilterJobRequest {
  candidate_id: string;
  job_requirements: string;
}

export interface BatchFilterRequest {
  candidate_id: string;
  jobs: Array<{
    id: string;
    requirements: string;
  }>;
}

export interface KeywordMatchResult {
  success: boolean;
  candidate_id: string;
  matching_keywords: string[];
  matching_count: number;
  total_job_keywords: number;
  total_resume_keywords: number;
  match_percentage: number;
  missing_keywords: string[];
}

export interface BatchFilterResult {
  success: boolean;
  candidate_id: string;
  results: Array<{
    job_id: string;
    matching_keywords: string[];
    matching_count: number;
    total_job_keywords: number;
    total_resume_keywords: number;
    match_percentage: number;
    missing_keywords: string[];
  }>;
}

export interface ExtractKeywordsRequest {
  text: string;
}

export interface ExtractKeywordsResponse {
  success: boolean;
  keywords: string[];
  keyword_count: number;
}

export interface ResumeKeywordsResponse {
  success: boolean;
  candidate_id: string;
  keywords: string[];
  keyword_count: number;
  resume_length: number;
}

/**
 * ATS Filter API Client
 */
export class ATSClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ATS_API_URL;
  }

  /**
   * Check if the ATS API is healthy and running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === 'healthy' && data.spacy_model_loaded;
    } catch (error) {
      console.error('ATS API health check failed:', error);
      return false;
    }
  }

  /**
   * Filter a single job based on candidate's resume
   */
  async filterJob(
    candidateId: string,
    jobRequirements: string
  ): Promise<KeywordMatchResult> {
    const response = await fetch(`${this.baseUrl}/api/filter-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        job_requirements: jobRequirements,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to filter job');
    }

    return response.json();
  }

  /**
   * Filter multiple jobs in batch (more efficient)
   */
  async filterJobsBatch(
    candidateId: string,
    jobs: Array<{ id: string; requirements: string }>
  ): Promise<BatchFilterResult> {
    const response = await fetch(`${this.baseUrl}/api/filter-jobs-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        jobs,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to filter jobs');
    }

    return response.json();
  }

  /**
   * Extract keywords from any text
   */
  async extractKeywords(text: string): Promise<ExtractKeywordsResponse> {
    const response = await fetch(`${this.baseUrl}/api/extract-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to extract keywords');
    }

    return response.json();
  }

  /**
   * Get keywords from a candidate's resume
   */
  async getResumeKeywords(
    candidateId: string
  ): Promise<ResumeKeywordsResponse> {
    const response = await fetch(`${this.baseUrl}/api/resume/${candidateId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get resume keywords');
    }

    return response.json();
  }
}

// Default export for convenience
export const atsClient = new ATSClient();

/**
 * Helper function to filter jobs on resume upload
 * Call this after saving a resume to Supabase
 */
export async function filterJobsOnResumeUpload(
  candidateId: string,
  supabase: any,
  options: {
    minMatchPercentage?: number;
    maxResults?: number;
    saveToDatabase?: boolean;
  } = {}
): Promise<BatchFilterResult | null> {
  const {
    minMatchPercentage = 40,
    maxResults = 10,
    saveToDatabase = true,
  } = options;

  try {
    // Check if ATS API is available
    const isHealthy = await atsClient.healthCheck();
    if (!isHealthy) {
      console.warn('ATS API is not available, skipping job filtering');
      return null;
    }

    // Get active jobs from database - using full_description for comprehensive matching
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, full_description')
      .eq('is_active', true);

    if (jobsError || !jobs || jobs.length === 0) {
      console.warn('No active jobs found for filtering');
      return null;
    }

    // Filter jobs using ATS API with full job descriptions
    const results = await atsClient.filterJobsBatch(
      candidateId,
      jobs.map((job: any) => ({
        id: job.id,
        requirements: job.full_description || '', // Using full_description for richer keyword matching
      }))
    );

    if (!results.success) {
      return null;
    }

    // Filter by minimum match percentage and limit results
    const topMatches = results.results
      .filter((match) => match.match_percentage >= minMatchPercentage)
      .slice(0, maxResults);

    // Save matches to database if requested
    if (saveToDatabase && topMatches.length > 0) {
      const matchRecords = topMatches.map((match) => ({
        candidate_id: candidateId,
        job_id: match.job_id,
        match_percentage: match.match_percentage,
        matching_keywords: match.matching_keywords,
        matching_count: match.matching_count,
        total_job_keywords: match.total_job_keywords,
        created_at: new Date().toISOString(),
      }));

      const { error: saveError } = await supabase
        .from('matches')
        .insert(matchRecords);

      if (saveError) {
        console.error('Error saving matches to database:', saveError);
      }
    }

    return {
      ...results,
      results: topMatches,
    };
  } catch (error) {
    console.error('Error filtering jobs on resume upload:', error);
    return null;
  }
}
