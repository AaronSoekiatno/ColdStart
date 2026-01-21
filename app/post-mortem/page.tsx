'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, Map, Bug, Rocket, MessageSquare } from 'lucide-react';

export default function PostMortemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [answers, setAnswers] = useState({
        q1: '',
        q2: '',
        q3: '',
        difficulty: 5
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/topcandidates/submit-survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(answers),
            });

            if (!response.ok) {
                throw new Error('Failed to submit survey');
            }

            toast({
                title: "Survey Submitted",
                description: "Thank you for your feedback!",
            });

            router.push('/assessment?completed=true');
        } catch (error) {
            console.error('Error submitting survey:', error);
            toast({
                title: "Error",
                description: "There was a problem submitting your survey. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getWordCount = (text: string) => {
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    };

    const isOverLimit = (text: string) => getWordCount(text) > 200;

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
            <Header />

            <section className="flex-1 flex items-center justify-center px-4 py-12 md:py-20">
                <div className="max-w-2xl w-full">
                    <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 md:p-12">

                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-green-50 rounded-full">
                                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                                </div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Assessment Complete</h1>
                            <p className="text-gray-600">
                                Great job! Please take a moment to reflect on your experience.
                            </p>
                        </div>

                        {/* Survey Form */}
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Q1: Approach */}
                            <div className="space-y-3">
                                <label htmlFor="q1" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Map className="h-4 w-4 text-blue-500" />
                                    Q1: Walk me through your approach. What did you do first and why?
                                </label>
                                <textarea
                                    id="q1"
                                    className={`w-full min-h-[100px] bg-gray-50 border ${isOverLimit(answers.q1) ? 'border-red-500' : 'border-gray-200'} rounded-xl p-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none shadow-sm`}
                                    placeholder="I started by analyzing the schema because..."
                                    value={answers.q1}
                                    onChange={(e) => setAnswers({ ...answers, q1: e.target.value })}
                                    required
                                />
                                <div className="flex justify-end">
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${isOverLimit(answers.q1) ? 'text-red-500' : 'text-gray-400'}`}>
                                        {getWordCount(answers.q1)} / 200 words
                                    </span>
                                </div>
                            </div>

                            {/* Q2: Production Readiness (Swapped from Q3) */}
                            <div className="space-y-3">
                                <label htmlFor="q2" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Rocket className="h-4 w-4 text-purple-500" />
                                    Q2: On a scale 1-10, how production-ready is this? What's missing?
                                </label>
                                <textarea
                                    id="q2"
                                    className={`w-full min-h-[100px] bg-gray-50 border ${isOverLimit(answers.q2) ? 'border-red-500' : 'border-gray-200'} rounded-xl p-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none shadow-sm`}
                                    placeholder="7/10. It needs better error handling in the..."
                                    value={answers.q2}
                                    onChange={(e) => setAnswers({ ...answers, q2: e.target.value })}
                                    required
                                />
                                <div className="flex justify-end">
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${isOverLimit(answers.q2) ? 'text-red-500' : 'text-gray-400'}`}>
                                        {getWordCount(answers.q2)} / 200 words
                                    </span>
                                </div>
                            </div>

                            {/* Q3: Claude Mistake (Swapped from Q2, now OPTIONAL) */}
                            <div className="space-y-3">
                                <label htmlFor="q3" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Bug className="h-4 w-4 text-amber-500" />
                                    Q3 (Optional): Show me where Claude Code made a mistake. How did you catch it?
                                </label>
                                <textarea
                                    id="q3"
                                    className={`w-full min-h-[100px] bg-gray-50 border ${isOverLimit(answers.q3) ? 'border-red-500' : 'border-gray-200'} rounded-xl p-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none shadow-sm`}
                                    placeholder="Claude missed the edge case where... (leave blank if none noticed)"
                                    value={answers.q3}
                                    onChange={(e) => setAnswers({ ...answers, q3: e.target.value })}
                                />
                                <div className="flex justify-end">
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${isOverLimit(answers.q3) ? 'text-red-500' : 'text-gray-400'}`}>
                                        {getWordCount(answers.q3)} / 200 words
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <MessageSquare className="h-4 w-4 text-green-500" />
                                    How did you find the assessment difficulty? (1-10)
                                </label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center gap-1 sm:gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => setAnswers({ ...answers, difficulty: num })}
                                                className={`flex-1 h-10 sm:h-12 rounded-lg border text-sm font-medium transition-all ${answers.difficulty === num
                                                    ? 'bg-[#498EDC] border-[#498EDC] text-white shadow-md'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-between px-1 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                                        <span>Very Easy</span>
                                        <span>Just Right</span>
                                        <span>Expert Level</span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting || isOverLimit(answers.q1) || isOverLimit(answers.q2) || isOverLimit(answers.q3)}
                                className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit'
                                )}
                            </Button>
                        </form>

                    </div>
                </div>
            </section>
        </div>
    );
}
