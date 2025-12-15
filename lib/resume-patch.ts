/**
 * Resume patch utilities for applying JSON patches to StructuredResumeData
 * 
 * This module provides functions to apply patches using JSONPath notation
 * to make deterministic, reversible edits to the resume schema.
 */

import type { StructuredResumeData } from '@/types/resume';
import type { ResumePatch, ResumePath, PatchResult, ApplyPatchesResult } from '@/types/resume-patch';

/**
 * Parses a JSONPath string into an array of path segments
 * Handles both dot notation and bracket notation
 * 
 * Examples:
 * - "personal.name" -> ["personal", "name"]
 * - "experience[0].description[1]" -> ["experience", "0", "description", "1"]
 * - "skills[2]" -> ["skills", "2"]
 */
function parsePath(path: ResumePath): string[] {
  // Split by dots, then handle bracket notation
  const segments: string[] = [];
  let current = '';
  
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    
    if (char === '.') {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      // Find the closing bracket
      let bracketContent = '';
      i++; // Skip the opening bracket
      while (i < path.length && path[i] !== ']') {
        bracketContent += path[i];
        i++;
      }
      segments.push(bracketContent);
    } else {
      current += char;
    }
  }
  
  if (current) {
    segments.push(current);
  }
  
  return segments;
}

/**
 * Gets a value from an object using a JSONPath
 */
function getValueAtPath(obj: any, path: ResumePath): any {
  const segments = parsePath(path);
  let current = obj;
  
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Handle array indices
    const numIndex = parseInt(segment, 10);
    if (!isNaN(numIndex) && Array.isArray(current)) {
      current = current[numIndex];
    } else {
      current = current[segment];
    }
  }
  
  return current;
}

/**
 * Sets a value in an object using a JSONPath
 * Creates intermediate objects/arrays as needed
 */
function setValueAtPath(obj: any, path: ResumePath, value: any): void {
  const segments = parsePath(path);
  let current = obj;
  
  // Navigate to the parent of the target
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const numIndex = parseInt(segment, 10);
    
    if (!isNaN(numIndex)) {
      // Array index
      if (!Array.isArray(current)) {
        throw new Error(`Cannot use array index on non-array at path: ${segments.slice(0, i + 1).join('.')}`);
      }
      // Ensure array is large enough
      while (current.length <= numIndex) {
        current.push(null);
      }
      if (current[numIndex] === null || current[numIndex] === undefined) {
        // Determine if next segment is an array index
        const nextSegment = segments[i + 1];
        const nextNumIndex = parseInt(nextSegment, 10);
        current[numIndex] = !isNaN(nextNumIndex) ? [] : {};
      }
      current = current[numIndex];
    } else {
      // Object property
      if (current[segment] === null || current[segment] === undefined) {
        // Determine if next segment is an array index
        const nextSegment = segments[i + 1];
        const nextNumIndex = parseInt(nextSegment, 10);
        current[segment] = !isNaN(nextNumIndex) ? [] : {};
      }
      current = current[segment];
    }
  }
  
  // Set the final value
  const finalSegment = segments[segments.length - 1];
  const numIndex = parseInt(finalSegment, 10);
  
  if (!isNaN(numIndex)) {
    // Array index
    if (!Array.isArray(current)) {
      throw new Error(`Cannot use array index on non-array at path: ${path}`);
    }
    // Ensure array is large enough
    while (current.length <= numIndex) {
      current.push(null);
    }
    current[numIndex] = value;
  } else {
    // Object property
    current[finalSegment] = value;
  }
}

/**
 * Removes a value from an object/array using a JSONPath
 */
function removeValueAtPath(obj: any, path: ResumePath): void {
  const segments = parsePath(path);
  let current = obj;
  
  // Navigate to the parent
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const numIndex = parseInt(segment, 10);
    
    if (!isNaN(numIndex)) {
      if (!Array.isArray(current) || current.length <= numIndex) {
        return; // Path doesn't exist
      }
      current = current[numIndex];
    } else {
      if (current[segment] === null || current[segment] === undefined) {
        return; // Path doesn't exist
      }
      current = current[segment];
    }
  }
  
  // Remove the final value
  const finalSegment = segments[segments.length - 1];
  const numIndex = parseInt(finalSegment, 10);
  
  if (!isNaN(numIndex)) {
    // Array index
    if (Array.isArray(current) && current.length > numIndex) {
      current.splice(numIndex, 1);
    }
  } else {
    // Object property
    delete current[finalSegment];
  }
}

/**
 * Applies a single patch to the resume data
 */
export function applyPatch(
  data: StructuredResumeData,
  patch: ResumePatch
): PatchResult {
  try {
    // Deep clone the data
    const updated = JSON.parse(JSON.stringify(data)) as StructuredResumeData;
    
    // Validate old value if provided
    if (patch.oldValue !== undefined) {
      const currentValue = getValueAtPath(updated, patch.path);
      // Allow loose comparison for strings (trim whitespace)
      if (typeof currentValue === 'string' && typeof patch.oldValue === 'string') {
        if (currentValue.trim() !== patch.oldValue.trim()) {
          return {
            success: false,
            error: `Value mismatch at path ${patch.path}. Expected: "${patch.oldValue}", found: "${currentValue}"`,
            updatedData: data,
          };
        }
      } else if (JSON.stringify(currentValue) !== JSON.stringify(patch.oldValue)) {
        return {
          success: false,
          error: `Value mismatch at path ${patch.path}`,
          updatedData: data,
        };
      }
    }
    
    // Apply the patch based on type
    switch (patch.type) {
      case 'edit':
        setValueAtPath(updated, patch.path, patch.newValue);
        break;
      case 'add':
        // For arrays, add to the end if no index specified
        const segments = parsePath(patch.path);
        const lastSegment = segments[segments.length - 1];
        const numIndex = parseInt(lastSegment, 10);
        
        if (isNaN(numIndex)) {
          // Not an array index, treat as edit
          setValueAtPath(updated, patch.path, patch.newValue);
        } else {
          // Array index - insert at position
          const parentPath = segments.slice(0, -1).join('.');
          const parent = getValueAtPath(updated, parentPath);
          if (Array.isArray(parent)) {
            parent.splice(numIndex, 0, patch.newValue);
          } else {
            setValueAtPath(updated, patch.path, patch.newValue);
          }
        }
        break;
      case 'remove':
        removeValueAtPath(updated, patch.path);
        break;
      default:
        return {
          success: false,
          error: `Unknown patch type: ${(patch as any).type}`,
          updatedData: data,
        };
    }
    
    return {
      success: true,
      updatedData: updated,
      modifiedPath: patch.path,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error applying patch',
      updatedData: data,
    };
  }
}

/**
 * Applies multiple patches to the resume data
 */
export function applyPatches(
  data: StructuredResumeData,
  patches: ResumePatch[]
): ApplyPatchesResult {
  let currentData = JSON.parse(JSON.stringify(data)) as StructuredResumeData;
  const modifiedPaths = new Set<ResumePath>();
  const failedPatches: ResumePatch[] = [];
  
  for (const patch of patches) {
    const result = applyPatch(currentData, patch);
    
    if (result.success) {
      currentData = result.updatedData;
      if (result.modifiedPath) {
        modifiedPaths.add(result.modifiedPath);
      }
    } else {
      failedPatches.push(patch);
      console.warn(`Failed to apply patch ${patch.id}:`, result.error);
    }
  }
  
  return {
    updatedData: currentData,
    modifiedPaths,
    failedPatches,
  };
}

