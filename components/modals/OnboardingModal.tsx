"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Briefcase,
  Target,
  Code,
  TrendingUp,
  Loader2,
  Plus,
  Search,
  Github,
  Upload,
  FileText,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Lazy load ResumeUpload only when needed (step 6)
const ResumeUpload = dynamic(() => import("@/app/components/ResumeUpload"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-gray-500">Loading...</div>
    </div>
  ),
});

type ObjectiveType = 'internship' | 'startup' | 'network' | 'improve-application' | 'sf-scene';
type JobType = 'full-time' | 'part-time' | 'internship';
type RoleType = 'PM' | 'SWE' | 'SDE' | 'ML' | 'AI' | 'Data Science' | 'DevOps' | 'Frontend' | 'Backend' | 'Full Stack' | 'Mobile' | 'Security' | 'QA' | 'Design' | 'Product Design' | 'Other';
type YearsOfExperience = 'no-experience' | 'less-than-1' | '1-2' | '2-5' | '5-10' | '10-plus';

interface GitHubRepo {
  id: string;
  github_repo_id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number> | null;
  topics: string[];
  is_private: boolean;
  stargazers_count: number;
  forks_count: number;
  is_selected: boolean;
  category_tags: RoleType[];
}

interface RepoSelection {
  github_repo_id: number;
  is_selected: boolean;
  category_tags: RoleType[];
}

interface RepoMatch {
  repo_name: string;
  github_repo_id: number;
  repo_id: string;
  project_name: string;
  confidence: number;
  match_reasons: string[];
  confidence_level: 'high' | 'good' | 'moderate' | 'low';
}

const OBJECTIVE_OPTIONS: Array<{ value: ObjectiveType; label: string }> = [
  { value: 'internship', label: 'Find my next internship' },
  { value: 'startup', label: 'Work at a Startup' },
  { value: 'network', label: 'Expand your Founder network' },
  { value: 'improve-application', label: 'Improve your holistic job application' },
  { value: 'sf-scene', label: 'Get involved with companies in the SF startup scene' },
];

const YOE_OPTIONS: Array<{ value: YearsOfExperience; label: string }> = [
  { value: 'no-experience', label: 'No experience' },
  { value: 'less-than-1', label: '< 1' },
  { value: '1-2', label: '1-2' },
  { value: '2-5', label: '2-5' },
  { value: '5-10', label: '5-10' },
  { value: '10-plus', label: '10+' },
];

const ROLE_OPTIONS: Array<{ value: RoleType; label: string; description: string }> = [
  { value: 'PM', label: 'Product Manager', description: 'Product strategy and roadmap' },
  { value: 'SWE', label: 'Software Engineer', description: 'General software development' },
  { value: 'SDE', label: 'Software Development Engineer', description: 'Full-stack development' },
  { value: 'ML', label: 'Machine Learning Engineer', description: 'ML models and systems' },
  { value: 'AI', label: 'AI Engineer', description: 'AI/LLM applications' },
  { value: 'Data Science', label: 'Data Scientist', description: 'Data analysis and insights' },
  { value: 'DevOps', label: 'DevOps Engineer', description: 'Infrastructure and deployment' },
  { value: 'Frontend', label: 'Frontend Engineer', description: 'UI/UX development' },
  { value: 'Backend', label: 'Backend Engineer', description: 'Server and API development' },
  { value: 'Full Stack', label: 'Full Stack Engineer', description: 'End-to-end development' },
  { value: 'Mobile', label: 'Mobile Engineer', description: 'iOS/Android development' },
  { value: 'Security', label: 'Security Engineer', description: 'Security and compliance' },
  { value: 'QA', label: 'QA Engineer', description: 'Testing and quality assurance' },
  { value: 'Design', label: 'Designer', description: 'Visual and UI design' },
  { value: 'Product Design', label: 'Product Designer', description: 'UX and product design' },
  { value: 'Other', label: 'Other', description: 'Different role type' },
];

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  skipResumeUpload?: boolean;
}

