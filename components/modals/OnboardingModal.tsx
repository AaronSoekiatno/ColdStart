"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, Copy, Check, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/use-toast";

// Lazy load ResumeUpload only when needed (step 6)
const ResumeUpload = dynamic(() => import("@/app/components/ResumeUpload"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-gray-500">Loading...</div>
    </div>
  ),
});
// import { ResumeUploadModal } from \"@/components/modals/ResumeUploadModal\";

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
  skipResumeUpload?: boolean; // If true, skip step 6 (resume upload)
}

export function OnboardingModal({ open, onOpenChange, onComplete, skipResumeUpload = false }: OnboardingModalProps) {
  // Unified onboarding flow: Steps 1-4 (basic info), Step 6 (resume, optional), Step 7 (GitHub), Step 8 (repo selection), Step 10 (assessment), Step 11 (completion)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11>(1);

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
  // Assessment state
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [assessmentRepoUrl, setAssessmentRepoUrl] = useState<string | null>(null);
  const [assessmentCloneUrl, setAssessmentCloneUrl] = useState<string | null>(null);
  const [assessmentCredentials, setAssessmentCredentials] = useState<any>(null);
  const [provisioningToken, setProvisioningToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
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

  // Filter repos based on search query
  const filteredRepos = useMemo(() => {
    if (!repoSearchQuery.trim()) return githubRepos;
    const query = repoSearchQuery.toLowerCase();
    return githubRepos.filter(repo =>
      repo.name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query) ||
      repo.language?.toLowerCase().includes(query) ||
      repo.topics?.some(topic => topic.toLowerCase().includes(query))
    );
  }, [githubRepos, repoSearchQuery]);

  // Role options for repo tagging (excluding "Other")
  const REPO_TAG_OPTIONS = useMemo(() =>
    ROLE_OPTIONS.filter(option => option.value !== 'Other'),
    []);

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
      // Use a small delay to ensure URL params are available after page load
      const checkParams = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const stepParam = urlParams.get('step');
        const githubConnected = urlParams.get('github_connected');
        const githubError = urlParams.get('github_error');

        if (githubConnected === 'true') {
          setGithubConnected(true);

          // Determine target step - always go to step 8 (repo selection) after GitHub connection
          let targetStep: 8 | 9;
          if (stepParam === '7') {
            targetStep = 8; // Always go to repo selection after GitHub connection
          } else if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 1 && stepNum <= 11) {
              setStep(stepNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11);
              // Clean up URL params after processing
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              return; // Early return since we set a specific step
            } else {
              targetStep = 8; // Default to repo selection
            }
          } else {
            // No step param but GitHub connected - default to repo selection
            targetStep = 8;
          }

          // Set the target step
          setStep(targetStep);

          // Clean up URL params after processing
          setTimeout(() => {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }, 100);
        } else if (githubError) {
          // User cancelled or error occurred - navigate to step 7 (GitHub connection step)
          if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 1 && stepNum <= 10) {
              setStep(stepNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10);
            }
          } else {
            // Default to step 7 if no step specified
            setStep(7);
          }
          // Clean up URL params
          setTimeout(() => {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }, 100);
        }
      };

      // Check immediately
      checkParams();

      // Also check after a small delay to catch any timing issues
      const timeoutId = setTimeout(checkParams, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [open]);



  // Fetch GitHub repos when entering step 8 (without saving to database)
  useEffect(() => {
    if (step === 8 && githubConnected && githubRepos.length === 0 && !isLoadingRepos) {
      const fetchRepos = async () => {
        setIsLoadingRepos(true);
        try {
          // Use skip_save=true to fetch from GitHub without saving to database
          const response = await fetch('/api/candidate/github/repositories?skip_save=true', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            const repos = data.repositories || [];
            setGithubRepos(repos);
            // Initialize selections (all repos start as not selected during onboarding)
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

  const handleGithubConnect = () => {
    // Redirect to GitHub OAuth connection
    // Use pathname to preserve the current page (e.g., /onboarding)
    const redirectPath = window.location.pathname || '/';
    const connectUrl = `/api/auth/github/connect?redirect=${encodeURIComponent(redirectPath)}&step=7`;
    window.location.href = connectUrl;
  };

  const handleGithubSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(10); // Skip to Assessment
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleGithubContinue = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(8); // Go to repo selection step
      setIsTransitioning(false);
    }, 200);
  }, []);

  // Handle repo selection toggle
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

  // Handle category tag toggle for a repo
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
          // Auto-select the repo if adding a category
          is_selected: newTags.length > 0 ? true : existing.is_selected,
        });
      }
      return newSelections;
    });
  }, []);

  // Trigger GitHub analysis in the background (fire-and-forget)
  const triggerGitHubAnalysis = useCallback(async () => {
    try {
      // Get selected repository IDs (database UUIDs, not github_repo_ids)
      const selectedRepos = githubRepos
        .filter(repo => {
          const selection = repoSelections.get(repo.github_repo_id);
          return selection?.is_selected || (selection?.category_tags && selection.category_tags.length > 0);
        })
        .map(repo => repo.id) // Use database UUID
        .filter(id => id); // Filter out any undefined IDs

      if (selectedRepos.length === 0) {
        console.log('[OnboardingModal] No repos selected, skipping GitHub analysis');
        return;
      }

      // Get candidate info to extract candidate_id
      const candidateResponse = await fetch('/api/candidate-info', {
        credentials: 'include',
      });

      if (!candidateResponse.ok) {
        console.warn('[OnboardingModal] Failed to get candidate info for GitHub analysis');
        return;
      }

      const candidateInfo = await candidateResponse.json();
      const candidateId = candidateInfo.id;

      if (!candidateId) {
        console.warn('[OnboardingModal] No candidate_id found, skipping GitHub analysis');
        return;
      }

      // Trigger batch analysis (fire-and-forget - don't await)
      fetch('/api/github/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidate_id: candidateId,
          repository_ids: selectedRepos,
        }),
      }).catch(error => {
        // Silently log error - don't block user
        console.error('[OnboardingModal] Failed to trigger GitHub analysis:', error);
      });

      console.log('[OnboardingModal] GitHub analysis triggered for', selectedRepos.length, 'repositories');
    } catch (error) {
      // Silently log error - don't block user
      console.error('[OnboardingModal] Error triggering GitHub analysis:', error);
    }
  }, [githubRepos, repoSelections]);

  // Save selected repos to database (called when onboarding completes)
  const saveSelectedRepos = useCallback(async () => {
    // Get only repos that have been selected or have category tags
    const reposToSave = githubRepos
      .filter(repo => {
        const selection = repoSelections.get(repo.github_repo_id);
        return selection?.is_selected || (selection?.category_tags && selection.category_tags.length > 0);
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


  // Complete onboarding after repo selection and redirect to assessment page
  const handleReposContinue = useCallback(async () => {
    setIsTransitioning(true);
    try {
      // Save selected repos first
      await saveSelectedRepos();

      // Trigger GitHub analysis in background (fire-and-forget)
      triggerGitHubAnalysis();

      // Mark onboarding as complete
      await fetch('/api/candidate/mark-onboarding-complete', {
        method: 'POST',
        credentials: 'include',
      });

      // Redirect to assessment page
      window.location.href = '/assessment';
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsTransitioning(false);
      toast({
        title: 'Error',
        description: 'Failed to complete onboarding. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast, triggerGitHubAnalysis, saveSelectedRepos]);



  const handleReposSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(10); // Go to Assessment step
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleObjectiveContinue = useCallback(() => {
    if (selectedObjectives.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 200); // Reduced from 300ms to 200ms
  }, [selectedObjectives.length]);



  const handleJobTypeSelect = useCallback((jobType: JobType) => {
    setSelectedJobType(jobType);
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(3);
      setIsTransitioning(false);
    }, 200); // Reduced from 300ms to 200ms
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
    }, 200); // Reduced from 300ms to 200ms
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
        // Go to final step instead of completing
        // Go to next step
        setIsTransitioning(true);
        setTimeout(() => {
          if (skipResumeUpload) {
            setStep(7); // Skip failure-prone resume upload if requested
          } else {
            setStep(6); // Resume upload step
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

  const handleAssessmentSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(11);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleResumeSkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(7);
      setIsTransitioning(false);
    }, 200);
  }, []);

  // Handle assessment start (Step 10 for top candidates)
  const handleStartAssessment = useCallback(async () => {
    setIsCreatingRepo(true);
    try {
      const response = await fetch('/api/topcandidates/create-assessment-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create assessment repository');
      }

      const data = await response.json();
      setAssessmentRepoUrl(data.repoUrl);
      setAssessmentCloneUrl(data.cloneUrl);
      if (data.credentials) {
        setAssessmentCredentials(data.credentials);
      }
      if (data.provisioningToken) {
        setProvisioningToken(data.provisioningToken);
      }

      toast({
        title: "Assessment repository created!",
        description: "Your private workspace is ready.",
      });

      // Do not auto-advance to step 11 - let user see the clone instructions (step 10 success state)
    } catch (error) {
      console.error('Error creating assessment repo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create repository';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingRepo(false);
    }
  }, [toast]);

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  }, [toast]);

  const handleViewMatches = async () => {
    try {
      // Save selected GitHub repos to database (if any were selected)
      await saveSelectedRepos();

      // Mark onboarding as truly complete and wait for response
      const response = await fetch('/api/candidate/mark-onboarding-complete', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to mark onboarding complete:', await response.text());
      }
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }

    // Small delay to ensure database propagates
    await new Promise(resolve => setTimeout(resolve, 200));

    // Directly redirect to matches page
    window.location.href = "/matches";
  };

  // const handleUploadResume = () => {
  //   setShowResumeUpload(true);
  // };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white text-gray-900 w-screen h-screen max-w-none max-h-none overflow-y-auto p-0 flex items-center justify-center">
          <div className={`w-full px-6 sm:px-8 py-8 ${step === 8 ? 'max-w-6xl' : 'max-w-3xl'}`}>
            <DialogHeader>
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {(() => {
                    const steps = skipResumeUpload
                      ? [1, 2, 3, 4, 7, 8, 10, 11]
                      : [1, 2, 3, 4, 6, 7, 8, 10, 11];
                    return steps.map((stepNum) => (
                      <div
                        key={stepNum}
                        className={`h-2 w-8 rounded-full transition-colors duration-300 ${step >= stepNum ? 'bg-[#498EDC]' : 'bg-gray-200'
                          }`}
                      />
                    ));
                  })()}
                </div>
                <p className="text-center text-gray-500 text-sm">
                  Step {(() => {
                    // Calculate step display: remove step 5 (removed), adjust for skipped resume
                    let currentStepDisplay = step > 5 ? step - 1 : step;

                    // Handle skip resume (remove step 6)
                    if (skipResumeUpload && step >= 7) {
                      currentStepDisplay -= 1;
                    }

                    // Step 9 is removed, so step 10 becomes step 9 in display
                    if (step >= 10) {
                      currentStepDisplay -= 1;
                    }

                    return currentStepDisplay;
                  })()} of {skipResumeUpload ? 8 : 9}
                </p>
              </div>
            </DialogHeader>

            <div className="relative min-h-[450px]">
              {/* Conditionally render only the current step to improve performance */}



              {/* Step 1: Objectives (Moved from Step 2) */}
              {step === 1 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center">
                    <DialogTitle className="text-3xl font-bold mb-2 text-gray-900">
                      Welcome to Hermes!
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                      Which of the following choices best describe your objective with Hermes?
                    </DialogDescription>
                    <p className="text-sm text-gray-500 mt-1">Select all that apply</p>
                  </div>

                  <div className="space-y-3 mt-8">
                    {OBJECTIVE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleObjectiveSelect(option.value)}
                        className={`w-full p-5 rounded-xl border-2 transition-all text-left shadow-sm ${selectedObjectives.includes(option.value)
                          ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                          }`}
                      >
                        <div className="font-semibold text-gray-900">{option.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={handleObjectiveContinue}
                      disabled={selectedObjectives.length === 0}
                      className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Job Type (Moved from Step 3) */}
              {step === 2 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center">
                    <DialogTitle className="text-3xl font-bold mb-2 text-gray-900">
                      What type of position are you looking for?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                      Select one option
                    </DialogDescription>
                  </div>

                  <div className="space-y-4 mt-8">
                    <button
                      onClick={() => handleJobTypeSelect('full-time')}
                      className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${selectedJobType === 'full-time'
                        ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                        }`}
                    >
                      <div className="font-semibold text-lg text-gray-900">Full-Time</div>
                      <div className="text-sm text-gray-600 mt-1">Permanent, full-time positions</div>
                    </button>

                    <button
                      onClick={() => handleJobTypeSelect('part-time')}
                      className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${selectedJobType === 'part-time'
                        ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                        }`}
                    >
                      <div className="font-semibold text-lg text-gray-900">Part-Time</div>
                      <div className="text-sm text-gray-600 mt-1">Part-time or contract positions</div>
                    </button>

                    <button
                      onClick={() => handleJobTypeSelect('internship')}
                      className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${selectedJobType === 'internship'
                        ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                        }`}
                    >
                      <div className="font-semibold text-lg text-gray-900">Internship</div>
                      <div className="text-sm text-gray-600 mt-1">Summer, winter, or year-round internships</div>
                    </button>
                  </div>

                  <div className="mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(1);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Role Type (Moved from Step 4) */}
              {step === 3 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center">
                    <DialogTitle className="text-3xl font-bold mb-2 text-gray-900">
                      What roles interest you?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                      Select all that apply
                    </DialogDescription>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 max-h-[45vh] overflow-y-auto px-2 py-2">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => handleRoleTypeSelect(role.value)}
                        className={`p-4 rounded-xl border-2 transition-all text-left shadow-sm ${selectedRoleTypes.includes(role.value)
                          ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                          }`}
                      >
                        <div className="font-semibold text-gray-900">{role.label}</div>
                        <div className="text-xs text-gray-600 mt-1">{role.description}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(2);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleRolesContinue}
                      disabled={selectedRoleTypes.length === 0}
                      className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Years of Experience (Moved from Step 5) */}
              {step === 4 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center">
                    <DialogTitle className="text-3xl font-bold mb-2 text-gray-900">
                      How many Years Of Experience do you have?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                      Select one option
                    </DialogDescription>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                    {YOE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleYOESelect(option.value)}
                        className={`p-6 rounded-xl border-2 transition-all text-center shadow-sm ${selectedYOE === option.value
                          ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                          }`}
                      >
                        <div className="font-semibold text-lg text-gray-900">{option.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(3);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleYOEContinue}
                      disabled={!selectedYOE || isSubmitting}
                      className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      {isSubmitting ? 'Saving...' : 'Continue'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 6: Mandatory Resume Upload */}
              {step === 6 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center mb-8">
                    <DialogTitle className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                      Upload your resume
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2 text-lg">
                      To generate the best matches for you, we need to analyze your resume.
                    </DialogDescription>
                  </div>

                  <div className="max-w-md mx-auto mt-8">
                    {/* Embedded Resume Upload Component */}
                    <ResumeUpload
                      onSuccess={() => {
                        // Advance to Step 7 (GitHub Connection)
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(7);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                    // Note: onUpgradeRequired handled by ResumeUpload locally or we can add handler if needed
                    // For onboarding, we typically expect users to be allowed to upload.
                    />
                  </div>

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(4); // Back to YOE
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 7: GitHub Connection (Optional) */}
              {step === 7 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center mb-8">
                    <DialogTitle className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                      Connect your GitHub
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2 text-lg">
                      {githubConnected
                        ? 'Your GitHub account has been connected successfully!'
                        : 'Connect your GitHub to help us find better matches based on your projects and contributions.'}
                    </DialogDescription>
                  </div>

                  {githubConnected ? (
                    <div className="max-w-md mx-auto mt-8">
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                        <div className="text-green-600 text-4xl mb-4">✓</div>
                        <p className="text-green-800 font-semibold text-lg mb-2">
                          GitHub Connected Successfully
                        </p>
                        <p className="text-green-700 text-sm">
                          We'll use your repository data to improve your matches.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto mt-8">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-8 text-center">
                        <div className="mb-6">
                          <svg
                            className="w-16 h-16 mx-auto text-gray-700"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.737 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-700 mb-6">
                          Connect your GitHub account to help us understand your coding experience and find better startup matches.
                        </p>
                        <Button
                          onClick={handleGithubConnect}
                          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-md hover:shadow-lg transition-all py-6 text-lg"
                        >
                          Connect GitHub
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          if (skipResumeUpload) {
                            setStep(4); // Go back to YOE (skipped statistic)
                          } else {
                            setStep(6); // Go back to resume upload
                          }
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>

                    {githubConnected && (
                      <Button
                        onClick={handleGithubContinue}
                        className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                      >
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 8: GitHub Repository Selection with Category Tags */}
              {step === 8 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center">
                    <DialogTitle className="text-3xl font-bold mb-2 text-gray-900">
                      Showcase your projects
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                      Select repositories to display on your profile and tag them by category.
                    </DialogDescription>
                  </div>

                  {isLoadingRepos ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-gray-500">Loading your repositories...</div>
                    </div>
                  ) : githubRepos.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">No repositories found. You can add them later from your profile.</p>
                    </div>
                  ) : hasBetaAccess ? (
                    <>
                      {/* Enhanced UI for beta users: Search bar */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search repositories..."
                          value={repoSearchQuery}
                          onChange={(e) => setRepoSearchQuery(e.target.value)}
                          className="pl-10 bg-white border-gray-200"
                        />
                      </div>

                      <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
                        {filteredRepos.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">No repositories match your search.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredRepos.map((repo) => {
                              const selection = repoSelections.get(repo.github_repo_id);
                              const isSelected = selection?.is_selected || false;
                              const selectedCategories = selection?.category_tags || [];

                              return (
                                <div
                                  key={repo.github_repo_id}
                                  onClick={() => handleRepoToggle(repo.github_repo_id)}
                                  className={`border-2 rounded-xl p-4 transition-all cursor-pointer flex flex-col ${isSelected
                                    ? 'border-[#498EDC] bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      id={`repo-${repo.github_repo_id}`}
                                      checked={isSelected}
                                      onCheckedChange={() => handleRepoToggle(repo.github_repo_id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-gray-900 block truncate">
                                        {repo.name}
                                        {repo.is_private && (
                                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                            Private
                                          </span>
                                        )}
                                      </div>
                                      {repo.description && (
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                          {repo.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                        {repo.language && (
                                          <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            {repo.language}
                                          </span>
                                        )}
                                        {repo.stargazers_count > 0 && (
                                          <span>{repo.stargazers_count} stars</span>
                                        )}
                                      </div>

                                      {/* Category Tags */}
                                      {isSelected && (
                                        <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                                          <p className="text-xs text-gray-500 mb-2">Tag with categories:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {REPO_TAG_OPTIONS.map((roleOption) => (
                                              <button
                                                key={roleOption.value}
                                                onClick={() => handleCategoryToggle(repo.github_repo_id, roleOption.value)}
                                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-all ${selectedCategories.includes(roleOption.value)
                                                  ? 'bg-[#498EDC] text-white'
                                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                  }`}
                                              >
                                                {!selectedCategories.includes(roleOption.value) && (
                                                  <Plus className="h-3 w-3" />
                                                )}
                                                {roleOption.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    // Simple UI for non-beta users - 2-column layout
                    <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {githubRepos.map((repo) => {
                          const selection = repoSelections.get(repo.github_repo_id);
                          const isSelected = selection?.is_selected || false;
                          const selectedCategories = selection?.category_tags || [];

                          return (
                            <div
                              key={repo.github_repo_id}
                              onClick={() => handleRepoToggle(repo.github_repo_id)}
                              className={`border-2 rounded-xl p-4 transition-all cursor-pointer flex flex-col ${isSelected
                                ? 'border-[#498EDC] bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  id={`repo-${repo.github_repo_id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => handleRepoToggle(repo.github_repo_id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900 block truncate">
                                    {repo.name}
                                    {repo.is_private && (
                                      <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                        Private
                                      </span>
                                    )}
                                  </div>
                                  {repo.description && (
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {repo.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                    {repo.language && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        {repo.language}
                                      </span>
                                    )}
                                    {repo.stargazers_count > 0 && (
                                      <span>{repo.stargazers_count} stars</span>
                                    )}
                                  </div>

                                  {/* Category Tags - Use REPO_TAG_OPTIONS (excludes "Other") */}
                                  {isSelected && (
                                    <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                                      <p className="text-xs text-gray-500 mb-2">Tag with categories:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {REPO_TAG_OPTIONS.map((roleOption) => (
                                          <button
                                            key={roleOption.value}
                                            onClick={() => handleCategoryToggle(repo.github_repo_id, roleOption.value)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-all ${selectedCategories.includes(roleOption.value)
                                              ? 'bg-[#498EDC] text-white'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                              }`}
                                          >
                                            {!selectedCategories.includes(roleOption.value) && (
                                              <Plus className="h-3 w-3" />
                                            )}
                                            {roleOption.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <Button
                      onClick={() => {
                        setIsTransitioning(true);
                        setTimeout(() => {
                          setStep(7);
                          setIsTransitioning(false);
                        }, 200);
                      }}
                      variant="outline"
                      className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={handleReposContinue}
                      className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}



              {/* Step 10: Assessment Prompt */}
              {step === 10 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center mb-8">
                    <DialogTitle className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                      {assessmentRepoUrl ? "Your Assessment Workspace is Ready!" : "Start Your 20-Minute Assessment"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2 text-lg">
                      {assessmentRepoUrl
                        ? "Clone your repository and follow the instructions to begin."
                        : "Complete a quick assessment to demonstrate your skills. We'll set up a private workspace for you."}
                    </DialogDescription>
                  </div>

                  {!assessmentRepoUrl ? (
                    <div className="space-y-6 mt-6">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                        <h3 className="font-semibold text-lg text-gray-900 mb-3">What you'll do:</h3>
                        <ul className="space-y-2 text-gray-700 list-disc list-inside">
                          <li>Work in a private GitHub repository</li>
                          <li>Complete database tasks in your isolated workspace</li>
                          <li>Demonstrate your problem-solving skills</li>
                          <li>Showcase your technical abilities</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                        <h3 className="font-semibold text-lg text-gray-900 mb-3">Time required:</h3>
                        <p className="text-gray-700">Approximately 20 minutes</p>
                      </div>

                      <div className="flex gap-4 mt-6">
                        <Button
                          onClick={() => {
                            setIsTransitioning(true);
                            setTimeout(() => {
                              setStep(8);
                              setIsTransitioning(false);
                            }, 200);
                          }}
                          variant="outline"
                          className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleAssessmentSkip}
                          variant="ghost"
                          className="flex-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        >
                          Skip for now
                        </Button>
                        <Button
                          onClick={handleStartAssessment}
                          disabled={isCreatingRepo}
                          className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                        >
                          {isCreatingRepo ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Start Assessment"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 mt-6">
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-green-600 text-2xl">✓</div>
                          <h3 className="font-semibold text-lg text-gray-900">
                            Repository Created Successfully
                          </h3>
                        </div>
                        <p className="text-gray-700 mb-4">
                          Your private assessment workspace has been created. Follow these steps to get started:
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Step 1: Clone the repository</h4>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm flex items-center justify-between gap-4">
                            <code className="flex-1 break-all">
                              git clone {assessmentCloneUrl || assessmentRepoUrl + '.git'}
                            </code>
                            <button
                              onClick={() => handleCopy(`git clone ${assessmentCloneUrl || assessmentRepoUrl + '.git'}`, 'clone')}
                              className="flex-shrink-0 p-2 hover:bg-gray-800 rounded transition-colors"
                              title="Copy clone command"
                            >
                              {copiedField === 'clone' ? (
                                <Check className="h-4 w-4 text-green-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Step 2: Navigate to the repository</h4>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                            <code>cd {assessmentRepoUrl?.split('/').pop() || 'hermes-assessment-*'}</code>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Step 3: Install and start assessment</h4>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm flex items-center justify-between gap-4">
                            <code className="text-xs md:text-sm break-all">yarn && yarn mission:start</code>
                            <button
                              onClick={() => handleCopy(`yarn && yarn mission:start`, 'start')}
                              className="flex-shrink-0 p-2 hover:bg-gray-800 rounded transition-colors"
                              title="Copy command"
                            >
                              {copiedField === 'start' ? (
                                <Check className="h-4 w-4 text-green-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            This installs the required packages and starts the assessment environment.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {assessmentRepoUrl && (
                    <div className="flex flex-col gap-4 mt-6">
                      <Button
                        onClick={async () => {
                          // Save repos and mark onboarding complete before starting interview
                          try {
                            await saveSelectedRepos();
                            await fetch('/api/candidate/mark-onboarding-complete', {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch (error) {
                            console.error('Error completing onboarding:', error);
                          }
                          // Navigate to interview to start Minerva session
                          window.location.href = '/interview';
                        }}
                        className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all h-12 text-lg"
                      >
                        🎙️ Start Interview with Minerva
                      </Button>
                      <Button
                        onClick={() => window.open(assessmentRepoUrl, '_blank')}
                        variant="outline"
                        className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Repository
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 11: Completion Screen (Matches vs Enhance) */}
              {step === 11 && (
                <div
                  className={`space-y-6 transition-opacity duration-300 ease-in-out ${!isTransitioning
                    ? 'opacity-100'
                    : 'opacity-0'
                    }`}
                >
                  <div className="text-center mb-8">
                    <DialogTitle className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                      You're all set!
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2 text-lg">
                      {skipResumeUpload
                        ? "Your profile has been set up successfully."
                        : "Your resume has been uploaded successfully."}
                    </DialogDescription>
                  </div>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {/* View Matches Option */}
                    <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-[#498EDC] hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">View your matches</h3>
                        <p className="text-gray-600 text-sm">
                          See the startups we've matched you with based on your profile.
                        </p>
                      </div>
                      <Button
                        onClick={handleViewMatches}
                        className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
                      >
                        View Matches
                      </Button>
                    </div>

                    {/* Enhance Resume Option */}
                    <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-[#498EDC] hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Enhance Resume</h3>
                        <p className="text-gray-600 text-sm">
                          Get AI-powered suggestions to improve your resume for better matches.
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            // Save selected GitHub repos to database (if any were selected)
                            await saveSelectedRepos();

                            // Mark onboarding as complete
                            await fetch('/api/candidate/mark-onboarding-complete', {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch (error) {
                            console.error('Error marking onboarding complete:', error);
                            // Continue anyway - don't block user
                          }

                          // For top candidates route, onboarding is already complete (assessment was step 10)
                          // Just redirect normally
                          window.location.href = "/resumes";
                        }}
                        variant="outline"
                        className="w-full border-2 border-[#498EDC] text-[#498EDC] hover:bg-[#498EDC] hover:text-white font-medium shadow-md hover:shadow-lg transition-all"
                      >
                        Enhance Resume
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* <ResumeUploadModal
        open={showResumeUpload}
        onOpenChange={setShowResumeUpload}
        onUploadSuccess={() => {
          setShowResumeUpload(false);
          // Advance to Step 7 (Choice Screen) instead of completing
          setIsTransitioning(true);
          setTimeout(() => {
            setStep(7);
            setIsTransitioning(false);
          }, 300);
        }}
      /> */}
    </>
  );
}
