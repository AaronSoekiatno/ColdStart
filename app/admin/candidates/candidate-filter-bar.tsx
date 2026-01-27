'use client';

import { useState, useEffect } from 'react';
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
}

export default function CandidateFilterBar({ filters, onFilterChange }: CandidateFilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localUniversity, setLocalUniversity] = useState(filters.university || '');

    // Debounce university input
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentUni = filters.university || '';
            // Only update if the value effectively changed (treating null and '' as same)
            if (localUniversity !== currentUni) {
                onFilterChange({ ...filters, university: localUniversity || null });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localUniversity, filters, onFilterChange]);

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
                    <div className="flex items-center gap-2 text-gray-500 mr-2">
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
                            type="text"
                            placeholder="University..."
                            value={localUniversity}
                            onChange={(e) => setLocalUniversity(e.target.value)}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 w-40 text-black"
                        />
                    </div>

                    {/* Verified Toggle */}
                    <button
                        onClick={() => updateFilter('verified', !filters.verified)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-colors ${filters.verified
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
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
