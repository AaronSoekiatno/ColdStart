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

