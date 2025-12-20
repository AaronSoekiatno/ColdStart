"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ResumeUpload from "@/app/components/ResumeUpload";
// import { ResumeUploadModal } from \"@/components/modals/ResumeUploadModal\";

type ObjectiveType = 'internship' | 'startup' | 'network' | 'improve-application' | 'sf-scene';
type JobType = 'full-time' | 'part-time' | 'internship';
type RoleType = 'PM' | 'SWE' | 'SDE' | 'ML' | 'AI' | 'Data Science' | 'DevOps' | 'Frontend' | 'Backend' | 'Full Stack' | 'Mobile' | 'Security' | 'QA' | 'Design' | 'Product Design' | 'Other';
type YearsOfExperience = 'no-experience' | 'less-than-1' | '1-2' | '2-5' | '5-10' | '10-plus';

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
}

export function OnboardingModal({ open, onOpenChange, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [selectedObjectives, setSelectedObjectives] = useState<ObjectiveType[]>([]);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [selectedRoleTypes, setSelectedRoleTypes] = useState<RoleType[]>([]);
  const [selectedYOE, setSelectedYOE] = useState<YearsOfExperience | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showStatistic, setShowStatistic] = useState(false);
  // const [showResumeUpload, setShowResumeUpload] = useState(false);

  const handleObjectiveSelect = (objective: ObjectiveType) => {
    setSelectedObjectives(prev => {
      if (prev.includes(objective)) {
        return prev.filter(o => o !== objective);
      } else {
        return [...prev, objective];
      }
    });
  };

  const handleStatisticContinue = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(6);
      setIsTransitioning(false);
    }, 300);
  };

  const handleObjectiveContinue = () => {
    if (selectedObjectives.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (step === 5) {
      setShowStatistic(false);
      // Small delay to allow render then trigger animation
      const timer = setTimeout(() => setShowStatistic(true), 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleJobTypeSelect = (jobType: JobType) => {
    setSelectedJobType(jobType);
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(3);
      setIsTransitioning(false);
    }, 300);
  };

  const handleRoleTypeSelect = (roleType: RoleType) => {
    setSelectedRoleTypes(prev => {
      if (prev.includes(roleType)) {
        return prev.filter(r => r !== roleType);
      } else {
        return [...prev, roleType];
      }
    });
  };

  const handleRolesContinue = () => {
    if (selectedRoleTypes.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(4);
      setIsTransitioning(false);
    }, 300);
  };

  const handleYOESelect = (yoe: YearsOfExperience) => {
    setSelectedYOE(yoe);
  };

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
        setIsTransitioning(true);
        setTimeout(() => {
          setStep(5); // Go to Statistic screen
          setIsSubmitting(false);
          setIsTransitioning(false);
        }, 300);
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

  const handleViewMatches = () => {
    // Close modal and redirect to matches
    onOpenChange(false);
    if (onComplete) {
      onComplete();
    }
  };

  // const handleUploadResume = () => {
  //   setShowResumeUpload(true);
  // };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white text-gray-900 w-screen h-screen max-w-none max-h-none overflow-y-auto p-0 flex items-center justify-center">
          <div className="w-full max-w-3xl px-6 sm:px-8 py-8">
            <DialogHeader>
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 3 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 4 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 5 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 6 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                  <div className={`h-2 w-10 rounded-full transition-all duration-500 ${step >= 7 ? 'bg-[#498EDC]' : 'bg-gray-200'
                    }`} />
                </div>
                <p className="text-center text-gray-500 text-sm">
                  Step {step} of 7
                </p>
              </div>
            </DialogHeader>

            <div className="relative min-h-[450px]">
              {/* Step 5: Statistic Screen (Moved from Step 1) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 5 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'
                  }`}
              >
                <div className="text-center space-y-8">
                  <div className={`transition-all duration-700 ${showStatistic ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <DialogTitle className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">
                      Get better results with Hermes
                    </DialogTitle>
                  </div>

                  {/* Positive statistic first - Cold emails */}
                  <div className={`transition-all duration-700 delay-300 ${showStatistic ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 shadow-lg">
                      <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-4">
                        Cold emails to tech recruiters, hiring managers, or potential referrers give you an{" "}
                        <span className="font-bold text-blue-600">edge over traditional applications</span> through direct outreach.
                      </p>
                      <p className="text-base md:text-lg text-gray-600 leading-relaxed">
                        Even modest reply rates{" "}
                        <span className="font-bold text-blue-600">(2–5%)</span> add extra screens, referrals, and interviews that would not occur from applications alone.
                      </p>
                    </div>
                  </div>

                  {/* Traditional application statistic - less intimidating */}
                  <div className={`transition-all duration-700 delay-500 ${showStatistic ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl p-6 shadow-lg max-w-2xl mx-auto">
                      <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                        Traditional online job applications aren't working right now—success rates hover around just{" "}
                        <span className="font-semibold text-gray-800">2%</span> in many cases.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`flex gap-4 mt-12 transition-all duration-700 delay-700 ${showStatistic ? 'opacity-100' : 'opacity-0'}`}>
                  <Button
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setStep(4);
                        setIsTransitioning(false);
                      }, 300);
                    }}
                    variant="outline"
                    className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm py-6 text-lg"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleStatisticContinue}
                    className="flex-[2] bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all py-6 text-lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>

              {/* Step 1: Objectives (Moved from Step 2) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 1 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'
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

              {/* Step 2: Job Type (Moved from Step 3) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 2 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'
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
                      }, 300);
                    }}
                    variant="outline"
                    className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                  >
                    Back
                  </Button>
                </div>
              </div>

              {/* Step 3: Role Type (Moved from Step 4) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 3 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
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
                      }, 300);
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

              {/* Step 4: Years of Experience (Moved from Step 5) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 4 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
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
                      }, 300);
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

              {/* Step 6: Mandatory Resume Upload */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 6 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
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
                      // Advance to Step 7 (Choice Screen)
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setStep(7);
                        setIsTransitioning(false);
                      }, 300);
                    }}
                  // Note: onUpgradeRequired handled by ResumeUpload locally or we can add handler if needed
                  // For onboarding, we typically expect users to be allowed to upload.
                  />
                </div>

                <div className="mt-6">
                  <Button
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setStep(5);
                        setIsTransitioning(false);
                      }, 300);
                    }}
                    variant="outline"
                    className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                  >
                    Back
                  </Button>
                </div>
              </div>

              {/* Step 7: Choice Screen (Matches vs Enhance) */}
              <div
                className={`space-y-6 transition-all duration-500 ease-in-out ${step === 7 && !isTransitioning
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
                  }`}
              >
                <div className="text-center mb-8">
                  <DialogTitle className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                    You're all set!
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 mt-2 text-lg">
                    Your resume has been uploaded successfully.
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
                      onClick={() => {
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
