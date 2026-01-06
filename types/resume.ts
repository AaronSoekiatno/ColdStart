/**
 * Structured resume data types for Jake's Resume template
 */

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string; // "Present" or date (optional if not provided)
  description: string[]; // Bullet points
}

export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string;
  // New optional fields for better resume detail
  major?: string;
  minor?: string;
  relevantCourses?: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string[]; // Bullet points (changed from string to array)
  technologies?: string[];
  link?: string;
}

export interface StructuredResumeData {
  personal: PersonalInfo;
  summary?: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  projects?: ProjectItem[];
  skills: string[];
  certifications?: string[];
}

/**
 * Resume metadata and file information
 * Represents a resume document with its associated metadata
 */
export interface ResumeMetadata {
  id: string; // UUID primary key
  candidateId: string; // Reference to the candidate/user who owns this resume
  name: string; // User-defined name for the resume (e.g., "Software Engineer Resume", "Data Science Resume")
  fileName: string; // Original uploaded file name
  resumePath?: string; // Path to resume file in storage
  resumeUrl?: string | null; // Signed URL for accessing the resume file
  resumeFullText?: string; // Full extracted text content from resume
  isActive: boolean; // Whether this resume is active/available for use
  isPrimary: boolean; // Whether this resume is the primary/current resume for email generation
  createdAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

/**
 * Complete resume object with both metadata and structured data
 * This is the full representation of a resume in the system
 */
export interface Resume extends ResumeMetadata {
  structuredData?: StructuredResumeData; // The parsed/structured resume data
}

/**
 * Collection of resumes for a candidate
 * Provides helper methods and metadata about the collection
 */
export interface ResumeCollection {
  resumes: Resume[];
  primaryResumeId: string | null; // ID of the primary resume
  activeResumeIds: string[]; // IDs of all active resumes
  count: number; // Total number of resumes
  activeCount: number; // Number of active resumes
}

/**
 * Input type for creating a new resume
 */
export interface CreateResumeInput {
  name: string; // User-defined name for the resume
  fileName: string; // Original uploaded file name
  resumePath?: string; // Path to resume file in storage
  resumeFullText?: string; // Full extracted text content
  structuredData?: StructuredResumeData; // Parsed resume data
  isPrimary?: boolean; // Whether to set this as the primary resume
}

/**
 * Input type for updating an existing resume
 */
export interface UpdateResumeInput {
  name?: string; // Update the resume name
  isActive?: boolean; // Update active status
  isPrimary?: boolean; // Update primary status
  structuredData?: StructuredResumeData; // Update structured data
}

/**
 * Resume summary for listing/display purposes
 * Lightweight version without full structured data
 */
export interface ResumeSummary {
  id: string;
  name: string;
  fileName: string;
  resumeUrl?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Options for filtering resumes
 */
export interface ResumeFilterOptions {
  isActive?: boolean; // Filter by active status
  isPrimary?: boolean; // Filter by primary status
  candidateId?: string; // Filter by candidate ID
}

/**
 * Options for sorting resumes
 */
export type ResumeSortOption = 
  | 'createdAt' // Sort by creation date (newest first)
  | 'createdAtAsc' // Sort by creation date (oldest first)
  | 'name' // Sort alphabetically by name
  | 'primaryFirst'; // Primary resume first, then others

/**
 * Helper type for resume operations
 * Can be used to create utility functions for managing resumes
 */
export type ResumeOperation = 
  | { type: 'create'; data: CreateResumeInput }
  | { type: 'update'; id: string; data: UpdateResumeInput }
  | { type: 'delete'; id: string }
  | { type: 'setPrimary'; id: string }
  | { type: 'setActive'; id: string; isActive: boolean };

