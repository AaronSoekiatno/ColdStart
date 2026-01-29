"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function CompanyFormPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        companyName: "",
        hiringFor: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (formData.hiringFor.length < 20) {
            setError("Please provide more details (minimum 20 characters)");
            return;
        }

        setIsSubmitting(true);

        try {
            // TODO: Save to database
            console.log("Form data:", formData);

            // For now, just show success
            alert("Thanks! We'll be in touch within 24 hours.");
            router.push("/companies");
        } catch (err) {
            setError("Failed to submit. Please try again.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="bg-black/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <button
                        onClick={() => router.push("/companies")}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-6 py-16">
                <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl border border-white/10 p-8 md:p-12">
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                            Tell us what you're looking for
                        </h1>
                        <p className="text-lg text-gray-400">
                            We'll match you with vetted candidates within 24 hours.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Company Name */}
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-semibold text-white mb-2">
                                Company Name *
                            </label>
                            <input
                                type="text"
                                id="companyName"
                                value={formData.companyName}
                                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-500"
                                placeholder="Acme Inc."
                                required
                            />
                        </div>

                        {/* What are you hiring for */}
                        <div>
                            <label htmlFor="hiringFor" className="block text-sm font-semibold text-white mb-2">
                                What are you hiring for? *
                            </label>
                            <textarea
                                id="hiringFor"
                                value={formData.hiringFor}
                                onChange={(e) => setFormData({ ...formData, hiringFor: e.target.value })}
                                rows={6}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none placeholder:text-gray-500"
                                placeholder="e.g., Founding engineer for AI-powered analytics platform. Looking for full-stack engineer with React/Node.js experience. Startup experience preferred."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                {formData.hiringFor.length} characters (minimum 20)
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                        >
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
