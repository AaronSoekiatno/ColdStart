"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    Zap,
    Target,
    Award,
    Heart,
    Rocket,
    Clock,
    Shield,
    Users as UsersIcon,
    TrendingUp,
    Github,
    Upload,
    Code2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

type Pace = 'fast' | 'moderate' | 'deliberate' | null;
type QualityBar = 'high' | 'balanced' | 'move-fast' | null;

const PRIORITY_OPTIONS = [
    { id: 'ownership', label: 'Ownership', icon: Target },
    { id: 'impact', label: 'Impact', icon: TrendingUp },
    { id: 'quality', label: 'Quality', icon: Award },
    { id: 'autonomy', label: 'Autonomy', icon: Rocket },
    { id: 'growth', label: 'Growth', icon: UsersIcon },
    { id: 'innovation', label: 'Innovation', icon: Zap },
];

export default function FounderInterviewPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        pace: null as Pace,
        qualityBar: null as QualityBar,
        priorities: [] as string[],
        cultureDescription: "",
        githubUrl: "",
        codebaseOption: null as 'github' | 'upload' | 'skip' | null
    });

    const handlePaceSelect = (pace: Pace) => {
        setFormData({ ...formData, pace });
    };

    const handleQualitySelect = (quality: QualityBar) => {
        setFormData({ ...formData, qualityBar: quality });
    };

    const handlePriorityToggle = (priorityId: string) => {
        setFormData(prev => ({
            ...prev,
            priorities: prev.priorities.includes(priorityId)
                ? prev.priorities.filter(p => p !== priorityId)
                : [...prev.priorities, priorityId]
        }));
    };

    const handleNext = () => {
        setError("");

        if (step === 1 && !formData.pace) {
            setError("Please select a pace that describes your team");
            return;
        }
        if (step === 2 && !formData.qualityBar) {
            setError("Please select a quality bar approach");
            return;
        }
        if (step === 3 && formData.priorities.length === 0) {
            setError("Please select at least one priority");
            return;
        }
        if (step === 4 && !formData.cultureDescription.trim()) {
            setError("Please describe your company culture");
            return;
        }
        if (step === 4 && formData.cultureDescription.length < 50) {
            setError("Please provide a more detailed culture description (at least 50 characters)");
            return;
        }

        if (step < 5) {
            setStep(step + 1);
        }
    };

    const handleSubmit = async () => {
        setError("");

        if (!formData.codebaseOption) {
            setError("Please select how you'd like to provide your codebase");
            return;
        }

        if (formData.codebaseOption === 'github' && !formData.githubUrl.trim()) {
            setError("Please provide your GitHub repository URL");
            return;
        }

        setIsSubmitting(true);

        try {
            // Get the current user's session
            const { data: { session } } = await supabase.auth.getSession();
            const userEmail = session?.user?.email;

            // Find the most recent startup entry for this user (from intro_requests or startups)
            // For demo purposes, we'll create/update a startup record
            const { data: existingStartup, error: fetchError } = await supabase
                .from('startups')
                .select('id, name')
                .eq('founder_emails', userEmail)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const operatingModel = {
                pace: formData.pace,
                quality_bar: formData.qualityBar,
                priorities: formData.priorities,
                culture_description: formData.cultureDescription,
                github_repo_url: formData.codebaseOption === 'github' ? formData.githubUrl : null,
                codebase_provided: formData.codebaseOption !== 'skip'
            };

            if (existingStartup) {
                // Update existing startup with operating model
                const { error: updateError } = await supabase
                    .from('startups')
                    .update({ operating_model: operatingModel })
                    .eq('id', existingStartup.id);

                if (updateError) throw updateError;
            } else {
                // No startup found - this shouldn't happen in the normal flow
                // but we'll handle it gracefully
                setError("No company profile found. Please complete the company form first.");
                setIsSubmitting(false);
                return;
            }

            // Success! Redirect to dashboard
            setTimeout(() => {
                router.push("/company-dashboard");
            }, 2000);

        } catch (err: any) {
            console.error("Error saving operating model:", err);
            setError(err?.message || "Failed to save. Please try again.");
            setIsSubmitting(false);
        }
    };

    const containerVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 }
    };

    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/company-form")}
                        className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Back</span>
                    </motion.button>

                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1 className="text-4xl font-bold text-black mb-3">
                            Let's understand your <span className="text-blue-500">engineering DNA</span>
                        </h1>
                        <p className="text-gray-600 text-lg">
                            Answer 4 quick questions so we can match you with engineers who'll thrive at your company
                        </p>
                    </motion.div>

                    {/* Progress Bar */}
                    <div className="mt-6 flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div
                                key={s}
                                className="relative flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"
                            >
                                <motion.div
                                    initial={false}
                                    animate={{
                                        width: step >= s ? '100%' : '0%'
                                    }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="absolute inset-0 bg-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-right text-sm text-gray-500">
                        Question {step} of {totalSteps}
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-gray-100 p-8 md:p-12">
                    <AnimatePresence mode="wait">
                        {!isSubmitting ? (
                            <motion.div
                                key={step}
                                variants={containerVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                            >
                                {/* Question 1: Pace */}
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 mb-8">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                                                <Clock className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-black mb-2">
                                                    How fast do you ship?
                                                </h2>
                                                <p className="text-gray-600">
                                                    Tell us about your team's development velocity and iteration speed
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                {
                                                    value: 'fast' as Pace,
                                                    label: 'Fast',
                                                    desc: 'Ship daily, move quickly, iterate fast. "Done is better than perfect."',
                                                    icon: Rocket
                                                },
                                                {
                                                    value: 'moderate' as Pace,
                                                    label: 'Moderate',
                                                    desc: 'Balanced pace. Ship weekly, thoughtful but not slow.',
                                                    icon: TrendingUp
                                                },
                                                {
                                                    value: 'deliberate' as Pace,
                                                    label: 'Deliberate',
                                                    desc: 'Thorough planning, careful execution. Quality takes time.',
                                                    icon: Shield
                                                }
                                            ].map(({ value, label, desc, icon: Icon }) => (
                                                <motion.button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => handlePaceSelect(value)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-4 ${
                                                        formData.pace === value
                                                            ? 'border-blue-500 bg-blue-50/50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        formData.pace === value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-black">{label}</span>
                                                            {formData.pace === value && (
                                                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600">{desc}</p>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Question 2: Quality Bar */}
                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 mb-8">
                                            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
                                                <Award className="w-6 h-6 text-purple-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-black mb-2">
                                                    What's your quality bar?
                                                </h2>
                                                <p className="text-gray-600">
                                                    How do you balance code quality, testing, and shipping speed?
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                {
                                                    value: 'high' as QualityBar,
                                                    label: 'High Quality Bar',
                                                    desc: 'Rigorous code review, comprehensive testing, clean architecture. Code must be production-grade.',
                                                    icon: Shield
                                                },
                                                {
                                                    value: 'balanced' as QualityBar,
                                                    label: 'Balanced Approach',
                                                    desc: 'Good quality with pragmatic tradeoffs. Test what matters, ship with confidence.',
                                                    icon: Target
                                                },
                                                {
                                                    value: 'move-fast' as QualityBar,
                                                    label: 'Move Fast & Break Things',
                                                    desc: 'Speed over perfection. Ship quickly, fix bugs in production, iterate based on user feedback.',
                                                    icon: Zap
                                                }
                                            ].map(({ value, label, desc, icon: Icon }) => (
                                                <motion.button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => handleQualitySelect(value)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-4 ${
                                                        formData.qualityBar === value
                                                            ? 'border-purple-500 bg-purple-50/50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        formData.qualityBar === value ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-black">{label}</span>
                                                            {formData.qualityBar === value && (
                                                                <CheckCircle2 className="w-5 h-5 text-purple-500" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600">{desc}</p>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Question 3: Priorities */}
                                {step === 3 && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 mb-8">
                                            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                                                <Target className="w-6 h-6 text-green-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-black mb-2">
                                                    What do you value most?
                                                </h2>
                                                <p className="text-gray-600">
                                                    Select the key priorities that define your engineering culture (choose at least one)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {PRIORITY_OPTIONS.map(({ id, label, icon: Icon }) => (
                                                <motion.button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => handlePriorityToggle(id)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                                                        formData.priorities.includes(id)
                                                            ? 'border-green-500 bg-green-50/50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                                >
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                        formData.priorities.includes(id)
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <Icon className="w-6 h-6" />
                                                    </div>
                                                    <span className="font-bold text-black">{label}</span>
                                                    {formData.priorities.includes(id) && (
                                                        <CheckCircle2 className="w-5 h-5 text-green-500 absolute top-2 right-2" />
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Question 4: Culture Description */}
                                {step === 4 && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 mb-8">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                                                <Heart className="w-6 h-6 text-orange-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-black mb-2">
                                                    Describe your culture
                                                </h2>
                                                <p className="text-gray-600">
                                                    In your own words, what makes your engineering team unique?
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <textarea
                                                value={formData.cultureDescription}
                                                onChange={(e) => setFormData({ ...formData, cultureDescription: e.target.value })}
                                                rows={6}
                                                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none outline-none placeholder:text-gray-400"
                                                placeholder="e.g., We value deep technical expertise, rigorous problem-solving, and engineers who take extreme ownership of complex systems that matter. We're building software that solves hard problems, and we need teammates who aren't afraid of complexity..."
                                            />
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">
                                                    {formData.cultureDescription.length} characters
                                                </span>
                                                <span className="text-gray-400">
                                                    Minimum 50 characters
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Question 5: Codebase Ingestion */}
                                {step === 5 && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 mb-8">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                                                <Code2 className="w-6 h-6 text-indigo-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-black mb-2">
                                                    Share your codebase (optional)
                                                </h2>
                                                <p className="text-gray-600">
                                                    We'll analyze your code to generate company-specific assessments that mirror your actual work
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                {
                                                    value: 'github' as const,
                                                    label: 'Connect GitHub Repository',
                                                    desc: 'We'll analyze your codebase patterns, tech stack, and complexity to generate relevant challenges',
                                                    icon: Github
                                                },
                                                {
                                                    value: 'upload' as const,
                                                    label: 'Upload Code Sample',
                                                    desc: 'Upload a representative code sample or technical documentation (coming soon)',
                                                    icon: Upload,
                                                    disabled: true
                                                },
                                                {
                                                    value: 'skip' as const,
                                                    label: 'Skip for Now',
                                                    desc: 'Use our standard assessment. You can always add your codebase later.',
                                                    icon: Target
                                                }
                                            ].map(({ value, label, desc, icon: Icon, disabled }) => (
                                                <motion.button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => !disabled && setFormData({ ...formData, codebaseOption: value })}
                                                    whileHover={!disabled ? { scale: 1.02 } : {}}
                                                    whileTap={!disabled ? { scale: 0.98 } : {}}
                                                    disabled={disabled}
                                                    className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-4 ${
                                                        disabled
                                                            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                                                            : formData.codebaseOption === value
                                                            ? 'border-indigo-500 bg-indigo-50/50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        disabled
                                                            ? 'bg-gray-200 text-gray-400'
                                                            : formData.codebaseOption === value
                                                            ? 'bg-indigo-500 text-white'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-black">{label}</span>
                                                            {formData.codebaseOption === value && !disabled && (
                                                                <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600">{desc}</p>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </div>

                                        {/* GitHub URL Input */}
                                        {formData.codebaseOption === 'github' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="space-y-2 mt-4"
                                            >
                                                <label className="text-sm font-semibold text-gray-700">
                                                    GitHub Repository URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.githubUrl}
                                                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                                                    className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none placeholder:text-gray-400"
                                                    placeholder="https://github.com/your-company/your-repo"
                                                />
                                                <p className="text-xs text-gray-500">
                                                    We'll clone and analyze your repository. Make sure it's public or grant us access.
                                                </p>
                                            </motion.div>
                                        )}

                                        {formData.codebaseOption === 'skip' && (
                                            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                                <p className="text-sm text-gray-700">
                                                    <strong>Note:</strong> You can add your codebase later from your dashboard to generate custom assessments.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mt-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        <p className="text-sm text-red-600 font-medium">{error}</p>
                                    </motion.div>
                                )}

                                {/* Navigation Buttons */}
                                <div className="flex gap-3 mt-8">
                                    {step < 5 ? (
                                        <motion.button
                                            type="button"
                                            onClick={handleNext}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex-1 py-4 bg-black text-white font-bold rounded-2xl hover:bg-gray-900 transition-all"
                                        >
                                            Continue
                                        </motion.button>
                                    ) : (
                                        <motion.button
                                            type="button"
                                            onClick={handleSubmit}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-2xl hover:shadow-lg transition-all"
                                        >
                                            Complete Profile
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="submitting"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-black mb-3">Profile Complete!</h2>
                                <p className="text-gray-600 max-w-sm mx-auto">
                                    We're analyzing our candidate pool to find your perfect matches...
                                </p>
                                <div className="mt-8 flex justify-center">
                                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ x: "-100%" }}
                                            animate={{ x: "0%" }}
                                            transition={{ duration: 2, ease: "easeOut" }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Summary Card (show after step 1) */}
                {step > 1 && !isSubmitting && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200 p-6"
                    >
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Your Answers So Far
                        </h3>
                        <div className="space-y-2">
                            {formData.pace && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span className="text-gray-600">Pace:</span>
                                    <span className="font-semibold text-black capitalize">{formData.pace}</span>
                                </div>
                            )}
                            {formData.qualityBar && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Award className="w-4 h-4 text-purple-500" />
                                    <span className="text-gray-600">Quality Bar:</span>
                                    <span className="font-semibold text-black capitalize">
                                        {formData.qualityBar === 'move-fast' ? 'Move Fast' : formData.qualityBar}
                                    </span>
                                </div>
                            )}
                            {formData.priorities.length > 0 && (
                                <div className="flex items-start gap-2 text-sm">
                                    <Target className="w-4 h-4 text-green-500 mt-0.5" />
                                    <span className="text-gray-600">Priorities:</span>
                                    <span className="font-semibold text-black capitalize">
                                        {formData.priorities.join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