export function OnboardingModal({ open, onOpenChange, onComplete, skipResumeUpload = false }: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11>(1);

  // Safeguard: Redirect from removed step 5
  useEffect(() => {
    if (step === 5) {
      setStep(skipResumeUpload ? 7 : 6);
    }
  }, [step, skipResumeUpload]);

  const [selectedObjectives, setSelectedObjectives] = useState<ObjectiveType[]>([]);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [selectedRoleTypes, setSelectedRoleTypes] = useState<RoleType[]>([]);
  const [selectedYOE, setSelectedYOE] = useState<YearsOfExperience | null>(null);
  const [hasBetaAccess, setHasBetaAccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [githubConnected, setGithubConnected] = useState(false);

  // GitHub repos state
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [repoSelections, setRepoSelections] = useState<Map<number, RepoSelection>>(new Map());
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [suggestedMatches, setSuggestedMatches] = useState<RepoMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false);
  const { toast } = useToast();

  // Check if user has beta access
  useEffect(() => {
    if (open) {
      const checkBetaAccess = async () => {
        try {
          const response = await fetch('/api/candidate-info', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setHasBetaAccess(data.beta_access === true);
          }
        } catch (error) {
          console.error('Error checking beta access:', error);
        }
      };
      checkBetaAccess();
    }
  }, [open]);

  // Filter repos based on search query and suggested filter
  const filteredRepos = useMemo(() => {
    let repos = githubRepos;

    if (showSuggestedOnly && suggestedMatches.length > 0) {
      const suggestedRepoIds = new Set(suggestedMatches.map(m => m.github_repo_id));
      repos = repos.filter(repo => suggestedRepoIds.has(repo.github_repo_id));
    }

    if (repoSearchQuery.trim()) {
      const query = repoSearchQuery.toLowerCase();
      repos = repos.filter(repo =>
        repo.name.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query) ||
        repo.language?.toLowerCase().includes(query) ||
        repo.topics?.some(topic => topic.toLowerCase().includes(query))
      );
    }

    return repos;
  }, [githubRepos, repoSearchQuery, showSuggestedOnly, suggestedMatches]);

  const REPO_TAG_OPTIONS = useMemo(() =>
    ROLE_OPTIONS.filter(option => option.value !== 'Other'),
    []);

  const getRepoMatch = useCallback((githubRepoId: number): RepoMatch | undefined => {
    return suggestedMatches.find(m => m.github_repo_id === githubRepoId);
  }, [suggestedMatches]);

  const getConfidenceBadge = (confidenceLevel: 'high' | 'good' | 'moderate' | 'low') => {
    switch (confidenceLevel) {
      case 'high':
        return { label: 'High Match', color: 'bg-green-100 text-green-700 border-green-300' };
      case 'good':
        return { label: 'Good Match', color: 'bg-blue-100 text-blue-700 border-blue-300' };
      case 'moderate':
        return { label: 'Possible Match', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
      case 'low':
        return { label: 'Low Match', color: 'bg-gray-100 text-gray-600 border-gray-300' };
    }
  };

  const handleObjectiveSelect = useCallback((objective: ObjectiveType) => {
    setSelectedObjectives(prev => {
      if (prev.includes(objective)) {
        return prev.filter(o => o !== objective);
      } else {
        return [...prev, objective];
      }
    });
  }, []);

  // Check for GitHub connection status from URL params
  useEffect(() => {
    if (typeof window !== 'undefined' && open) {
      const checkParams = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const stepParam = urlParams.get('step');
        const githubConnected = urlParams.get('github_connected');
        const githubError = urlParams.get('github_error');

        if (githubConnected === 'true') {
          setGithubConnected(true);

          let targetStep: 8 | 9;
          if (stepParam === '7') {
            targetStep = 8;
          } else if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 1 && stepNum <= 11 && stepNum !== 10) {
              setStep(stepNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11);
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              return;
            } else {
              targetStep = 8;
            }
          } else {
            targetStep = 8;
          }

          setStep(targetStep);

          setTimeout(() => {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }, 100);
        } else if (githubError) {
          if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 1 && stepNum <= 11 && stepNum !== 10) {
              setStep(stepNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11);
            }
          } else {
            setStep(7);
          }
          setTimeout(() => {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }, 100);
        }
      };

      checkParams();
      const timeoutId = setTimeout(checkParams, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [open]);

  // Fetch GitHub repos when entering step 8
  useEffect(() => {
    if (step === 8 && githubConnected && githubRepos.length === 0 && !isLoadingRepos) {
      const fetchRepos = async () => {
        setIsLoadingRepos(true);
        try {
          const response = await fetch('/api/candidate/github/repositories?skip_save=true', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            const repos = data.repositories || [];
            setGithubRepos(repos);
            const initialSelections = new Map<number, RepoSelection>();
            repos.forEach((repo: GitHubRepo) => {
              initialSelections.set(repo.github_repo_id, {
                github_repo_id: repo.github_repo_id,
                is_selected: false,
                category_tags: [],
              });
            });
            setRepoSelections(initialSelections);
          }
        } catch (error) {
          console.error('Error fetching GitHub repos:', error);
        } finally {
          setIsLoadingRepos(false);
        }
      };
      fetchRepos();
    }
  }, [step, githubConnected, githubRepos.length, isLoadingRepos]);

  // Fetch suggested matches from resume after repos are loaded
  useEffect(() => {
    if (step === 8 && githubRepos.length > 0 && suggestedMatches.length === 0 && !isLoadingMatches) {
      const fetchMatches = async () => {
        setIsLoadingMatches(true);
        try {
          const response = await fetch('/api/candidate/github/match-resume-projects', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.matches) {
              setSuggestedMatches(data.matches);

              const updatedSelections = new Map(repoSelections);
              for (const match of data.matches) {
                if (match.confidence >= 0.7) {
                  const existing = updatedSelections.get(match.github_repo_id);
                  if (existing) {
                    updatedSelections.set(match.github_repo_id, {
                      ...existing,
                      is_selected: true,
                    });
                  }
                }
              }
              setRepoSelections(updatedSelections);
            }
          }
        } catch (error) {
          console.error('Error fetching suggested matches:', error);
        } finally {
          setIsLoadingMatches(false);
        }
      };
      fetchMatches();
    }
  }, [step, githubRepos.length, suggestedMatches.length, isLoadingMatches, repoSelections]);

  const handleGithubConnect = () => {
    const redirectPath = window.location.pathname || '/';
    const connectUrl = `/api/auth/github/connect?redirect=${encodeURIComponent(redirectPath)}&step=7`;
    window.location.href = connectUrl;
  };

  const handleGithubSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(11);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleGithubContinue = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(8);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleRepoToggle = useCallback((githubRepoId: number) => {
    setRepoSelections(prev => {
      const newSelections = new Map(prev);
      const existing = newSelections.get(githubRepoId);
      if (existing) {
        newSelections.set(githubRepoId, {
          ...existing,
          is_selected: !existing.is_selected,
        });
      }
      return newSelections;
    });
  }, []);

  const handleCategoryToggle = useCallback((githubRepoId: number, category: RoleType) => {
    setRepoSelections(prev => {
      const newSelections = new Map(prev);
      const existing = newSelections.get(githubRepoId);
      if (existing) {
        const currentTags = existing.category_tags || [];
        const newTags = currentTags.includes(category)
          ? currentTags.filter(t => t !== category)
          : [...currentTags, category];
        newSelections.set(githubRepoId, {
          ...existing,
          category_tags: newTags,
          is_selected: newTags.length > 0 ? true : existing.is_selected,
        });
      }
      return newSelections;
    });
  }, []);

  const saveSelectedRepos = useCallback(async () => {
    const reposToSave = githubRepos
      .filter(repo => {
        const selection = repoSelections.get(repo.github_repo_id);
        return selection?.is_selected === true;
      })
      .map(repo => {
        const selection = repoSelections.get(repo.github_repo_id);
        return {
          github_repo_id: repo.github_repo_id,
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          description: repo.description,
          language: repo.language,
          languages: repo.languages,
          topics: repo.topics || [],
          is_private: repo.is_private,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          is_selected: selection?.is_selected || false,
          category_tags: selection?.category_tags || [],
        };
      });

    if (reposToSave.length > 0) {
      try {
        const response = await fetch('/api/candidate/github/repositories/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ repositories: reposToSave, full_save: true }),
        });

        if (!response.ok) {
          console.error('Failed to save repositories:', await response.text());
        }
      } catch (error) {
        console.error('Error saving repositories:', error);
      }
    }
  }, [githubRepos, repoSelections]);

  const handleReposContinue = useCallback(async () => {
    setIsTransitioning(true);
    try {
      await saveSelectedRepos();

      setTimeout(() => {
        setStep(11);
        setIsTransitioning(false);
      }, 200);
    } catch (error) {
      console.error('Error saving repos:', error);
      setIsTransitioning(false);
      toast({
        title: 'Error',
        description: 'Failed to save repositories. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast, saveSelectedRepos]);

  const handleReposSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(11);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleObjectiveContinue = useCallback(() => {
    if (selectedObjectives.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 200);
  }, [selectedObjectives.length]);

  const handleJobTypeSelect = useCallback((jobType: JobType) => {
    setSelectedJobType(jobType);
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(3);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleRoleTypeSelect = useCallback((roleType: RoleType) => {
    setSelectedRoleTypes(prev => {
      if (prev.includes(roleType)) {
        return prev.filter(r => r !== roleType);
      } else {
        return [...prev, roleType];
      }
    });
  }, []);

  const handleRolesContinue = useCallback(() => {
    if (selectedRoleTypes.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(4);
      setIsTransitioning(false);
    }, 200);
  }, [selectedRoleTypes.length]);

  const handleYOESelect = useCallback((yoe: YearsOfExperience) => {
    setSelectedYOE(yoe);
  }, []);

  const handleYOEContinue = async () => {
    if (!selectedJobType || selectedRoleTypes.length === 0 || selectedObjectives.length === 0 || !selectedYOE) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/candidate/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          objectives: selectedObjectives,
          jobType: selectedJobType,
          roleTypes: selectedRoleTypes,
          yearsOfExperience: selectedYOE,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save preferences';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        setIsTransitioning(true);
        setTimeout(() => {
          if (skipResumeUpload) {
            setStep(7);
          } else {
            setStep(6);
          }
          setIsSubmitting(false);
          setIsTransitioning(false);
        }, 200);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save your preferences. Please try again.';
      alert(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleResumeSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(7);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleViewMatches = async () => {
    try {
      await saveSelectedRepos();

      const response = await fetch('/api/candidate/mark-onboarding-complete', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to mark onboarding complete:', await response.text());
        return;
      }

      await response.json();
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.href = "/matches";
  };

  const containerVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side: Onboarding Content */}
      <div className="w-full lg:w-1/2 flex flex-col p-3 sm:p-6 lg:p-8 relative z-10 overflow-y-auto bg-white">
        {/* Header / Nav */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => {
              if (step > 1) {
                setIsTransitioning(true);
                setTimeout(() => {
                  if (step === 2) setStep(1);
                  else if (step === 3) setStep(2);
                  else if (step === 4) setStep(3);
                  else if (step === 6) setStep(4);
                  else if (step === 7) setStep(skipResumeUpload ? 4 : 6);
                  else if (step === 8) setStep(7);
                  setIsTransitioning(false);
                }, 200);
              } else {
                onOpenChange(false);
              }
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors self-start group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium tracking-tight">
              {step > 1 ? 'Back' : 'Close'}
            </span>
          </motion.button>

          <div className="flex gap-2">
            {(() => {
              const steps = skipResumeUpload
                ? [1, 2, 3, 4, 7, 8, 11]
                : [1, 2, 3, 4, 6, 7, 8, 11];
              return steps.map((s) => (
                <div
                  key={s}
                  className={`h-1 w-4 sm:w-8 rounded-full transition-all duration-500 ${step >= s ? 'bg-blue-500' : 'bg-gray-100'}`}
                />
              ));
            })()}
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto lg:mx-0 flex-grow flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={containerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {/* Step 1: Objectives */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      Welcome to <span className="text-blue-500">Hermes!</span>
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      Which of the following choices best describe your objective with Hermes?
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Select all that apply</p>
                  </div>

                  <div className="space-y-2">
                    {OBJECTIVE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleObjectiveSelect(option.value)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 transition-all text-left ${selectedObjectives.includes(option.value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <div className="font-medium text-xs sm:text-sm text-black">{option.label}</div>
                      </button>
                    ))}
                  </div>

                  <motion.button
                    onClick={handleObjectiveContinue}
                    disabled={selectedObjectives.length === 0}
                    className="group relative w-full py-2.5 sm:py-3 bg-black text-white text-sm sm:text-base font-bold rounded-xl hover:bg-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-xl mt-4"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Continue
                      <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Step 2: Job Type */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      What type of <span className="text-blue-500">position</span> are you looking for?
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      Select one option
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { value: 'full-time' as JobType, label: 'Full-Time', desc: 'Permanent, full-time positions' },
                      { value: 'part-time' as JobType, label: 'Part-Time', desc: 'Part-time or contract positions' },
                      { value: 'internship' as JobType, label: 'Internship', desc: 'Summer, winter, or year-round internships' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleJobTypeSelect(option.value)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 transition-all text-left ${selectedJobType === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <div className="font-semibold text-sm sm:text-base text-black">{option.label}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Role Type */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      What <span className="text-blue-500">roles</span> interest you?
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      Select all that apply
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto px-1">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => handleRoleTypeSelect(role.value)}
                        className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${selectedRoleTypes.includes(role.value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <div className="font-semibold text-xs sm:text-sm text-black">{role.label}</div>
                        <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">{role.description}</div>
                      </button>
                    ))}
                  </div>

                  <motion.button
                    onClick={handleRolesContinue}
                    disabled={selectedRoleTypes.length === 0}
                    className="group relative w-full py-2.5 sm:py-3 bg-black text-white text-sm sm:text-base font-bold rounded-xl hover:bg-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-xl mt-4"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Continue
                      <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Step 4: Years of Experience */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      How many <span className="text-blue-500">years of experience</span> do you have?
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      Select one option
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {YOE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleYOESelect(option.value)}
                        className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-center ${selectedYOE === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <div className="font-semibold text-sm sm:text-base text-black">{option.label}</div>
                      </button>
                    ))}
                  </div>

                  <motion.button
                    onClick={handleYOEContinue}
                    disabled={!selectedYOE || isSubmitting}
                    className="group relative w-full py-2.5 sm:py-3 bg-black text-white text-sm sm:text-base font-bold rounded-xl hover:bg-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-xl mt-4"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Step 6: Resume Upload */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      Upload your <span className="text-blue-500">resume</span>
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      To generate the best matches for you, we need to analyze your resume.
                    </p>
                  </div>

                  <div className="mt-8">
                    <ResumeUpload
                      onSuccess={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(7);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 7: GitHub Connection */}
              {step === 7 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                      Connect your <span className="text-blue-500">GitHub</span>
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                      {githubConnected
                        ? 'Your GitHub account has been connected successfully!'
                        : 'Connect your GitHub to help us find better matches based on your projects and contributions.'}
                    </p>
                  </div>

                  {githubConnected ? (
                    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                      <div className="text-green-600 text-4xl mb-4">✓</div>
                      <p className="text-green-800 font-semibold text-lg mb-2">
                        GitHub Connected Successfully
                      </p>
                      <p className="text-green-700 text-sm">
                        We'll use your repository data to improve your matches.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 text-center">
                      <div className="mb-6">
                        <Github className="w-16 h-16 mx-auto text-gray-700" />
                      </div>
                      <p className="text-gray-700 mb-6">
                        Connect your GitHub account to help us understand your coding experience and find better startup matches.
                      </p>
                      <button
                        onClick={handleGithubConnect}
                        className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl transition-all shadow-xl"
                      >
                        Connect GitHub
                      </button>
                    </div>
                  )}

                  {githubConnected && (
                    <motion.button
                      onClick={handleGithubContinue}
                      className="group relative w-full py-3 bg-black text-white font-bold rounded-2xl hover:bg-gray-900 transition-all duration-300 overflow-hidden shadow-xl mt-6"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Continue
                        <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </motion.button>
                  )}
                </div>
              )}

              {/* Step 11: Completion */}
              {step === 11 && (
                <div className="space-y-4 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight leading-tight">
                    You're <span className="text-blue-500">all set!</span>
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 leading-snug font-light">
                    {skipResumeUpload
                      ? "Your profile has been set up successfully."
                      : "Your resume has been uploaded successfully."}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-6">
                    <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-5 hover:border-blue-500 hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="mb-3 sm:mb-4">
                        <h3 className="text-lg sm:text-xl font-bold text-black mb-1 sm:mb-2">View your matches</h3>
                        <p className="text-gray-600 text-xs sm:text-sm">
                          See the startups we've matched you with based on your profile.
                        </p>
                      </div>
                      <button
                        onClick={handleViewMatches}
                        className="w-full py-2.5 sm:py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-xl text-sm sm:text-base"
                      >
                        View Matches
                      </button>
                    </div>

                    <div className="border-2 border-gray-200 rounded-xl p-4 sm:p-5 hover:border-blue-500 hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="mb-3 sm:mb-4">
                        <h3 className="text-lg sm:text-xl font-bold text-black mb-1 sm:mb-2">Enhance Resume</h3>
                        <p className="text-gray-600 text-xs sm:text-sm">
                          Get AI-powered suggestions to improve your resume for better matches.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await saveSelectedRepos();
                            await fetch('/api/candidate/mark-onboarding-complete', {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch (error) {
                            console.error('Error marking onboarding complete:', error);
                          }
                          window.location.href = "/resumes";
                        }}
                        className="w-full py-2.5 sm:py-3 border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white font-bold rounded-2xl transition-all shadow-xl text-sm sm:text-base"
                      >
                        Enhance Resume
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center opacity-60">
          <p className="text-[10px] sm:text-xs text-gray-400">© 2026 Hermes Talent Acquisition</p>
        </footer>
      </div>

      {/* Right Side: Visual Image - Sticky/Fixed */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden bg-black border-l border-white/10">
        <Image
          src="/images/hermes2bg.png"
          alt="Hermes Sky"
          fill
          className="object-cover scale-110 blur-[1px] opacity-90"
          priority
        />

        {/* Visual Overlays */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-transparent to-black/20" />

        <div className="absolute inset-0 flex flex-col justify-center p-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-md"
          >
            <h2 className="text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
              Land jobs at <span className="text-blue-500">top startups</span>
            </h2>
            <p className="text-xl text-white/60 font-light leading-relaxed">
              We help talented engineers find exceptional startup opportunities by analyzing skills, not just resumes.
            </p>
          </motion.div>
        </div>

        {/* Bottom Right Logo */}
        <div className="absolute bottom-12 right-12 flex items-center gap-3">
          <Image src="/images/hermes.png" alt="Logo" width={32} height={32} className="opacity-80" />
          <span className="text-xl font-bold text-white opacity-80 tracking-tight">Hermes</span>
        </div>
      </div>
    </div>
  );
}
