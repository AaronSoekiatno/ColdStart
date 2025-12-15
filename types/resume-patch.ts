/**
 * Resume patch types for schema-driven editing
 * 
 * This defines the structure for JSON patches that can be applied
 * to StructuredResumeData to make deterministic, reversible edits.
 */

import type { StructuredResumeData } from './resume';

/**
 * JSONPath format for targeting specific fields in the resume schema
 * Examples:
 * - "personal.name"
 * - "experience[0].description[1]"
 * - "skills[2]"
 * - "projects[1].technologies[0]"
 */
export type ResumePath = string;

/**
 * Patch operation types
 */
export type PatchType = 'edit' | 'add' | 'remove';

/**
 * A single patch operation that modifies the resume schema
 */
export interface ResumePatch {
  /** Unique identifier for this patch */
  id: string;
  
  /** Type of operation */
  type: PatchType;
  
  /** JSONPath to the field being modified */
  path: ResumePath;
  
  /** Old value (for validation and undo) */
  oldValue?: any;
  
  /** New value to apply */
  newValue: any;
  
  /** Human-readable reason for this change */
  reason: string;

  /** Section name for UI display */
  section?: string;
}

/**
 * Result of applying a patch
 */
export interface PatchResult {
  /** Whether the patch was successfully applied */
  success: boolean;
  
  /** Error message if application failed */
  error?: string;
  
  /** Updated resume data */
  updatedData: StructuredResumeData;
  
  /** Path that was modified (for highlighting) */
  modifiedPath?: ResumePath;
}

/**
 * Result of applying multiple patches
 */
export interface ApplyPatchesResult {
  /** Updated resume data */
  updatedData: StructuredResumeData;
  
  /** Set of paths that were modified (for highlighting) */
  modifiedPaths: Set<ResumePath>;
  
  /** Patches that failed to apply */
  failedPatches: ResumePatch[];
}

