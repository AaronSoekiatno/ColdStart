/**
 * Database type definitions for Supabase queries
 * These provide type safety without requiring generated types
 */

export interface CandidateRow {
    id: string;
    github_access_token: string | null;
    github_username: string | null;
}

export interface RepositoryRow {
    id: string;
    full_name: string;
    github_repo_id: number;
    name: string;
    description: string | null;
    created_at: string | null;
}

export interface ExtractionRow {
    id: string;
    candidate_id: string;
    repository_id: string;
    storage_path: string;
    extraction_status: string;
    extracted_lines_count: number | null;
    files_count: number | null;
    total_size_bytes: number | null;
    error_message: string | null;
    metadata: {
        total_commits?: number;
        date_range?: {
            first_commit: string | null;
            last_commit: string | null;
        };
    } | null;
}

export interface VelocityRow {
    id: string;
    candidate_id: string;
    repository_id: string;
    extract_id: string | null;
    first_release_at: string | null;
    first_release_tag: string | null;
    first_tag_at: string | null;
    first_tag_name: string | null;
    days_to_first_release: number | null;
    has_dockerfile: boolean;
    has_ci_cd: boolean;
    deployed_to: string | null;
    deployment_added_at: string | null;
    extraction_status: string;
    error_message: string | null;
}

// Type helper for Supabase insert/update operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRecord = Record<string, any>;
