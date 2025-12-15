"use client";

import { useEffect, useState, useMemo } from 'react';

interface Suggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

interface LiveResumePreviewProps {
  originalText: string;
  acceptedSuggestions: Suggestion[];
}

export function LiveResumePreview({ originalText, acceptedSuggestions }: LiveResumePreviewProps) {
  // Apply all accepted suggestions to the text
  const updatedText = useMemo(() => {
    let text = originalText;

    // Sort suggestions by original text length (longest first)
    // to avoid partial replacements
    const sortedSuggestions = [...acceptedSuggestions].sort(
      (a, b) => b.original.length - a.original.length
    );

    for (const suggestion of sortedSuggestions) {
      text = text.replace(suggestion.original, suggestion.suggested);
    }

    return text;
  }, [originalText, acceptedSuggestions]);

  // Split into lines and highlight changes
  const renderHighlightedText = useMemo(() => {
    const lines = updatedText.split('\n');

    return lines.map((line, index) => {
      // Check if this line contains any accepted suggestion
      const hasChange = acceptedSuggestions.some(s =>
        line.includes(s.suggested)
      );

      return (
        <div
          key={index}
          className={`py-1 px-3 ${
            hasChange
              ? 'bg-green-50 border-l-2 border-l-green-400'
              : ''
          }`}
        >
          {line || '\u00A0'} {/* Non-breaking space for empty lines */}
        </div>
      );
    });
  }, [updatedText, acceptedSuggestions]);

  return (
    <div className="w-full h-full overflow-auto bg-white border border-gray-300 rounded-lg">
      <div className="p-6 font-mono text-sm text-gray-900 whitespace-pre-wrap">
        {renderHighlightedText}
      </div>
    </div>
  );
}
