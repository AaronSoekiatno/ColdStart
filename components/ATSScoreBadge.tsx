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
  category: 'Excellent' | 'Okay';
  suggestions: string[];
  isLoading?: boolean;
}

const SCORE_MESSAGES = {
  'Excellent!': 'Excellent! Will most likely pass ATS screening',
  'Okay': 'Okay - Might pass ATS screening',
};

const SCORE_COLORS = {
  'Excellent!': {
    ring: 'stroke-green-500',
    text: 'text-green-600',
    bg: 'bg-green-50',
  },
  'Okay': {
    ring: 'stroke-yellow-500',
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
};

// Map API category to display category
function getDisplayCategory(category: 'Excellent' | 'Okay'): 'Excellent!' | 'Okay' {
  return category === 'Excellent' ? 'Excellent!' : category;
}

export function ATSScoreBadge({ score, category, suggestions, isLoading }: ATSScoreBadgeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const displayCategory = getDisplayCategory(category);

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

  const colors = SCORE_COLORS[displayCategory];
  const radius = 32; // Increased for better visibility
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-28 h-28">
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
          <div className="flex items-center cursor-pointer">
            {/* Circular progress indicator */}
            <div className="relative w-28 h-28">
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
                <span className={`text-xl font-bold ${colors.text} leading-tight`}>
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
          className="max-w-xs p-2.5"
          sideOffset={4}
        >
          {suggestions && suggestions.length > 0 ? (
            <div className="text-xs text-gray-700">
              <div className="font-semibold">{SCORE_MESSAGES[displayCategory]}</div>
              <div className="mt-1">{suggestions[0]}</div>
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              {SCORE_MESSAGES[displayCategory]}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
