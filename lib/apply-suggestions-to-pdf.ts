/**
 * Applies accepted resume suggestions to create an updated PDF
 * Note: This generates a NEW formatted PDF rather than editing the original
 * to avoid layout/formatting issues with direct PDF manipulation
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  let updatedText = originalText;

  // Sort suggestions by original text length (longest first)
  // to avoid partial replacements
  const sortedSuggestions = [...acceptedSuggestions].sort(
    (a, b) => b.original.length - a.original.length
  );

  for (const suggestion of sortedSuggestions) {
    // Use case-sensitive replacement to maintain accuracy
    updatedText = updatedText.replace(suggestion.original, suggestion.suggested);
  }

  return updatedText;
}

/**
 * Generates a new PDF from updated resume text
 * This creates a clean, formatted PDF with the suggestions applied
 */
export async function generateUpdatedResumePDF(
  updatedText: string,
  candidateName: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]); // US Letter size
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - 2 * margin;
  let yPosition = height - margin;

  const fontSize = 11;
  const lineHeight = fontSize * 1.5;
  const titleFontSize = 14;

  // Split text into lines and paragraphs
  const paragraphs = updatedText.split('\n').filter(line => line.trim().length > 0);

  for (const paragraph of paragraphs) {
    // Check if this looks like a section header (all caps or short line)
    const isHeader =
      paragraph === paragraph.toUpperCase() ||
      paragraph.length < 30 && !paragraph.includes(',');

    const currentFont = isHeader ? boldFont : font;
    const currentFontSize = isHeader ? titleFontSize : fontSize;

    // Word wrap the paragraph
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = currentFont.widthOfTextAtSize(testLine, currentFontSize);

      if (textWidth > maxWidth && currentLine) {
        // Check if we need a new page
        if (yPosition < margin + lineHeight) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - margin;
        }

        // Draw the current line
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: currentFontSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        });

        yPosition -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Draw the last line of the paragraph
    if (currentLine) {
      if (yPosition < margin + lineHeight) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - margin;
      }

      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: currentFontSize,
        font: currentFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;
    }

    // Add extra space after headers and paragraphs
    yPosition -= lineHeight * 0.3;
  }

  return await pdfDoc.save();
}

/**
 * Main function to apply suggestions and generate updated PDF
 */
export async function applyResumeSuggestions(
  originalText: string,
  acceptedSuggestions: Suggestion[],
  candidateName: string
): Promise<Uint8Array> {
  // Apply text suggestions
  const updatedText = applyTextSuggestions(originalText, acceptedSuggestions);

  // Generate new PDF with updated text
  const pdfBytes = await generateUpdatedResumePDF(updatedText, candidateName);

  return pdfBytes;
}
