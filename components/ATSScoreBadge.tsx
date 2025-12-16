'use client';

import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface ATSScoreBadgeProps {
  score: number;
  category: 'Excellent' | 'Good' | 'Needs Work';
  suggestions: string[];
  isLoading?: boolean;
}

const SCORE_MESSAGES = {
  'Excellent': 'Excellent - Will most likely pass ATS screening',
  'Good': 'Good - Strong chance of passing ATS screening',
  'Needs Work': 'Needs Work - Consider enhancing for ATS',
};

const SCORE_COLORS = {
  'Excellent': {
    ring: 'stroke-green-500',
    text: 'text-green-600',
    bg: 'bg-green-50',
  },
  'Good': {
    ring: 'stroke-yellow-500',
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  'Needs Work': {
    ring: 'stroke-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
  },
};

export function ATSScoreBadge({ score, category, suggestions, isLoading }: ATSScoreBadgeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate score counting from 0 to final value
  useEffect(() => {
    if (isLoading || score === 0) {
      setDisplayScore(0);
      return;
    }

    setIsAnimating(true);
    let start = 0;
    const end = score;
    const duration = 1000; // 1 second
    const incrementTime = 16; // ~60fps
    const increment = end / (duration / incrementTime);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayScore(end);
        clearInterval(timer);
        setIsAnimating(false);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [score, isLoading]);

  const colors = SCORE_COLORS[category];
  const radius = 28; // Increased from 22
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-20 h-20">
          {/* Loading skeleton */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-gray-200"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <span className="text-sm text-gray-500">Calculating...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2.5 cursor-help">
            {/* Circular progress indicator */}
            <div className="relative w-20 h-20">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="none"
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className={`${colors.ring} transition-all duration-500 ease-out`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Score text in center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${colors.text}`}>
                  {displayScore}%
                </span>
              </div>
            </div>

            {/* Info icon */}
            <Info className={`w-5 h-5 ${colors.text} opacity-60`} />
          </div>
        </TooltipTrigger>

        <TooltipContent
          side="right"
          align="center"
          className="max-w-md p-4"
          sideOffset={8}
        >
          <div className="flex gap-6">
            {/* Category and message on left */}
            <div className="flex-shrink-0">
              <div className="font-semibold text-sm mb-1">{category}</div>
              <div className="text-xs text-gray-600">
                {SCORE_MESSAGES[category]}
              </div>
            </div>

            {/* Suggestions on right */}
            {suggestions && suggestions.length > 0 && (
              <div className="flex-1 border-l border-gray-200 pl-6">
                <div className="font-semibold text-xs mb-1.5">
                  Areas for Improvement:
                </div>
                <ul className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
