'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { TestRunner } from '@/components/assessment/TestRunner';
import { MinervaVoiceIndicator } from '@/components/assessment/MinervaVoiceIndicator';
import {
    Loader2,
    Clock,
    Send,
    Maximize2,
    Minimize2,
    X,
    Mic,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

export default function IDEPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [containerUrl, setContainerUrl] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [containerStatus, setContainerStatus] = useState<'loading' | 'provisioning' | 'running' | 'error'>('loading');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<string | null>(null);
    const [kickOffStarted, setKickOffStarted] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const kickOffStartedRef = useRef(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const phasePollIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

            // Get candidate name for personalization
            const candidateName = userEmail?.split('@')[0] || 'Candidate';

            // Start the KICK_OFF phase call
            if (vapiClient.startPhaseCall) {
                console.log('[IDE] Auto-starting KICK_OFF call for session:', sessionId);
                await vapiClient.startPhaseCall(
                    sessionId,
                    'KICK_OFF',
                    'kickoff',
                    [], // No previous context for first phase
                    null,
                    { candidateName }
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

    // Timer for elapsed time
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Poll for phase changes and auto-start POST_MORTEM call
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

                // If phase changed to POST_MORTEM and no call is active, start the call
                if (newPhase === 'POST_MORTEM' && currentPhase !== 'POST_MORTEM') {
                    console.log('[IDE] Phase transitioned to POST_MORTEM, checking if call should start...');

                    // Check if Vapi call is already active
                    try {
                        const vapiModule = await import('@/vapi-client.js');
                        const vapiClient = vapiModule.default || vapiModule;

                        if (vapiClient.isCallActive && !vapiClient.isCallActive()) {
                            console.log('[IDE] Starting POST_MORTEM call automatically...');

                            // Get conversation history for context
                            const { data: sessionData } = await supabase
                                .from('interview_sessions')
                                .select('conversation_history')
                                .eq('session_id', sessionId)
                                .single();

                            const conversationHistory = sessionData?.conversation_history || [];

                            // Start the POST_MORTEM call
                            if (vapiClient.startPhaseCall) {
                                await vapiClient.startPhaseCall(
                                    sessionId,
                                    'POST_MORTEM',
                                    'post_mortem',
                                    conversationHistory
                                );

                                toast({
                                    title: 'Minerva is calling',
                                    description: 'Post-mortem phase has started. Minerva will ask you reflection questions.',
                                });
                            }
                        }
                    } catch (vapiError) {
                        console.error('[IDE] Error starting POST_MORTEM call:', vapiError);
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
            description: 'Saving your work and creating snapshot...',
        });

        try {
            // Stop Vapi call if active
            await stopVapiCall('assessment_submitted');

            // Destroy the container to save costs
            if (sessionId && sessionId !== 'local-dev-docker' && sessionId !== 'local-dev-session') {
                await fetch('/api/topcandidates/provision-container', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));

            toast({
                title: 'Assessment Submitted',
                description: 'Your work has been saved successfully.',
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

    const handleClose = () => {
        setShowCloseConfirm(true);
    };

    const confirmClose = async () => {
        // Stop Vapi call if active
        await stopVapiCall('session_closed');

        toast({
            title: 'Session Closed',
            description: 'Your progress has been saved. You can continue later.',
        });
        router.push('/assessment');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading || containerStatus === 'loading') {
        return (
            <div className="min-h-screen flex flex-col bg-slate-900">
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
            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
                                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
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
            <div className="min-h-screen flex flex-col bg-slate-900">
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
        <div className="h-screen flex flex-col bg-slate-900">
            {/* Compact Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-slate-300 font-medium">IDE Connected</span>
                    </div>
                    <div className="h-4 w-px bg-slate-600" />
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span className="font-mono text-sm">{formatTime(elapsedTime)}</span>
                    </div>
                </div>

                {/* Minerva Voice Indicator - Center */}
                <div className="flex-1 flex justify-center items-center">
                    <MinervaVoiceIndicator />
                </div>

                <div className="flex items-center gap-3">
                    {/* Test Runner Component */}
                    {sessionId && (
                        <TestRunner sessionId={sessionId} />
                    )}

                    <div className="h-4 w-px bg-slate-600" />

                    <Button
                        onClick={toggleFullscreen}
                        variant="outline"
                        size="sm"
                        className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white"
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Send className="mr-2 h-4 w-4" />
                        Submit Assessment
                    </Button>
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        size="sm"
                        className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-red-600 hover:border-red-600 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Close Confirmation Modal */}
            {showCloseConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md mx-4 shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-2">Close IDE?</h3>
                        <p className="text-slate-400 mb-6">
                            Your progress will be saved and you can continue later from the assessment page.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                onClick={() => setShowCloseConfirm(false)}
                                variant="outline"
                                className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmClose}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Close IDE
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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

                {/* Test Results Side Panel - REMOVED for compact view */}

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
