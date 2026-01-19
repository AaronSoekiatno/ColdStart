'use client';

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, Play, Loader2, Info, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TestResult {
    ancestorTitles: string[];
    title: string;
    status: 'passed' | 'failed' | 'pending';
    duration?: number;
    failureMessages?: string[];
}

interface TestSuite {
    assertionResults: TestResult[];
    startTime: number;
    endTime: number;
    status: 'passed' | 'failed';
    message?: string;
    name: string;
}

interface TestResults {
    numTotalTestSuites: number;
    numPassedTestSuites: number;
    numFailedTestSuites: number;
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    testResults: TestSuite[];
    success: boolean;
}

interface TestRunnerProps {
    sessionId: string;
    className?: string;
}

export interface TestRunnerRef {
    runTests: (testType?: 'quick' | 'full', options?: { destroyAfter?: boolean }) => Promise<void>;
    openPopover: () => void;
}

export const TestRunner = forwardRef<TestRunnerRef, TestRunnerProps>(
    function TestRunner({ sessionId, className }, ref) {
        const [results, setResults] = useState<TestResults | null>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [isOpen, setIsOpen] = useState(false);
        const { toast } = useToast();

        const runTests = async (testType: 'quick' | 'full' = 'quick', keepPopoverOpen: boolean = false, destroyAfter: boolean = false) => {
            setIsLoading(true);
            if (!keepPopoverOpen) {
                setIsOpen(false);
            }

            try {
                const response = await fetch('/api/topcandidates/run-tests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId, testType, destroyAfter }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to run tests');
                }

                // Only update results if we have valid data
                if (data.results) {
                    setResults(data.results);
                    // Auto-open popover to show results
                    setIsOpen(true);
                }
            } catch (error: any) {
                console.error('Test run failed:', error);
            } finally {
                setIsLoading(false);
            }
        };

        // Expose methods to parent via ref
        useImperativeHandle(ref, () => ({
            runTests: async (testType: 'quick' | 'full' = 'quick', options?: { destroyAfter?: boolean }) => {
                await runTests(testType, true, options?.destroyAfter);
            },
            openPopover: () => {
                setIsOpen(true);
            }
        }));

        const getSummary = () => {
            if (!results) return null;
            return {
                total: results.numTotalTests,
                passed: results.numPassedTests,
                failed: results.numFailedTests,
                isSuccess: results.numFailedTests === 0
            };
        };

        const summary = getSummary();

        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <div className={cn("flex items-center gap-2", className)}>
                    {isLoading ? (
                        <Button disabled variant="outline" size="sm" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running Tests...
                        </Button>
                    ) : !results ? (
                        <Button
                            onClick={() => runTests('quick')}
                            variant="outline"
                            size="sm"
                            className="bg-green-600 border-green-500 text-white hover:bg-green-700 hover:border-green-600"
                        >
                            <Play className="mr-2 h-4 w-4" />
                            Run Tests
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "border-2 font-medium",
                                        summary?.isSuccess
                                            ? "border-green-600/50 bg-green-900/10 text-green-400 hover:bg-green-900/20 hover:text-green-300 hover:border-green-500"
                                            : "border-red-600/50 bg-red-900/10 text-red-400 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500"
                                    )}
                                >
                                    {summary?.isSuccess ? (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    ) : (
                                        <XCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {summary?.passed} / {summary?.total} Passed
                                </Button>
                            </PopoverTrigger>

                            <Button
                                onClick={() => runTests('quick')}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-slate-400 hover:text-slate-100"
                                title="Rerun Tests"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <PopoverContent className="w-[400px] p-0 bg-slate-900 border-slate-700 text-slate-300" align="end">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                        <h3 className="font-semibold text-white">Test Results</h3>
                        {summary && (
                            <div className="text-xs font-mono">
                                {summary.passed} Pass / {summary.failed} Fail
                            </div>
                        )}
                    </div>
                    <ScrollArea className="h-[300px]">
                        <div className="p-2 space-y-2">
                            {results?.testResults.map((suite, i) => (
                                <div key={i} className="mb-4 last:mb-0">
                                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        {suite.name.split('/').pop()?.replace(/\.test\.tsx?$/, '')}
                                    </div>
                                    <div className="space-y-1">
                                        {suite.assertionResults.map((test, j) => (
                                            <div key={j} className="flex gap-3 p-2 rounded hover:bg-slate-800/50 transition-colors text-sm">
                                                <div className="mt-0.5 shrink-0">
                                                    {test.status === 'passed' ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn(
                                                        "font-medium leading-tight",
                                                        test.status === 'passed' ? "text-slate-300" : "text-red-300"
                                                    )}>
                                                        {test.title}
                                                    </div>
                                                    {test.failureMessages && test.failureMessages.length > 0 && (
                                                        <div className="mt-1.5 p-2 bg-red-950/30 border border-red-900/50 rounded text-xs font-mono text-red-400 overflow-x-auto">
                                                            {test.failureMessages[0].split('\n')[0]}
                                                            {test.failureMessages[0].split('\n').length > 1 && ' ...'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        );
    });
