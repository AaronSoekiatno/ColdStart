'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertCircle, CheckCircle, Play, Loader2, ChevronRight, ChevronDown, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface TestResultsPanelProps {
    sessionId: string;
    className?: string;
}

export function TestResultsPanel({ sessionId, className }: TestResultsPanelProps) {
    const [results, setResults] = useState<TestResults | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [testType, setTestType] = useState<'quick' | 'full'>('quick');
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const runTests = async (type: 'quick' | 'full') => {
        setIsLoading(true);
        setTestType(type);
        setIsOpen(true); // Auto-open panel on run

        try {
            const response = await fetch('/api/topcandidates/run-tests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId, testType: type }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to run tests');
            }

            setResults(data.results);

            if (data.success) {
                toast({
                    title: 'Success',
                    description: 'Tests completed successfully',
                    variant: 'default',
                });
            } else {
                toast({
                    title: 'Warning',
                    description: 'Some tests failed',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
            console.error('Test run failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateScore = () => {
        // This is a rough estimation. Real scoring logic should be consistent with the test files.
        // For now, let's assume 45 points total.
        if (!results) return { score: 0, total: 45 };

        // We can count passed tests, but points might vary per test.
        // Let's simplified view: 1 point per test for now, or just show Pass/Total
        return {
            score: results.numPassedTests,
            total: results.numTotalTests
        };
    };

    const { score, total } = calculateScore();

    return (
        <div className={`flex flex-col h-full bg-background border-l ${className}`}>
            <div className="p-4 border-b flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg">Test Results</h2>
                    <p className="text-xs text-muted-foreground">Validate your implementation</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runTests('quick')}
                        disabled={isLoading}
                    >
                        {isLoading && testType === 'quick' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Quick Run
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => runTests('full')}
                        disabled={isLoading}
                    >
                        {isLoading && testType === 'full' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Full Validation
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                {!results && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2">
                        <Play className="h-8 w-8 opacity-20" />
                        <p>Run tests to verify your solution</p>
                    </div>
                )}

                {isLoading && !results && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Running {testType} validation suite...</p>
                        <p className="text-xs">This runs inside your container environment</p>
                    </div>
                )}

                {results && (
                    <div className="space-y-6">
                        {/* Score Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Assessment Score</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">{score}</span>
                                    <span className="text-sm text-muted-foreground">/ {total} passing tests</span>
                                </div>
                                <div className="w-full bg-secondary h-2 mt-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-500"
                                        style={{ width: `${(score / Math.max(total, 1)) * 100}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Test Suites */}
                        <div className="space-y-4">
                            {results.testResults.map((suite, i) => (
                                <div key={i} className="border rounded-lg overflow-hidden">
                                    <div className="bg-muted/30 p-3 flex items-center justify-between border-b">
                                        <div className="font-medium text-sm truncate max-w-[200px]" title={suite.name}>
                                            {suite.name.split('/').pop()}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-xs font-semibold ${suite.status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {suite.status.toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="divide-y">
                                        {suite.assertionResults.map((test, j) => (
                                            <div key={j} className="p-3 text-sm">
                                                <div className="flex items-start gap-3">
                                                    {test.status === 'passed' ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                    )}
                                                    <div className="space-y-1">
                                                        <div className="font-medium">{test.title}</div>
                                                        <div className="text-xs text-muted-foreground">{test.ancestorTitles.join(' › ')}</div>

                                                        {test.failureMessages && test.failureMessages.length > 0 && (
                                                            <div className="mt-2 text-xs bg-red-50 text-red-600 p-2 rounded font-mono whitespace-pre-wrap overflow-x-auto max-w-full">
                                                                {test.failureMessages[0].split('\n').slice(0, 5).join('\n')}
                                                                {test.failureMessages[0].split('\n').length > 5 && '...'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
