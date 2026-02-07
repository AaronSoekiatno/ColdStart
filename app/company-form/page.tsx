"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    Building2,
    Briefcase,
    Send,
    Upload,
    FileText,
    X,
    Globe,
    MapPin,
    Users,
    Zap,
    Target,
    GithubIcon,

} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function CompanyFormPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [phase, setPhase] = useState(1);
    const [formData, setFormData] = useState({
        companyName: "",
        website: "",
        hiringFor: "",
        location: "",
        teamSize: "",
        shippingSpeed: "" as 'daily' | 'weekly' | 'monthly' | '',
        codeQuality: "" as 'ship-fast' | 'balanced' | 'perfectionist' | '',
        githubUrl: ""
    });

    // File State
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        let mounted = true;

        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!mounted) return;

            if (!session) {
                // No session, redirect to login
                router.push('/login?redirect=/company-form');
                return;
            }

            if (session?.user?.email) {
                setUserEmail(session.user.email);
            }
            setIsCheckingAuth(false);
        };
        getSession();

        return () => {
            mounted = false;
        };
    }, [router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError("File is too large (max 5MB)");
                return;
            }
            setFile(selectedFile);
            setError("");
        }
    };

    const handleNextPhase = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (phase === 1) {
            if (!formData.companyName.trim()) {
                setError("Please enter your company name");
                return;
            }
            if (!formData.website.trim()) {
                setError("Please enter your company website");
                return;
            }
            setPhase(2);
        } else if (phase === 2) {
            if (!formData.hiringFor.trim()) {
                setError("Please provide a job description");
                return;
            }
            if (formData.hiringFor.length < 20) {
                setError("Description should be at least 20 characters");
                return;
            }
            setPhase(3);
        } else if (phase === 3) {
            if (!formData.location.trim()) {
                setError("Please enter your company location");
                return;
            }
            if (!formData.teamSize) {
                setError("Please select your team size");
                return;
            }
            setPhase(4);
        } else if (phase === 4) {
            if (!formData.shippingSpeed) {
                setError("Please select how often you ship");
                return;
            }
            if (!formData.codeQuality) {
                setError("Please select your code quality approach");
                return;
            }
            setPhase(5);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (formData.githubUrl && !formData.githubUrl.includes('github.com')) {
            setError("Please enter a valid GitHub URL");
            return;
        }

        setIsSubmitting(true);

        try {
            let jobPostingUrl = "";

            // 1. Upload file if exists
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `postings/${fileName}`;

                const { error: uploadError, data } = await supabase.storage
                    .from('job-postings')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;
                jobPostingUrl = filePath;
            }

            // 2. Prepare hiring description
            let hiring_for_text = `[Company: ${formData.companyName}] `;
            if (formData.hiringFor) {
                hiring_for_text += formData.hiringFor;
            } else if (file) {
                hiring_for_text += `Uploaded job posting: ${file.name}`;
            }

            // 3. Build operating model
            const operatingModel = {
                pace: formData.shippingSpeed === 'daily' ? 'fast' : formData.shippingSpeed === 'weekly' ? 'moderate' : 'deliberate',
                quality_bar: formData.codeQuality === 'ship-fast' ? 'move-fast' : formData.codeQuality === 'balanced' ? 'balanced' : 'high',
                priorities: [], // Removed buzzword priorities
                culture_description: formData.hiringFor, // Use job description as culture context
                github_repo_url: formData.githubUrl || null,
                codebase_provided: !!formData.githubUrl
            };

            // 4. Save to intro_requests
            const { error: insertError } = await supabase
                .from('intro_requests')
                .insert([
                    {
                        founder_email: userEmail || "anonymous@agencity.ai",
                        hiring_for: hiring_for_text,
                        status: 'pending'
                    }
                ]);

            if (insertError) throw insertError;

            // 5. Create/update startup with operating model
            const { data: existingStartup } = await supabase
                .from('startups')
                .select('id')
                .eq('founder_emails', userEmail)
                .single();

            if (existingStartup) {
                await supabase
                    .from('startups')
                    .update({
                        operating_model: operatingModel,
                        website: formData.website,
                        location: formData.location
                    })
                    .eq('id', existingStartup.id);
            } else {
                await supabase
                    .from('startups')
                    .insert([{
                        name: formData.companyName,
                        website: formData.website,
                        location: formData.location,
                        founder_emails: userEmail,
                        operating_model: operatingModel
                    }]);
            }

            setIsSuccess(true);
            setTimeout(() => {
                router.push("/company-dashboard");
            }, 2000);
        } catch (err: any) {
            console.error("Error submitting form:", err?.message || err || "Unknown error");
            setError(err?.message || "Failed to submit. Please try again.");
            setIsSubmitting(false);
        }
    };

    const containerVariants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    // Show loading while checking authentication
    if (isCheckingAuth) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
            {/* Left Side: Onboarding Content */}
            <div className="w-full lg:w-1/2 flex flex-col p-6 sm:p-8 lg:p-12 relative z-10 overflow-y-auto bg-white">
                {/* Header / Nav */}
                <div className="flex justify-between items-center mb-6">
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => phase > 1 ? setPhase(p => p - 1) : router.push("/companies")}
                        className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors self-start group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium tracking-tight">
                            {phase > 1 ? `Back to Step ${phase - 1}` : "Back to Agencity"}
                        </span>
                    </motion.button>

                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div
                                key={s}
                                className={`h-1 w-8 rounded-full transition-all duration-500 ${phase >= s ? 'bg-blue-500' : 'bg-gray-100'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Form Container */}
                <div className="max-w-md w-full mx-auto lg:mx-0 flex-grow flex flex-col justify-center py-4">
                    <AnimatePresence mode="wait">
                        {!isSuccess ? (
                            <motion.div
                                key={phase}
                                variants={containerVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.4, ease: "easeOut" }}
                            >
                                {/* Phase Header */}
                                <div className="mb-6">
                                    <h1 className="text-3xl md:text-4xl font-bold text-black mb-3 tracking-tight leading-tight">
                                        {phase === 1 && <>Let's build your <span className="text-blue-500">profile</span></>}
                                        {phase === 2 && <>What are you <span className="text-blue-500">hiring for?</span></>}
                                        {phase === 3 && <>Company <span className="text-blue-500">details</span></>}
                                        {phase === 4 && <>How you <span className="text-blue-500">work</span></>}
                                        {phase === 5 && <>Optional: <span className="text-blue-500">Your codebase</span></>}
                                    </h1>
                                    <p className="text-base text-gray-600 leading-relaxed font-light">
                                        {phase === 1 && "Tell us about your company so we can find the perfect cultural and technical fit."}
                                        {phase === 2 && "Describe the role you're hiring for. We'll use this to understand what you need."}
                                        {phase === 3 && "Location and team size help us understand your context."}
                                        {phase === 4 && "Two quick questions to understand your engineering culture."}
                                        {phase === 5 && "Connect your GitHub to generate custom assessments that match your actual work."}
                                    </p>
                                </div>

                                {/* Phase Forms */}
                                <form onSubmit={phase < 5 ? handleNextPhase : handleSubmit} className="space-y-5">
                                    {phase === 1 && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Building2 className="w-3.5 h-3.5" /> Company Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.companyName}
                                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none placeholder:text-gray-400"
                                                    placeholder="e.g., Agencity"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Globe className="w-3.5 h-3.5" /> Website
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.website}
                                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-none placeholder:text-gray-400"
                                                    placeholder="e.g., https://www.agencity.co"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {phase === 2 && (
                                        <div className="space-y-4">
                                            {/* Description Textarea */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Briefcase className="w-3.5 h-3.5" /> Job Description
                                                </label>
                                                <textarea
                                                    value={formData.hiringFor}
                                                    onChange={(e) => setFormData({ ...formData, hiringFor: e.target.value })}
                                                    rows={3}
                                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none outline-none placeholder:text-gray-400"
                                                    placeholder="e.g., Founding engineer with React/Go experience..."
                                                    required
                                                />
                                            </div>

                                            {/* File Upload OR Divider */}
                                            <div className="relative py-3">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                                                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest"><span className="bg-white px-4 text-gray-400">OR</span></div>
                                            </div>

                                            {/* File Upload Component */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Upload className="w-3.5 h-3.5" /> Upload Job Posting
                                                </label>

                                                <div
                                                    onClick={() => !file && fileInputRef.current?.click()}
                                                    className={`relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer
                                                        ${file ? 'border-blue-500/50 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleFileChange}
                                                        className="hidden"
                                                        accept=".pdf,.doc,.docx,.txt"
                                                    />

                                                    {file ? (
                                                        <div className="flex items-center gap-3 w-full">
                                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                                                                <FileText className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-grow min-w-0">
                                                                <p className="text-sm font-medium text-black truncate">{file.name}</p>
                                                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                                                <Upload className="w-6 h-6" />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-sm font-medium text-black">Click to upload doc</p>
                                                                <p className="text-xs text-gray-500 mt-1">PDF, DOCX or TXT up to 5MB</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {phase === 3 && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                        <MapPin className="w-3.5 h-3.5" /> Location
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                        className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none placeholder:text-gray-400"
                                                        placeholder="SF / Remote"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                        <Users className="w-3.5 h-3.5" /> Team Size
                                                    </label>
                                                    <select
                                                        value={formData.teamSize}
                                                        onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                                                        className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                                        required
                                                    >
                                                        <option value="">Select size</option>
                                                        <option value="1-10">1-10</option>
                                                        <option value="11-50">11-50</option>
                                                        <option value="51-200">51-200</option>
                                                        <option value="200+">200+</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {phase === 4 && (
                                        <div className="space-y-5">
                                            {/* Shipping Speed */}
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Zap className="w-3.5 h-3.5" /> How often do you ship to production?
                                                </label>
                                                <div className="space-y-2">
                                                    {[
                                                        { value: 'daily', label: 'Multiple times a day', desc: 'Fast iterations, continuous deployment' },
                                                        { value: 'weekly', label: 'Weekly sprints', desc: 'Balanced pace, regular releases' },
                                                        { value: 'monthly', label: 'Monthly or longer', desc: 'Careful releases, thorough testing' }
                                                    ].map(({ value, label, desc }) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, shippingSpeed: value as any })}
                                                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${formData.shippingSpeed === value
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-semibold text-black">{label}</span>
                                                                {formData.shippingSpeed === value && (
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600">{desc}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Code Quality */}
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <Target className="w-3.5 h-3.5" /> What's your approach to code quality?
                                                </label>
                                                <div className="space-y-2">
                                                    {[
                                                        { value: 'ship-fast', label: 'Ship fast, fix bugs later', desc: 'Speed over perfection, iterate based on feedback' },
                                                        { value: 'balanced', label: 'Balance speed and quality', desc: 'Good tests, pragmatic tradeoffs' },
                                                        { value: 'perfectionist', label: 'High bar, ship when ready', desc: 'Comprehensive tests, thorough review, clean code' }
                                                    ].map(({ value, label, desc }) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, codeQuality: value as any })}
                                                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${formData.codeQuality === value
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-semibold text-black">{label}</span>
                                                                {formData.codeQuality === value && (
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600">{desc}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {phase === 5 && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">
                                                    <GithubIcon className="w-3.5 h-3.5" /> GitHub Repository (Optional)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.githubUrl}
                                                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-black rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none placeholder:text-gray-400"
                                                    placeholder="https://github.com/your-company/your-repo"
                                                />
                                                <p className="text-xs text-gray-400 ml-1">
                                                    Leave empty to use standard assessments instead.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            <p className="text-sm text-red-600 font-medium">{error}</p>
                                        </motion.div>
                                    )}

                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="group relative w-full py-3 bg-black text-white font-bold rounded-2xl hover:bg-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-xl"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {isSubmitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    {phase < 5 ? "Continue" : "Complete Setup"}
                                                    <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                </>
                                            )}
                                        </span>
                                    </motion.button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-8">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-black mb-4">All Set!</h2>
                                <p className="text-gray-600 max-w-sm mx-auto leading-relaxed">
                                    Taking you to your dashboard to see matched candidates...
                                </p>
                                <div className="mt-12 flex justify-center">
                                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ x: "-100%" }}
                                            animate={{ x: "0%" }}
                                            transition={{ duration: 3 }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Component */}
                <footer className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center opacity-60">
                    <p className="text-xs text-gray-400">© 2026 Agencity Talent Acquisition</p>
                </footer>
            </div>

            {/* Right Side: Visual Image - Sticky/Fixed */}
            <div className="hidden lg:block w-1/2 relative overflow-hidden bg-black border-l border-white/10">
                <Image
                    src="/images/hermes2bg.png"
                    alt="Agencity Sky"
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
                            The future of <span className="text-blue-500">hiring</span> is human & AI.
                        </h2>
                        <p className="text-xl text-white/60 font-light leading-relaxed">
                            We help startups find exceptional engineering talent by analyzing code, not just resumes.
                        </p>
                    </motion.div>
                </div>

                {/* Bottom Right Logo */}
                <div className="absolute bottom-12 right-12 flex items-center gap-3">
                    <Image src="/images/hermes.png" alt="Logo" width={32} height={32} className="opacity-80" />
                    <span className="text-xl font-bold text-white opacity-80 tracking-tight">Agencity</span>
                </div>
            </div>
        </div>
    );
}
