"use client";

import { useEffect, useState, useMemo } from 'react';

interface Suggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

interface EditableResumePreviewProps {
  originalText: string;
  acceptedSuggestions: Suggestion[];
}

export function EditableResumePreview({ originalText, acceptedSuggestions }: EditableResumePreviewProps) {
  // Apply all accepted suggestions to the text
  const updatedText = useMemo(() => {
    let text = originalText;

    // Sort suggestions by original text length (longest first)
    // to avoid partial replacements
    const sortedSuggestions = [...acceptedSuggestions].sort(
      (a, b) => b.original.length - a.original.length
    );

    for (const suggestion of sortedSuggestions) {
      // Normalize whitespace for matching
      const normalizedOriginal = suggestion.original.trim().replace(/\s+/g, ' ');
      const normalizedText = text.replace(/\s+/g, ' ');
      
      // Find and replace all occurrences (not just first)
      const regex = new RegExp(suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      text = text.replace(regex, suggestion.suggested);
    }

    return text;
  }, [originalText, acceptedSuggestions]);

  // Format text into styled sections
  const renderFormattedContent = useMemo(() => {
    const lines = updatedText.split('\n');
    const sections: JSX.Element[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this line contains an accepted suggestion
      const hasChange = acceptedSuggestions.some(s =>
        line.includes(s.suggested)
      );

      // Detect section headers (all caps, short lines, or lines ending with colon)
      const isHeader =
        trimmedLine.length > 0 &&
        (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 30 ||
         trimmedLine.endsWith(':'));

      // Empty lines
      if (trimmedLine.length === 0) {
        sections.push(<div key={i} className="h-4" />);
        continue;
      }

      // Header styling
      if (isHeader) {
        sections.push(
          <div
            key={i}
            className={`font-bold text-base mb-2 mt-4 ${
              hasChange ? 'bg-green-100 px-2 py-1 border-l-4 border-green-500' : ''
            }`}
          >
            {trimmedLine}
          </div>
        );
      }
      // Bullet points
      else if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        sections.push(
          <div
            key={i}
            className={`ml-4 mb-1 ${
              hasChange ? 'bg-green-50 px-2 py-1 border-l-2 border-green-400' : ''
            }`}
          >
            {trimmedLine}
          </div>
        );
      }
      // Regular content
      else {
        sections.push(
          <div
            key={i}
            className={`mb-1 ${
              hasChange ? 'bg-green-50 px-2 py-1 border-l-2 border-green-400' : ''
            }`}
          >
            {trimmedLine}
          </div>
        );
      }
    }

    return sections;
  }, [updatedText, acceptedSuggestions]);

  return (
    <div className="w-full h-full overflow-auto bg-white border border-gray-300 rounded-lg">
      <div className="p-12" style={{ maxWidth: '8.5in', margin: '0 auto' }}>
        <div className="text-gray-900 leading-relaxed text-sm" style={{ lineHeight: '1.6' }}>
          {renderFormattedContent}
        </div>
      </div>
    </div>
  );
}
