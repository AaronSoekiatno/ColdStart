'use client';

import { useState, useEffect } from 'react';
import { Filter, X, Check } from 'lucide-react';

export interface CompanyCandidateFilters {
  minMatchScore: number | null;
  minExperience: number | null;
  maxExperience: number | null;
  school: string | null;
  primaryLanguage: string | null;
  minQualityScore: number | null;
}

interface CandidateFilterBarProps {
  filters: CompanyCandidateFilters;
  onFilterChange: (filters: CompanyCandidateFilters) => void;
  schoolSuggestions?: string[];
  languageSuggestions?: string[];
}

export default function CandidateFilterBar({
  filters,
  onFilterChange,
  schoolSuggestions = [],
  languageSuggestions = []
}: CandidateFilterBarProps) {
  const updateFilter = (key: keyof CompanyCandidateFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      minMatchScore: null,
      minExperience: null,
      maxExperience: null,
      school: null,
      primaryLanguage: null,
      minQualityScore: null,
    });
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== false
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Match Score Filter */}
      <select
        value={filters.minMatchScore || ''}
        onChange={(e) => updateFilter('minMatchScore', e.target.value ? parseInt(e.target.value) : null)}
        className="text-xs font-medium border-0 rounded-lg py-1.5 pl-2.5 pr-8 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer focus:ring-0"
      >
        <option value="">Match Score</option>
        <option value="70">70%+</option>
        <option value="80">80%+</option>
        <option value="85">85%+</option>
        <option value="90">90%+</option>
      </select>

      {/* Experience Range Filter */}
      <select
        value={filters.minExperience || ''}
        onChange={(e) => updateFilter('minExperience', e.target.value ? parseInt(e.target.value) : null)}
        className="text-xs font-medium border-0 rounded-lg py-1.5 pl-2.5 pr-8 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer focus:ring-0"
      >
        <option value="">Experience</option>
        <option value="1">1+ years</option>
        <option value="2">2+ years</option>
        <option value="3">3+ years</option>
        <option value="4">4+ years</option>
        <option value="5">5+ years</option>
        <option value="6">6+ years</option>
      </select>

      {/* School Filter */}
      <select
        value={filters.school || ''}
        onChange={(e) => updateFilter('school', e.target.value || null)}
        className="text-xs font-medium border-0 rounded-lg py-1.5 pl-2.5 pr-8 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer focus:ring-0 max-w-[120px]"
      >
        <option value="">School</option>
        {schoolSuggestions.map((school) => (
          <option key={school} value={school}>
            {school}
          </option>
        ))}
      </select>

      {/* Primary Language Filter */}
      <select
        value={filters.primaryLanguage || ''}
        onChange={(e) => updateFilter('primaryLanguage', e.target.value || null)}
        className="text-xs font-medium border-0 rounded-lg py-1.5 pl-2.5 pr-8 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer focus:ring-0 max-w-[120px]"
      >
        <option value="">Language</option>
        {languageSuggestions.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>

      {/* Quality Score Filter */}
      <select
        value={filters.minQualityScore || ''}
        onChange={(e) => updateFilter('minQualityScore', e.target.value ? parseInt(e.target.value) : null)}
        className="text-xs font-medium border-0 rounded-lg py-1.5 pl-2.5 pr-8 text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer focus:ring-0"
      >
        <option value="">Quality</option>
        <option value="70">70%+</option>
        <option value="80">80%+</option>
        <option value="85">85%+</option>
        <option value="90">90%+</option>
      </select>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}
