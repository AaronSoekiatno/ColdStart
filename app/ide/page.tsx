'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { TestRunner, TestRunnerRef } from '@/components/assessment/TestRunner';
import { MinervaVoiceIndicator } from '@/components/assessment/MinervaVoiceIndicator';
import AgentChat from '@/components/agent/AgentChat';
import {
    Loader2,
    Clock,
    Send,
    Maximize2,
    Minimize2,
    X,
    Eye,
    MessageSquare,
    Mic,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

export default function IDEPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [containerUrl, setContainerUrl] = useState<string | null>(null);
    const [flyAppName, setFlyAppName] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [containerStatus, setContainerStatus] = useState<'loading' | 'provisioning' | 'running' | 'error'>('loading');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [showAgentChat, setShowAgentChat] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<string | null>(null);
    const [kickOffStarted, setKickOffStarted] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const kickOffStartedRef = useRef(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const phasePollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const testRunnerRef = useRef<TestRunnerRef>(null);
    const buildPhaseStartedRef = useRef(false);
    const reflectionStartedRef = useRef(false);
    const finalTestsRunRef = useRef(false); // Prevent duplicate final test runs
    const { toast } = useToast();

    // Auto-start KICK_OFF Vapi call when container is ready
    const startKickOffCall = async (sessionId: string, userEmail?: string) => {
        if (kickOffStartedRef.current) return;
        kickOffStartedRef.current = true;
        setKickOffStarted(true);

        try {
            // Request microphone permission first
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                stream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                console.error('[IDE] Microphone permission denied:', permError);
                toast({
                    title: 'Microphone Permission Required',
                    description: 'Please allow microphone access for the interview.',
                    variant: 'destructive',
                });
                kickOffStartedRef.current = false;
                setKickOffStarted(false);
                return;
            }

            // Import and initialize Vapi client
            const vapiModule = await import('@/vapi-client.js');
            const vapiClient = vapiModule.default || vapiModule;

            if (vapiClient.initializeVapiListeners) {
                await vapiClient.initializeVapiListeners();
            }

            // Start the KICK_OFF phase call
            if (vapiClient.startPhaseCall) {
                console.log('[IDE] Auto-starting KICK_OFF call for session:', sessionId);
                await vapiClient.startPhaseCall(
                    sessionId,
                    'KICK_OFF',
                    'kickoff',
                    [] // No previous context for first phase
                );

                toast({
                    title: 'Interview Starting',
                    description: 'Minerva is connecting...',
                });
            }
        } catch (error) {
            console.error('[IDE] Failed to start KICK_OFF call:', error);
            toast({
                title: 'Failed to Start Interview',
                description: 'Could not connect to Minerva. Please try again.',
                variant: 'destructive',
            });
            kickOffStartedRef.current = false;
            setKickOffStarted(false);
        }
    };

    // Timer for elapsed time - only starts when BUILD phase begins
    useEffect(() => {
        // Start timer when BUILD phase begins
        if (currentPhase === 'BUILD' && !buildPhaseStartedRef.current) {
            buildPhaseStartedRef.current = true;
        }

        // Only run timer if BUILD phase has started
        if (buildPhaseStartedRef.current && !timerRef.current) {
            timerRef.current = setInterval(() => {
                setElapsedTime((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            // Don't clear timer on phase change, only on unmount
        };
    }, [currentPhase]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Poll for phase changes and auto-start REFLECTION call
    useEffect(() => {
        if (!sessionId || sessionId === 'local-dev-docker' || sessionId === 'local-dev-session') {
            return;
        }

        const pollPhaseChanges = async () => {
            try {
                const { data: session, error } = await supabase
                    .from('interview_sessions')
                    .select('current_phase')
                    .eq('session_id', sessionId)
                    .single();

                if (error) {
                    console.error('[IDE] Error polling phase:', error);
                    return;
                }

                const newPhase = session?.current_phase || null;

                // If phase changed to REFLECTION and no call is active, start the call
                if (newPhase === 'REFLECTION' && currentPhase !== 'REFLECTION') {
                    console.log('[IDE] Phase transitioned to REFLECTION, checking if call should start...');

                    // Prevent duplicate REFLECTION call attempts
                    if (reflectionStartedRef.current) {
                        console.log('[IDE] REFLECTION call already started, skipping duplicate');
                        setCurrentPhase(newPhase);
                        return;
                    }

                    // Check if Vapi call is already active
                    try {
                        const vapiModule = await import('@/vapi-client.js');
                        const vapiClient = vapiModule.default || vapiModule;

                        if (vapiClient.isCallActive && !vapiClient.isCallActive()) {
                            reflectionStartedRef.current = true;
                            console.log('[IDE] Starting REFLECTION call automatically...');

                            // Start the REFLECTION call (without history for now to isolate 400 error)
                            if (vapiClient.startPhaseCall) {
                                await vapiClient.startPhaseCall(
                                    sessionId,
                                    'REFLECTION',
                                    'reflection',
                                    [] // Empty history to test if that's causing the 400
                                );

                                toast({
                                    title: 'Minerva is calling',
                                    description: 'Post-mortem phase has started. Minerva will ask you reflection questions.',
                                });
                            }
                        }
                    } catch (vapiError) {
                        console.error('[IDE] Error starting REFLECTION call:', vapiError);
                    }
                }

                setCurrentPhase(newPhase);
            } catch (error) {
                console.error('[IDE] Error in phase polling:', error);
            }
        };

        // Poll every 3 seconds for phase changes
        phasePollIntervalRef.current = setInterval(pollPhaseChanges, 3000);

        // Initial check
        pollPhaseChanges();

        return () => {
            if (phasePollIntervalRef.current) {
                clearInterval(phasePollIntervalRef.current);
            }
        };
    }, [sessionId, currentPhase, toast]);

    // Listen for REFLECTION call end to complete the assessment
    useEffect(() => {
        if (!sessionId || sessionId === 'local-dev-docker' || sessionId === 'local-dev-session') {
            return;
        }

        let callEndCallback: (() => void) | null = null;
        let vapiClient: any = null;

        const setupPostMortemEndListener = async () => {
            try {
                const vapiModule = await import('@/vapi-client.js');
                vapiClient = vapiModule.default || vapiModule;

                callEndCallback = async () => {
                    // Prevent duplicate test runs (React Strict Mode + multiple listeners)
                    if (finalTestsRunRef.current) {
                        console.log('[IDE] Final tests already triggered, skipping duplicate');
                        return;
                    }

                    // Check if we're in REFLECTION phase when call ends
                    if (currentPhase === 'REFLECTION') {
                        finalTestsRunRef.current = true;
                        console.log('[IDE] REFLECTION call ended, starting background test run...');

                        toast({
                            title: 'Reflection Complete',
                            description: 'Final validation is running in the background...',
                        });

                        // Fire-and-forget: Run FULL test suite in the background
                        // Don't block the UI - validation can take several minutes
                        if (testRunnerRef.current) {
                            testRunnerRef.current.runTests('full')
                                .then(() => {
                                    toast({
                                        title: 'Final Validation Complete',
                                        description: 'Review your test results above.',
                                    });
                                })
                                .catch(error => {
                                    console.error('[IDE] Background test run failed:', error);
                                });
                        }
                    }
                };

                if (vapiClient.onEvent) {
                    vapiClient.onEvent('onCallEnd', callEndCallback);
                }
            } catch (error) {
                console.error('[IDE] Error setting up REFLECTION end listener:', error);
            }
        };

        setupPostMortemEndListener();

        return () => {
            if (vapiClient && vapiClient.offEvent && callEndCallback) {
                vapiClient.offEvent('onCallEnd', callEndCallback);
            }
        };
    }, [sessionId, toast, router]); // Removed currentPhase from deps to prevent re-registering listeners

    // Check auth and fetch container info
    useEffect(() => {
        const checkAuth = async () => {
            const {
                data: { user: currentUser },
            } = await supabase.auth.getUser();
            if (!currentUser) {
                router.push('/?signup=true&redirect=/ide');
                return;
            }
            setUser(currentUser);
            setIsLoading(false);

            // Fetch container info
            fetchContainerInfo(currentUser);
        };
        checkAuth();
    }, [router]);

    // Fetch container information from the database
    const fetchContainerInfo = async (authUser: { id: string; email?: string }) => {
        try {
            // First, get the candidate_id from the candidates table (different from auth user ID)
            const { data: candidate, error: candidateError } = await supabase
                .from('candidates')
                .select('id')
                .eq('email', authUser.email)
                .single();

            if (candidateError || !candidate) {
                console.error('[IDE] Failed to find candidate for user:', authUser.email, candidateError);
                setContainerStatus('error');
                return;
            }

            const candidateId = candidate.id;
            console.log('[IDE] Resolved candidate_id:', candidateId, 'for auth user:', authUser.id);

            // Get user's latest session with container info
            const { data: session, error } = await supabase
                .from('interview_sessions')
                .select('container_url, container_status, session_id, current_phase')
                .eq('candidate_id', candidateId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                console.error('[IDE] Failed to fetch session:', error);
                setContainerStatus('error');
                return;
            }

            if (!session) {
                // No session found
                setContainerStatus('error');
                return;
            }

            console.log('[IDE] Fetched session:', {
                session_id: session?.session_id,
                container_url: session?.container_url,
                container_status: session?.container_status,
                hasSession: !!session
            });

            setSessionId(session.session_id);
            setCurrentPhase(session.current_phase || null);

            // Handle container status
            if (session.container_status === 'running' && session.container_url) {
                setContainerUrl(session.container_url);
                setContainerStatus('running');

                // Extract app name from URL (e.g. https://assess-xxx.fly.dev -> assess-xxx)
                try {
                    const url = new URL(session.container_url);
                    const appName = url.hostname.split('.')[0];
                    if (appName && appName !== 'localhost') {
                        setFlyAppName(appName);
                        console.log('[IDE] Set flyAppName for agent:', appName);
                    }
                } catch (e) {
                    console.error('[IDE] Failed to parse app name from URL:', session.container_url);
                }

                // Auto-start KICK_OFF call when container is ready and we're in KICK_OFF phase
                if (session.current_phase === 'KICK_OFF' && !kickOffStartedRef.current) {
                    console.log('[IDE] Container ready, auto-starting KICK_OFF call...');
                    startKickOffCall(session.session_id, authUser.email);
                }
            } else if (session.container_status === 'provisioning' || !session.container_url) {
                // Poll if explicitly provisioning OR if session exists but no container URL yet
                setContainerStatus('provisioning');
                console.log('[IDE] Container not ready yet, polling in 5s...');
                // Poll every 5 seconds until running
                setTimeout(() => fetchContainerInfo(authUser), 5000);
            } else {
                // Fallback to localhost for local dev
                const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isLocalDev) {
                    setContainerUrl('http://localhost:8080');
                    setContainerStatus('running');
                    setSessionId('local-dev-session');
                    // For local dev, we might not have a fly app, but if testing against a real fly app, set it here manually if needed
                    // setFlyAppName('assess-...'); 
                } else {
                    setContainerStatus('error');
                }
            }
        } catch (error) {
            console.error('[IDE] Error fetching container info:', error);
            setContainerStatus('error');
        }
    };

    // Stop Vapi call if active
    const stopVapiCall = async (reason: string) => {
        try {
            const vapiModule = await import('@/vapi-client.js');
            const vapiClient = vapiModule.default || vapiModule;

            if (vapiClient.isCallActive && vapiClient.isCallActive()) {
                console.log(`[IDE] Stopping Vapi call: ${reason}`);
                if (vapiClient.stopCall) {
                    await vapiClient.stopCall(reason);
                }
            }
        } catch (error) {
            console.error('[IDE] Error stopping Vapi call:', error);
        }
    };

    const handleSubmit = async () => {
        toast({
            title: 'Submitting Assessment',
            description: 'Finalizing your submission...',
        });

        try {
            // Fire-and-forget: Run FULL test suite in the background
            // Don't await - this can take 4-5 minutes and we don't want candidates waiting
            // Results will still be logged to the database asynchronously
            if (testRunnerRef.current) {
                console.log('[IDE] Starting background test run (fire-and-forget)...');
                testRunnerRef.current.runTests('full').catch(error => {
                    console.error('[IDE] Background test run failed:', error);
                });
            }

            // Stop Vapi call if active
            await stopVapiCall('assessment_submitted');

            // Fire-and-forget: Destroy the container in the background
            // Don't block the user waiting for container cleanup
            if (sessionId && sessionId !== 'local-dev-docker' && sessionId !== 'local-dev-session') {
                console.log('[IDE] Scheduling container cleanup (fire-and-forget)...');
                fetch('/api/topcandidates/provision-container', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                }).catch(error => {
                    console.error('[IDE] Background container cleanup failed:', error);
                });
            }

            // Brief delay for toast visibility, then redirect
            await new Promise((resolve) => setTimeout(resolve, 500));

            toast({
                title: 'Assessment Submitted',
                description: 'Your work has been saved. Final validation is running in the background.',
            });

            router.push('/assessment?submitted=true');
        } catch (error) {
            console.error('[IDE] Error during submission:', error);
            // Still navigate even if cleanup fails
            toast({
                title: 'Assessment Submitted',
                description: 'Your work has been saved.',
            });
            router.push('/assessment?submitted=true');
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            iframeRef.current?.parentElement?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading || containerStatus === 'loading') {
        return (
            <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
                <Header initialUser={user} />
                <section className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto mb-4" />
                        <p className="text-slate-300">Loading IDE environment...</p>
                    </div>
                </section>
            </div>
        );
    }

    if (containerStatus === 'provisioning') {
        return (
            <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
                <Header initialUser={user} />
                <section className="flex-1 flex items-center justify-center px-4">
                    <div className="max-w-2xl w-full">
                        {/* Main Loading Card */}
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                            {/* Animated Logo/Icon */}
                            <div className="flex justify-center mb-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
                                    <Loader2 className="h-16 w-16 animate-spin text-blue-400 relative" />
                                </div>
                            </div>

                            {/* Main Title */}
                            <h2 className="text-2xl font-bold text-white text-center mb-3">
                                Setting Up Your Environment
                            </h2>
                            <p className="text-slate-400 text-center mb-8">
                                We're provisioning your cloud IDE powered by Fly.io
                            </p>

                            {/* Progress Steps */}
                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-sm">Allocating compute resources</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-sm">Loading VS Code environment</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-300">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-sm">Installing dependencies</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                                    <span className="text-sm">Starting container</span>
                                </div>
                            </div>

                            {/* Time Estimate */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="text-blue-300 font-medium text-sm mb-1">
                                            Typical setup time: 20-40 seconds
                                        </p>
                                        <p className="text-blue-400/70 text-xs">
                                            First-time provisioning may take slightly longer
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Helpful Tips */}
                            <div className="text-center">
                                <p className="text-slate-500 text-xs mb-2">💡 Pro Tip</p>
                                <p className="text-slate-400 text-sm">
                                    Your environment includes Claude Code, auto-save, and full terminal access
                                </p>
                            </div>
                        </div>

                        {/* Bottom Timer */}
                        <div className="text-center mt-6">
                            <p className="text-slate-500 text-sm">
                                Elapsed time: <span className="font-mono text-slate-400">{formatTime(elapsedTime)}</span>
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    if (containerStatus === 'error' || !containerUrl) {
        return (
            <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
                <Header initialUser={user} />
                <section className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center max-w-md">
                        <div className="text-red-400 mb-4">
                            <X className="h-12 w-12 mx-auto" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Container Not Available</h2>
                        <p className="text-slate-400 mb-6">
                            Your assessment environment could not be loaded. Please start an assessment first.
                        </p>
                        <Button
                            onClick={() => router.push('/assessment')}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Go to Assessment
                        </Button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
            {/* Compact Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                {/* Left section - fixed width to prevent overlap */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-slate-300 font-medium">IDE Connected</span>
                    </div>
                    <div className="h-4 w-px bg-slate-600" />
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span className="font-mono text-sm">{formatTime(elapsedTime)}</span>
                    </div>
                    <div className="h-4 w-px bg-slate-600" />
                    {/* Minerva Voice Indicator */}
                    <MinervaVoiceIndicator />
                </div>

                {/* Center: Run Tests, Submit, AI Chat */}
                <div className="flex-1 flex items-center justify-center gap-3">
                    {/* Test Runner Component */}
                    {sessionId && (
                        <TestRunner ref={testRunnerRef} sessionId={sessionId} />
                    )}

                    <Button
                        onClick={handleSubmit}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                    >
                        Submit
                    </Button>

                    {/* AI Chat Toggle */}
                    <Button
                        onClick={() => setShowAgentChat(!showAgentChat)}
                        variant="outline"
                        size="sm"
                        className={`${showAgentChat
                            ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }`}
                    >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        AI Chat
                    </Button>
                </div>

                {/* Right: Preview and Maximize buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (containerUrl) {
                                // Use code-server's built-in proxy which works on the same port (443)
                                // This avoids Fly.io shared IP port mapping limitations
                                const url = containerUrl.endsWith('/') ? containerUrl : `${containerUrl}/`;
                                window.open(`${url}proxy/3000/`, '_blank');
                            }
                        }}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex relative overflow-hidden">
                {/* Code-Server Iframe */}
                <div className="flex-1 relative">
                    {/* Loading Overlay - Shows while IDE is loading */}
                    {!iframeLoaded && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                            <div className="max-w-md w-full mx-4">
                                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                                    {/* Animated Icon */}
                                    <div className="flex justify-center mb-6">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
                                            <Loader2 className="h-14 w-14 animate-spin text-blue-400 relative" />
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-xl font-bold text-white text-center mb-2">
                                        Loading Your IDE
                                    </h2>
                                    <p className="text-slate-400 text-center text-sm mb-6">
                                        Setting up VS Code in the cloud...
                                    </p>

                                    {/* Minerva Status */}
                                    {kickOffStarted && (
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Mic className="h-5 w-5 text-blue-400" />
                                                    <div className="absolute inset-0 bg-blue-400/50 rounded-full animate-ping" />
                                                </div>
                                                <div>
                                                    <p className="text-blue-300 font-medium text-sm">
                                                        Minerva is speaking
                                                    </p>
                                                    <p className="text-blue-400/70 text-xs">
                                                        Listen while your IDE loads
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Progress indicator */}
                                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Almost ready...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <iframe
                        ref={iframeRef}
                        src={containerUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="clipboard-read; clipboard-write; microphone"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                        title="Code Server IDE"
                        onLoad={() => setIframeLoaded(true)}
                    />
                </div>

                {/* Agent Chat Sliding Panel */}
                <div
                    className={`absolute top-0 right-0 bottom-0 w-[480px] bg-slate-900 border-l border-slate-700 transform transition-transform duration-300 ${showAgentChat ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    {sessionId && (
                        <AgentChat
                            sessionId={sessionId}
                            flyAppName={flyAppName}
                            containerReady={containerStatus === 'running'}
                            onClose={() => setShowAgentChat(false)}
                        />
                    )}
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                    <span>Session: {containerUrl?.includes('localhost') ? 'local-dev' : 'cloud'}</span>
                    <span>Environment: {containerUrl?.includes('localhost') ? 'Docker (Local)' : 'Fly.io'}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>code-server @ {containerUrl?.replace('http://', '').replace('https://', '')}</span>
                    <span>Auto-save enabled</span>
                </div>
            </div>
        </div>
    );
}
