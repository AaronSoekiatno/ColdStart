'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function PostMortemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate submission delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast({
            title: "Survey Submitted",
            description: "Thank you for your feedback!",
        });

        router.push('/assessment?completed=true');
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-900 overflow-hidden">
            <Header />

            <section className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-2xl w-full">
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">

                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-green-500/10 rounded-full">
                                    <CheckCircle2 className="h-10 w-10 text-green-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">Assessment Complete</h1>
                            <p className="text-slate-400">
                                Great job! Please take a moment to reflect on your experience.
                            </p>
                        </div>

                        {/* Survey Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="feedback" className="text-sm font-medium text-slate-300">
                                    How did you find the assessment difficulty?
                                </label>
                                <textarea
                                    id="feedback"
                                    className="w-full min-h-[120px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
                                    placeholder="Share your thoughts on the challenges you faced..."
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-medium"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit Survey & Finish'
                                )}
                            </Button>
                        </form>

                    </div>
                </div>
            </section>
        </div>
    );
}
