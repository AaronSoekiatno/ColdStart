'use client';

import { useState, useEffect, useRef } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';

export interface CandidateFilters {
    role: string | null;
    job_type: string | null;
    exp: string | null;
    university: string | null;
    verified: boolean;
    min_score: number | null;
}

interface CandidateFilterBarProps {
    filters: CandidateFilters;
    onFilterChange: (filters: CandidateFilters) => void;
    universitySuggestions?: string[];
}

export default function CandidateFilterBar({ filters, onFilterChange, universitySuggestions = [] }: CandidateFilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localUniversity, setLocalUniversity] = useState(filters.university || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const suggestionBoxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update local state when filters change externally (e.g., clear filters)
    useEffect(() => {
        setLocalUniversity(filters.university || '');
    }, [filters.university]);

    // Debounce university input
    useEffect(() => {
        const timer = setTimeout(() => {
            // Only update if the value actually changed
            if (localUniversity !== (filters.university || '')) {
                onFilterChange({ ...filters, university: localUniversity || null });
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localUniversity]);

    // Filter suggestions based on input
    useEffect(() => {
        if (localUniversity.trim() && universitySuggestions.length > 0) {
            const query = localUniversity.toLowerCase();
            const matches = universitySuggestions
                .filter(uni => uni.toLowerCase().includes(query))
                .slice(0, 8); // Limit to 8 suggestions
            setFilteredSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
        }
    }, [localUniversity, universitySuggestions]);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                suggestionBoxRef.current &&
                !suggestionBoxRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateFilter = (key: keyof CandidateFilters, value: any) => {
        onFilterChange({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        onFilterChange({
            role: null,
            job_type: null,
            exp: null,
            university: null,
            verified: false,
            min_score: null,
        });
        setLocalUniversity('');
    };

    const hasActiveFilters = Object.values(filters).some(
        (v) => v !== null && v !== false
    );

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 transition-all">
            <div className="p-4 flex flex-col gap-4">
                {/* Top Row: Primary Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-black mr-2">
                        <Filter className="w-5 h-5" />
                        <span className="text-sm font-medium">Filters</span>
                    </div>

                    {/* Role Filter */}
                    <select
                        value={filters.role || ''}
                        onChange={(e) => updateFilter('role', e.target.value || null)}
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 text-black"
                    >
                        <option value="">All Roles</option>
                        <option value="Backend">Backend</option>
                        <option value="Frontend">Frontend</option>
                        <option value="Fullstack">Fullstack</option>
                        <option value="Mobile">Mobile</option>
                        <option value="DevOps">DevOps</option>
                        <option value="AI/ML">AI/ML</option>
                    </select>

                    {/* Job Type Filter */}
                    <select
                        value={filters.job_type || ''}
                        onChange={(e) => updateFilter('job_type', e.target.value || null)}
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 text-black"
                    >
                        <option value="">All Job Types</option>
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="internship">Internship</option>
                    </select>

                    {/* Experience Filter */}
                    <select
                        value={filters.exp || ''}
                        onChange={(e) => updateFilter('exp', e.target.value || null)}
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 text-black"
                    >
                        <option value="">Any Experience</option>
                        <option value="1">1+ years</option>
                        <option value="2">2+ years</option>
                        <option value="3">3+ years</option>
                        <option value="5">5+ years</option>
                        <option value="Senior">Senior</option>
                    </select>

                    {/* University Input */}
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="University..."
                            value={localUniversity}
                            onChange={(e) => {
                                setLocalUniversity(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => {
                                if (filteredSuggestions.length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 w-40 text-black placeholder:text-gray-500"
                        />
                        {showSuggestions && filteredSuggestions.length > 0 && (
                            <div
                                ref={suggestionBoxRef}
                                className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                            >
                                {filteredSuggestions.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => {
                                            setLocalUniversity(suggestion);
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-black hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Verified Toggle */}
                    <button
                        onClick={() => updateFilter('verified', !filters.verified)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-colors ${filters.verified
                            ? 'bg-blue-50 border-blue-200 text-black'
                            : 'bg-white border-gray-300 text-black hover:bg-gray-50'
                            }`}
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${filters.verified ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                            }`}>
                            {filters.verified && <Check className="w-3 h-3 text-white" />}
                        </div>
                        Verified Only
                    </button>

                    {/* Min Score Filter */}
                    <select
                        value={filters.min_score || ''}
                        onChange={(e) => updateFilter('min_score', e.target.value ? parseInt(e.target.value) : null)}
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 text-black"
                    >
                        <option value="">Any Score</option>
                        <option value="60">60+ (Good)</option>
                        <option value="80">80+ (Excellent)</option>
                        <option value="90">90+ (Top Tier)</option>
                    </select>


                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="ml-auto text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                            <X className="w-4 h-4" />
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
