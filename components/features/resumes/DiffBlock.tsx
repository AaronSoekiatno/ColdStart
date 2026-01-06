"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateInlineDiff, type DiffPart } from "@/lib/inline-diff";

interface DiffBlockProps {
  suggestion: {
    id: string;
    section: string;
    original: string;
    suggested: string;
    reason: string;
    keywords: string[];
  };
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
}

export function DiffBlock({ suggestion, status, onAccept, onReject }: DiffBlockProps) {
  // Calculate inline diff for word-level changes
  const diffParts = calculateInlineDiff(suggestion.original, suggestion.suggested);

  // Render inline diff with Grammarly-style highlighting
  const renderInlineDiff = () => {
    return (
      <div className="leading-relaxed text-sm text-gray-900">
        {diffParts.map((part, index) => {
          if (part.type === 'removed') {
            // Red strikethrough for removed text
            return (
              <span
                key={index}
                className="bg-red-100 text-red-700 line-through decoration-red-500 decoration-2"
              >
                {part.text}
              </span>
            );
          } else if (part.type === 'added') {
            // Green highlight for added text
            return (
              <span
                key={index}
                className="bg-green-100 text-green-700 font-medium"
              >
                {part.text}
              </span>
            );
          } else {
            // Unchanged text
            return <span key={index}>{part.text}</span>;
          }
        })}
      </div>
    );
  };

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden transition-all ${
      status === 'accepted' ? 'border-green-500/50 bg-green-50' :
      status === 'rejected' ? 'border-red-500/30 bg-red-50 opacity-50' :
      'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-700 font-medium">{suggestion.section}</span>
        {status === 'pending' && (
          <div className="flex gap-1">
            <Button
              onClick={onAccept}
              size="sm"
              className="h-7 px-2 text-xs bg-green-100 hover:bg-green-200 text-green-700 border border-green-300"
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              onClick={onReject}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
        {status === 'accepted' && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            Accepted
          </div>
        )}
        {status === 'rejected' && (
          <div className="flex items-center gap-1 text-xs text-red-600/70">
            <X className="h-3 w-3" />
            Rejected
          </div>
        )}
      </div>

      {/* Inline Diff Content */}
      <div className="px-4 py-3">
        {renderInlineDiff()}
      </div>

      {/* Reason */}
      <div className="bg-blue-50 px-3 py-2 border-t border-gray-200">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 text-xs mt-0.5">💡</span>
          <div className="flex-1">
            <p className="text-xs text-blue-700">{suggestion.reason}</p>
            {suggestion.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestion.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs border border-blue-200"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
