'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SimpleHeader } from '@/components/layout/SimpleHeader';
import CompanyProfileCard from '@/components/company/CompanyProfileCard';
import CandidateBriefCard from '@/components/company/CandidateBriefCard';
import CandidateTable from '@/components/company/CandidateTable';
import AssessmentPreview from '@/components/company/AssessmentPreview';
import AssessmentResultsDashboard from '@/components/company/AssessmentResultsDashboard';
import CandidateAssessmentView from '@/components/company/CandidateAssessmentView';
import CandidateFilterBar, { CompanyCandidateFilters } from '@/components/company/CandidateFilterBar';
import { mockCompany, mockCandidates, mockJobContexts, CandidateBrief } from '@/lib/mockCompanyData';
import { transformAllCandidates } from '@/lib/candidateTransformers';
import { CandidateCompactCard } from '@/components/company/candidates/CandidateCompactCard';
import { CandidateVerdictCard } from '@/components/company/candidates/CandidateVerdictCard';
import { CandidateFullEvidence } from '@/components/company/candidates/CandidateFullEvidence';
import { Loader2, Users, Sparkles, FileCode2, Building2, Search, Settings, HelpCircle, LayoutGrid, Puzzle, Plug, Filter, X, Globe, ChevronDown, LayoutList, Github, Linkedin, Twitter, Terminal, Layers, Server, Monitor, Cpu, List, FileSpreadsheet, CircleDashed, Briefcase, TrendingUp, Clock, MapPin, ChevronRight, Award, Code2, GraduationCap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CompanyDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'assessment' | 'profile' | 'discover' | 'integrations'>('candidates');
  const [assessmentSubTab, setAssessmentSubTab] = useState<'results' | 'configuration' | 'candidate-view'>('results');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [hasSearched, setHasSearched] = useState(false);

  // Candidates Tab State
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCandidates, setFilteredCandidates] = useState<CandidateBrief[]>(
    transformAllCandidates(mockCandidates)
  );
  const [candidateFilters, setCandidateFilters] = useState<CompanyCandidateFilters>({
    minMatchScore: null,
    minExperience: null,
    maxExperience: null,
    school: null,
    primaryLanguage: null,
    minQualityScore: null,
  });
  const [expandedVerdictId, setExpandedVerdictId] = useState<string | null>(null);
  const [expandedFullEvidenceId, setExpandedFullEvidenceId] = useState<string | null>(null);

  // Discover Tab Filter States
  const [searchModes, setSearchModes] = useState<string[]>(['Smart (AI picks sources)']);
  const [jobContext, setJobContext] = useState('Optional');
  const [resultsPerSearch, setResultsPerSearch] = useState('20 results');
  const [viewFilter, setViewFilter] = useState('Classic');

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.push('/login?redirect=/company-dashboard');
        return;
      }

      setUserEmail(session.user.email || null);
      setLoading(false);
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Filter and search candidates
  useEffect(() => {
    let filtered = transformAllCandidates([...mockCandidates]);

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.anonymized_name?.toLowerCase()?.includes(query) ||
          c.school?.toLowerCase()?.includes(query) ||
          c.github_analysis.top_languages.some((lang) =>
            lang.language.toLowerCase().includes(query)
          )
      );
    }

    // Apply filters
    if (candidateFilters.minMatchScore) {
      filtered = filtered.filter((c) => c.match_score >= candidateFilters.minMatchScore!);
    }

    if (candidateFilters.minExperience) {
      filtered = filtered.filter((c) => c.years_of_experience >= candidateFilters.minExperience!);
    }

    if (candidateFilters.maxExperience) {
      filtered = filtered.filter((c) => c.years_of_experience <= candidateFilters.maxExperience!);
    }

    if (candidateFilters.school) {
      filtered = filtered.filter((c) => c.school === candidateFilters.school);
    }

    if (candidateFilters.primaryLanguage) {
      filtered = filtered.filter(
        (c) => c.github_analysis.top_languages[0]?.language === candidateFilters.primaryLanguage
      );
    }

    if (candidateFilters.minQualityScore) {
      filtered = filtered.filter(
        (c) => c.github_analysis.quality_score >= candidateFilters.minQualityScore!
      );
    }

    setFilteredCandidates(filtered);
  }, [searchQuery, candidateFilters]);

  // Extract unique schools and languages for filter dropdowns
  const schoolSuggestions = Array.from(new Set(mockCandidates.map((c) => c.school))).sort();
  const languageSuggestions = Array.from(
    new Set(mockCandidates.map((c) => c.github_analysis.top_languages[0]?.language).filter(Boolean))
  ).sort();

  // Calculate stats for candidates tab
  const avgMatchScore = filteredCandidates.length > 0
    ? Math.round(filteredCandidates.reduce((sum, c) => sum + c.match_score, 0) / filteredCandidates.length)
    : 0;
  const avgQualityScore = filteredCandidates.length > 0
    ? Math.round(filteredCandidates.reduce((sum, c) => sum + c.github_analysis.quality_score, 0) / filteredCandidates.length)
    : 0;
  const avgExperience = filteredCandidates.length > 0
    ? (filteredCandidates.reduce((sum, c) => sum + c.years_of_experience, 0) / filteredCandidates.length).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const sidebarItems = [
    { id: 'discover', label: 'Discover', icon: Search },
    { id: 'candidates', label: 'Candidates', icon: Users, count: filteredCandidates.length },
    { id: 'assessment', label: 'Assessment', icon: FileCode2 },
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'integrations', label: 'Integrations', icon: Plug },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <SimpleHeader userEmail={userEmail} />

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside className="w-60 bg-white border-r border-gray-200 fixed bottom-0 top-16 left-0 overflow-y-auto hidden md:block">
          <div className="p-4 space-y-1">
            <div className="mb-6 px-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Recruiter
              </h2>
            </div>

            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-black text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 mt-auto border-t border-gray-100">
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Settings className="w-4 h-4 text-gray-500" />
                <span>Settings</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <HelpCircle className="w-4 h-4 text-gray-500" />
                <span>Help & Support</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-60 p-8 min-w-0 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Header Area for Content */}
            <div className="flex justify-between items-end pb-4 border-b border-gray-200/60 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {activeTab === 'discover' && 'Discover Talent'}
                  {activeTab === 'candidates' && 'Candidates'}
                  {activeTab === 'assessment' && 'Assessment'}
                  {activeTab === 'profile' && 'Company Profile'}
                  {activeTab === 'integrations' && 'Integrations'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {activeTab === 'discover' && 'Search and source top engineering talent.'}
                  {activeTab === 'candidates' && 'View and manage your best matched engineers.'}
                  {activeTab === 'assessment' && 'Review completed assessments and configure technical challenges.'}
                  {activeTab === 'profile' && 'Manage your company details and branding.'}
                  {activeTab === 'integrations' && 'Connect your existing tools and workflows.'}
                </p>
              </div>

              {activeTab === 'candidates' && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table'
                      ? 'bg-gray-100 text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                    title="Table View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'cards'
                      ? 'bg-gray-100 text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-4 h-4 rotate-90" />
                  </button>
                </div>
              )}
            </div>

            {/* Tab Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <CompanyProfileCard company={mockCompany} />

                  {/* Company Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Active Jobs</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{mockJobContexts.length}</div>
                      <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>+2 this month</span>
                      </div>
                    </Card>

                    <Card className="p-4 bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Total Candidates</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">1,248</div>
                      <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>+12% vs last month</span>
                      </div>
                    </Card>

                    <Card className="p-4 bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <Clock className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Avg Time to Hire</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">18 Days</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Top 10% of industry
                      </div>
                    </Card>
                  </div>

                  {/* Active Job Listings */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Active Job Listings</h3>
                      <button className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {mockJobContexts.map((job) => {
                        let Icon = Layers;
                        switch (job.type) {
                          case 'backend': Icon = Server; break;
                          case 'frontend': Icon = Monitor; break;
                          case 'ml': Icon = Cpu; break;
                          case 'fullstack': Icon = Layers; break;
                          default: Icon = CircleDashed;
                        }

                        return (
                          <div key={job.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:border group-hover:border-gray-200 group-hover:shadow-sm transition-all">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">{job.title}</h4>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {mockCompany.location}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Posted 2 days ago
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-medium">
                                    {String.fromCharCode(64 + i)}
                                  </div>
                                ))}
                                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[8px] text-gray-500 font-medium">
                                  +12
                                </div>
                              </div>
                              <span className="text-xs font-medium text-gray-400">15 Candidates</span>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'assessment' && (
                <div className="space-y-6">
                  {/* Assessment Sub-Tabs */}
                  <div className="flex gap-2 border-b border-gray-200">
                    <button
                      onClick={() => setAssessmentSubTab('results')}
                      className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${assessmentSubTab === 'results'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      Results Dashboard
                    </button>
                    <button
                      onClick={() => setAssessmentSubTab('configuration')}
                      className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${assessmentSubTab === 'configuration'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      Configuration
                    </button>
                    <button
                      onClick={() => setAssessmentSubTab('candidate-view')}
                      className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${assessmentSubTab === 'candidate-view'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      Candidate View
                    </button>
                  </div>

                  {/* Assessment Sub-Tab Content */}
                  {assessmentSubTab === 'results' && <AssessmentResultsDashboard />}

                  {assessmentSubTab === 'configuration' && (
                    <AssessmentPreview
                      companyName={mockCompany.name}
                      githubRepoUrl={mockCompany.operating_model.github_repo_url}
                      codebaseProvided={mockCompany.operating_model.codebase_provided}
                    />
                  )}

                  {assessmentSubTab === 'candidate-view' && (
                    <CandidateAssessmentView companyName={mockCompany.name} />
                  )}
                </div>
              )}

              {activeTab === 'discover' && (
                <div className="space-y-6">
                  {/* Search Header Section */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Search className="w-5 h-5 text-gray-500" />
                      <h2 className="text-lg font-semibold text-gray-900">People Search</h2>
                    </div>

                    {/* Main Search Bar */}
                    <div className="flex gap-3 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search for candidates... e.g., 'Senior ML engineer with PyTorch experience'"
                          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-gray-900 placeholder:text-gray-400 font-light shadow-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setHasSearched(true);
                            }
                          }}
                        />
                      </div>
                      <button
                        onClick={() => setHasSearched(true)}
                        className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        Search
                      </button>
                    </div>

                    {/* Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Search Mode */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search Mode</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none min-h-[42px]">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-900">Select Sources</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[240px] bg-white text-gray-900 border border-gray-200 shadow-lg">
                            {[
                              { label: 'Smart (AI picks sources)', icon: Sparkles },
                              { label: 'DevPost', icon: Terminal },
                              { label: 'Twitter', icon: Twitter },
                              { label: 'LinkedIn', icon: Linkedin },
                              { label: 'GitHub', icon: Github }
                            ].map((item) => (
                              <DropdownMenuCheckboxItem
                                key={item.label}
                                checked={searchModes.includes(item.label)}
                                onCheckedChange={(checked) => {
                                  setSearchModes(prev =>
                                    checked
                                      ? [...prev, item.label]
                                      : prev.filter(m => m !== item.label)
                                  );
                                }}
                                onSelect={(e) => e.preventDefault()}
                                className="cursor-pointer focus:bg-gray-100 focus:text-black text-gray-900 flex items-center gap-2 pl-8"
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Selected Icons Display */}
                        {searchModes.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {searchModes.map(mode => {
                              const option = [
                                { label: 'Smart (AI picks sources)', icon: Sparkles },
                                { label: 'DevPost', icon: Terminal },
                                { label: 'Twitter', icon: Twitter },
                                { label: 'LinkedIn', icon: Linkedin },
                                { label: 'GitHub', icon: Github }
                              ].find(opt => opt.label === mode);
                              const Icon = option?.icon || Globe;
                              return (
                                <div key={mode} className="flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm" title={mode}>
                                  <Icon className="w-4 h-4 text-gray-700" />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Job Context */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Context</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none">
                              <span className="truncate">{jobContext}</span>
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[300px] bg-white text-gray-900 border border-gray-200 shadow-lg">
                            {/* Static Optional Item */}
                            <DropdownMenuItem
                              onClick={() => setJobContext('Optional')}
                              className="cursor-pointer hover:bg-black hover:text-white focus:bg-black focus:text-white text-gray-900 flex items-center gap-2"
                            >
                              <CircleDashed className="w-4 h-4" />
                              <span>Optional</span>
                            </DropdownMenuItem>

                            {/* Dynamic Job Contexts from Mock Data */}
                            {mockJobContexts.map((context) => {
                              let Icon = Layers;
                              switch (context.type) {
                                case 'backend': Icon = Server; break;
                                case 'frontend': Icon = Monitor; break;
                                case 'ml': Icon = Cpu; break;
                                case 'fullstack': Icon = Layers; break;
                                default: Icon = CircleDashed;
                              }

                              return (
                                <DropdownMenuItem
                                  key={context.id}
                                  onClick={() => setJobContext(context.title)}
                                  className="cursor-pointer hover:bg-black hover:text-white focus:bg-black focus:text-white text-gray-900 flex items-center gap-2"
                                >
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{context.title}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Results per Search */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Results per Search</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none">
                              <span>{resultsPerSearch}</span>
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[150px] bg-white text-gray-900 border border-gray-200 shadow-lg">
                            {[
                              { label: '10 results', icon: List },
                              { label: '20 results', icon: List },
                              { label: '50 results', icon: List }
                            ].map((item) => (
                              <DropdownMenuItem
                                key={item.label}
                                onClick={() => setResultsPerSearch(item.label)}
                                className="cursor-pointer hover:bg-black hover:text-white focus:bg-black focus:text-white text-gray-900 flex items-center gap-2"
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* View */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">View</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none">
                              <div className="flex items-center gap-2">
                                <LayoutList className="w-4 h-4 text-gray-500" />
                                <span>{viewFilter}</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[150px] bg-white text-gray-900 border border-gray-200 shadow-lg">
                            {[
                              { label: 'Classic', icon: LayoutList },
                              { label: 'CSV', icon: FileSpreadsheet }
                            ].map((item) => (
                              <DropdownMenuItem
                                key={item.label}
                                onClick={() => setViewFilter(item.label)}
                                className="cursor-pointer hover:bg-black hover:text-white focus:bg-black focus:text-white text-gray-900 flex items-center gap-2"
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  {!hasSearched ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for candidates</h3>
                      <p className="text-gray-500 max-w-sm">
                        Enter a query to search across LinkedIn, GitHub, and more
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Results ({mockCandidates.length})
                        </h3>
                      </div>
                      {mockCandidates.map((candidate) => (
                        <CandidateBriefCard key={candidate.id} candidate={candidate} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { name: 'Greenhouse', description: 'Automate your hiring workflow with deep integration.', status: 'Coming Soon' },
                    { name: 'Lever', description: 'Streamline your recruiting pipeline effortlessly.', status: 'Coming Soon' },
                  ].map((integration) => (
                    <Card key={integration.name} className="p-6 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Puzzle className="w-6 h-6 text-gray-500" />
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {integration.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{integration.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
                      <button disabled className="w-full py-2 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed">
                        Connect (Soon)
                      </button>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'candidates' && (
                <div className="space-y-6">
                  {/* Unified Search & Filter Toolbar */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                      {/* Search Bar - Grows */}
                      <div className="relative flex-1 w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search candidates..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border-none rounded-lg focus:ring-0 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent"
                        />
                      </div>

                      {/* Divider (Desktop) */}
                      <div className="hidden md:block w-px h-8 bg-gray-100 mx-2"></div>

                      {/* Filters */}
                      <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        <CandidateFilterBar
                          filters={candidateFilters}
                          onFilterChange={setCandidateFilters}
                          schoolSuggestions={schoolSuggestions}
                          languageSuggestions={languageSuggestions}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Candidates Display */}
                  {filteredCandidates.length === 0 ? (
                    <Card className="py-16 text-center bg-white border-dashed">
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No candidates found
                      </h3>
                      <p className="text-gray-600 max-w-sm mx-auto mb-6">
                        {searchQuery || Object.values(candidateFilters).some((v) => v !== null)
                          ? 'Try adjusting your search or filters to see more results.'
                          : 'We\'re currently scouring our talent pool to find the best matches for your company.'}
                      </p>
                    </Card>
                  ) : viewMode === 'table' ? (
                    <CandidateTable candidates={filteredCandidates} />
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredCandidates.map((candidate) => {
                        // Check if this candidate has the verdict expanded
                        if (expandedVerdictId === candidate.id) {
                          return (
                            <CandidateVerdictCard
                              key={candidate.id}
                              candidate={candidate}
                              onCollapse={() => setExpandedVerdictId(null)}
                              onExpandFull={(id: string) => setExpandedFullEvidenceId(id)}
                              onMoveToInterview={(id: string) => {
                                console.log('Move to interview:', id);
                                // TODO: Implement move to interview logic
                              }}
                            />
                          );
                        }

                        // Default: show compact card
                        return (
                          <CandidateCompactCard
                            key={candidate.id}
                            candidate={candidate}
                            onExpand={(id: string) => setExpandedVerdictId(id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Full Evidence Modal (Second Expansion) */}
                  {expandedFullEvidenceId && (
                    <CandidateFullEvidence
                      candidate={filteredCandidates.find((c) => c.id === expandedFullEvidenceId)!}
                      onClose={() => setExpandedFullEvidenceId(null)}
                      onMoveToInterview={(id: string) => {
                        console.log('Move to interview:', id);
                        setExpandedFullEvidenceId(null);
                        // TODO: Implement move to interview logic
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
