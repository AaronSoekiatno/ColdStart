/**
 * Generates a DOCX file from resume text with applied suggestions
 */

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';

interface Suggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

/**
 * Applies suggestions to resume text
 */
export function applyTextSuggestions(
  originalText: string,
  acceptedSuggestions: Suggestion[]
): string {
  let text = originalText;

  // Sort suggestions by original text length (longest first)
  const sortedSuggestions = [...acceptedSuggestions].sort(
    (a, b) => b.original.length - a.original.length
  );

  for (const suggestion of sortedSuggestions) {
    text = text.replace(suggestion.original, suggestion.suggested);
  }

  return text;
}

/**
 * Detects if a line is a section header
 */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length > 0 &&
    (trimmed === trimmed.toUpperCase() && trimmed.length < 30 ||
     trimmed.endsWith(':'))
  );
}

/**
 * Generates a DOCX file from resume text
 */
export async function generateResumeDocx(
  resumeText: string,
  acceptedSuggestions: Suggestion[]
): Promise<Blob> {
  // Apply suggestions to text
  const updatedText = applyTextSuggestions(resumeText, acceptedSuggestions);

  // Parse text into paragraphs
  const lines = updatedText.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed.length === 0) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Section headers
    if (isSectionHeader(trimmed)) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(':', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 240,
            after: 120,
          },
        })
      );
    }
    // Bullet points
    else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(/^[•\-*]\s*/, ''),
          bullet: {
            level: 0,
          },
          spacing: {
            before: 60,
            after: 60,
          },
        })
      );
    }
    // Regular text
    else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: 22, // 11pt
            }),
          ],
          spacing: {
            before: 60,
            after: 60,
          },
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,    // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  // Generate DOCX blob
  const buffer = await Packer.toBlob(doc);
  return buffer;
}
