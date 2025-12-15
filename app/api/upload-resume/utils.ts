import mammoth from 'mammoth';

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types and extensions
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Validates the uploaded file for type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided. Please upload a resume.' };
  }

  const fileName = file.name.toLowerCase();
  const isValidType =
    ALLOWED_MIME_TYPES.includes(file.type) ||
    ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!isValidType) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Please upload a PDF (.pdf) or Word document (.docx).`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds the maximum allowed size of 10MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'The uploaded file is empty.' };
  }

  return { valid: true };
}

/**
 * Determines if a file is a PDF based on MIME type or extension
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Extracts text from a PDF buffer using pdf-parse
 * Uses dynamic import to handle CommonJS module compatibility
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer provided to extractPdfText');
    }

    if (buffer.length === 0) {
      throw new Error('Empty buffer provided to extractPdfText');
    }

    console.log(`Attempting to parse PDF buffer of ${buffer.length} bytes`);

    // Import the actual pdf-parse library directly from lib/pdf-parse.js
    // This bypasses the index.js file which has problematic test code that
    // runs when module.parent is undefined (common in Next.js webpack builds)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');

    if (typeof pdfParse !== 'function') {
      throw new Error(`pdf-parse module did not export a function. Got type: ${typeof pdfParse}`);
    }

    // Call the function directly with the buffer
    // Pass options to disable external file handlers
    const result = await pdfParse(buffer, {
      // Disable max pages to parse all pages
      max: 0,
    });

    if (!result || typeof result !== 'object') {
      throw new Error(`pdf-parse returned invalid result: ${typeof result}`);
    }

    const extractedText = result.text || '';
    console.log(`Successfully extracted ${extractedText.length} characters from PDF`);

    return extractedText;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('PDF extraction error details:', { message, stack, bufferLength: buffer?.length });
    throw new Error(`Failed to parse PDF: ${message}`);
  }
}

/**
 * Extracts text from a DOCX buffer using mammoth
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse DOCX: ${message}`);
  }
}

/**
 * Cleans JSON response from Gemini by removing markdown code blocks
 */
export function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();

  // Remove markdown code block markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Interface for the resume extraction response from Gemini
 */
export interface ResumeExtractionResult {
  name: string;
  email: string;
  skills: string[];
  summary: string;
  location: string;
  education_level: string;
  university: string;
  past_internships: string[];
  technical_projects: string[];
}

/**
 * Interface for the final API response
 */
export interface ResumeProcessingResult {
  success: boolean;
  rawText: string;
  name: string;
  email: string;
  skills: string[];
  summary: string;
  location: string;
  education_level: string;
  university: string;
  past_internships: string[];
  technical_projects: string[];
  embedding: number[];
  savedToDatabase: boolean;
  matches: Array<{
    startup: any;
    score: number;
    id: string;
  }>;
  databaseError?: string;
  matchingError?: string;
}
