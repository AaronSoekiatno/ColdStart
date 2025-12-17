"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type JobType = 'full-time' | 'part-time' | 'internship';
type RoleType = 'PM' | 'SWE' | 'SDE' | 'ML' | 'AI' | 'Data Science' | 'DevOps' | 'Frontend' | 'Backend' | 'Full Stack' | 'Mobile' | 'Security' | 'QA' | 'Design' | 'Product Design' | 'Other';

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [selectedRoleTypes, setSelectedRoleTypes] = useState<RoleType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Track if component is mounted
    isMountedRef.current = true;

    // Check if user is authenticated and needs onboarding
    const checkAuthAndOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to home if not authenticated
        router.push('/');
        return;
      }

      // Check if user already completed onboarding
      try {
        const response = await fetch('/api/candidate/check-onboarding', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (!data.needsOnboarding) {
          // User already completed onboarding, redirect to matches
          router.push('/matches');
          return;
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Continue with onboarding if check fails
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

    checkAuthAndOnboarding();

    // Cleanup: mark component as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, [router]);

  const handleJobTypeSelect = (jobType: JobType) => {
    setSelectedJobType(jobType);
    // Smooth transition: fade out, then fade in next step
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 300);
  };

  const handleRoleTypeSelect = (roleType: RoleType) => {
    setSelectedRoleTypes(prev => {
      if (prev.includes(roleType)) {
        // Remove if already selected
        return prev.filter(r => r !== roleType);
      } else {
        // Add if not selected
        return [...prev, roleType];
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedJobType || selectedRoleTypes.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/candidate/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          jobType: selectedJobType,
          roleTypes: selectedRoleTypes,
        }),
      });

      if (!response.ok) {
        // Try to parse error message from response
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
      
      // Verify success before redirecting
      if (data.success) {
        // Check if there's stored resume data from before signup
        try {
          const storedResumeData = sessionStorage.getItem('pendingResumeData');
          if (storedResumeData) {
            const resumeData = JSON.parse(storedResumeData);
            
            // Process the stored resume data
            const processResponse = await fetch('/api/candidate/process-stored-resume', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ resumeData }),
            });

            if (processResponse.ok) {
              // Clear stored data after successful processing
              sessionStorage.removeItem('pendingResumeData');
              console.log('Successfully processed stored resume data');
            } else {
              console.error('Failed to process stored resume data');
            }
          }
        } catch (error) {
          console.error('Error processing stored resume:', error);
          // Continue even if processing fails
        }

        // Redirect to resumes page after onboarding completion
        // Use window.location to ensure a full page reload with updated session
        window.location.href = '/resumes';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl relative">
        {/* Logo */}
        <div className="flex justify-center items-center gap-3 mb-12 w-full">
          <Image 
            src="/images/hermes.png" 
            alt="Hermes" 
            width={40} 
            height={40} 
            className="brightness-0"
          />
          <span className="text-2xl font-semibold text-gray-900">Hermes</span>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`h-2 w-12 rounded-full transition-all duration-500 ${
              step >= 1 ? 'bg-[#498EDC]' : 'bg-gray-200'
            }`} />
            <div className={`h-2 w-12 rounded-full transition-all duration-500 ${
              step >= 2 ? 'bg-[#498EDC]' : 'bg-gray-200'
            }`} />
          </div>
          <p className="text-center text-gray-500 text-sm">
            Step {step} of 2
          </p>
        </div>

        {/* Content Container with relative positioning */}
        <div className="relative min-h-[400px]">
          {/* Step 1: Job Type */}
          <div 
            className={`space-y-6 transition-all duration-500 ease-in-out ${
              step === 1 && !isTransitioning
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'
            }`}
          >
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-8 text-gray-900">
              What type of position are you looking for?
            </h1>
          </div>
          
          <div className="space-y-4 mt-8">
            <button
              onClick={() => handleJobTypeSelect('full-time')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${
                selectedJobType === 'full-time'
                  ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
              }`}
            >
              <div className="font-semibold text-lg text-gray-900">Full-Time</div>
              <div className="text-sm text-gray-600 mt-1">Permanent, full-time positions</div>
            </button>

            <button
              onClick={() => handleJobTypeSelect('part-time')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${
                selectedJobType === 'part-time'
                  ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
              }`}
            >
              <div className="font-semibold text-lg text-gray-900">Part-Time</div>
              <div className="text-sm text-gray-600 mt-1">Part-time or contract positions</div>
            </button>

            <button
              onClick={() => handleJobTypeSelect('internship')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left shadow-sm ${
                selectedJobType === 'internship'
                  ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
              }`}
            >
              <div className="font-semibold text-lg text-gray-900">Internship</div>
              <div className="text-sm text-gray-600 mt-1">Summer, winter, or year-round internships</div>
            </button>
          </div>
        </div>

          {/* Step 2: Role Type */}
          <div 
            className={`space-y-6 transition-all duration-500 ease-in-out ${
              step === 2 && !isTransitioning
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
            }`}
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                What's your role?
              </h1>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 max-h-[60vh] overflow-y-auto px-4 py-4">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  onClick={() => handleRoleTypeSelect(role.value)}
                  className={`p-5 rounded-xl border-2 transition-all text-left shadow-sm ${
                    selectedRoleTypes.includes(role.value)
                      ? 'border-[#498EDC] bg-blue-50 scale-[1.02] shadow-md shadow-blue-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 hover:shadow-md'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{role.label}</div>
                  <div className="text-sm text-gray-600 mt-1">{role.description}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <Button
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setStep(1);
                    setIsTransitioning(false);
                  }, 300);
                }}
                variant="outline"
                className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={selectedRoleTypes.length === 0 || isSubmitting}
                className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all"
              >
                {isSubmitting ? 'Saving...' : 'Complete Setup'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

