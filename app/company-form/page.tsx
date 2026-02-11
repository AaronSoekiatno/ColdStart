"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Briefcase,
    Send,
    Upload,
    FileText,
    X,
    Globe,
    MapPin,
    Users,
    CheckCircle,
    Calendar,
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
    });

    // File State
    const [file, setFile] = useState<File | null>(null);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
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
                setUserId(session.user.id);
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
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        // Validation for phase 2
        if (!formData.hiringFor.trim() && !file) {
            setError("Please provide a job description or upload a file");
            setIsSubmitting(false);
            return;
        }

        try {
            let jobPostingUrl = "";

            // 1. Upload file if exists
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `postings/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('job-postings')
                    .upload(filePath, file);

                if (!uploadError) {
                    jobPostingUrl = filePath;
                }
            }

            // 2. Save all data to startup_users table
            const { error: saveError } = await supabase
                .from('startup_users')
                .upsert({
                    user_id: userId,
                    company_name: formData.companyName,
                    website: formData.website,
                    hiring_for: formData.hiringFor,
                    job_posting_file_url: jobPostingUrl || null,
                    role: 'founder',
                    onboarding_completed: true
                }, { onConflict: 'user_id' });

            if (saveError) {
                console.error("Error saving to startup_users:", saveError);
                throw saveError;
            }

            // Open Calendly in new tab and show success screen
            window.open("https://calendly.com/aidan-nt76/coldreach-aidan-nguyen-tran", "_blank");
            setIsSubmitting(false);
            setIsSuccess(true);

        } catch (err: any) {
            console.error("Error submitting form:", err?.message || err || "Unknown error");
            setError(err?.message || "Failed to save your information. Please try again.");
            // Fallback to Calendly even on error
            window.open("https://calendly.com/aidan-nt76/coldreach-aidan-nguyen-tran", "_blank");
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
                        onClick={() => {
                            if (isSuccess) {
                                router.push("/company-dashboard");
                            } else {
                                phase > 1 ? setPhase(p => p - 1) : router.push("/");
                            }
                        }}
                        className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors self-start group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium tracking-tight">
                            {isSuccess ? "Back to Dashboard" : (phase > 1 ? `Back to Step ${phase - 1}` : "Back to Home")}
                        </span>
                    </motion.button>

                    <div className="flex gap-2">
                        {!isSuccess && [1, 2].map((s) => (
                            <div
                                key={s}
                                className={`h-1 w-8 rounded-full transition-all duration-500 ${phase >= s ? 'bg-blue-500' : 'bg-gray-100'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Form Container */}
                <div className="max-w-2xl w-full mx-auto lg:mx-0 flex-grow flex flex-col justify-center py-4">
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
                                    </h1>
                                    <p className="text-base text-gray-600 leading-relaxed font-light">
                                        {phase === 1 && "Tell us about your company so we can find the perfect cultural and technical fit."}
                                        {phase === 2 && "Describe the role you're hiring for. We'll use this to understand what you need."}
                                    </p>
                                </div>

                                {/* Phase Forms */}
                                <form onSubmit={phase < 2 ? handleNextPhase : handleSubmit} className="space-y-5">
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
                                                    {phase < 2 ? "Continue" : "Book Demo"}
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
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center text-center space-y-6"
                            >
                                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
                                    <CheckCircle className="w-10 h-10 text-green-500" />
                                </div>

                                <div className="space-y-4">
                                    <h2 className="text-3xl font-bold text-gray-900">We'll be in touch shortly!</h2>
                                    <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                                        Thanks for sharing your hiring needs. We've opened a new tab for you to book a demo slot that works for you.
                                    </p>
                                </div>

                                <div className="flex flex-col w-full max-w-sm gap-3 pt-4">
                                    <button
                                        onClick={() => window.open("https://calendly.com/aidan-nt76/coldreach-aidan-nguyen-tran", "_blank")}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        <Calendar className="w-4 h-4" />
                                        Book Demo (if tab didn't open)
                                    </button>

                                    <button
                                        onClick={() => router.push('/company-dashboard')}
                                        className="w-full py-3 bg-gray-50 text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                                    >
                                        Go to Dashboard
                                    </button>
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
        </div >
    );
}
