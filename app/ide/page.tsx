'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { TestRunner, TestRunnerRef } from '@/components/assessment/TestRunner';
import { MinervaVoiceIndicator } from '@/components/assessment/MinervaVoiceIndicator';
import AgentChat from '@/components/agent/AgentChat';
import { MonacoWorkspace } from '@/components/editor/MonacoWorkspace';
import { VAPI_ENABLED } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';
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
    ExternalLink,
    RefreshCw,
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
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [provisioningTime, setProvisioningTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);

    const [showAgentChat, setShowAgentChat] = useState(false);
    const [editorMode, setEditorMode] = useState<'classic' | 'monaco'>('classic');
    const [currentPhase, setCurrentPhase] = useState<string | null>(null);
    const [kickOffStarted, setKickOffStarted] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const kickOffStartedRef = useRef(false);
    const isPreviewingRef = useRef(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const iframeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const phasePollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const testRunnerRef = useRef<TestRunnerRef>(null);
    const buildPhaseStartedRef = useRef(false);
    const reflectionStartedRef = useRef(false);
    const finalTestsRunRef = useRef(false); // Prevent duplicate final test runs
    const { toast } = useToast();

    // Vapi orchestration removed in favor of simple timer-based flow


    // Timer for elapsed time - starts when Container is RUNNING
    // Max duration: 20 minutes (1200 seconds)
    useEffect(() => {
        // Start timer when container is running AND iframe is fully loaded (user can see IDE)
        if (containerStatus === 'running' && iframeLoaded && !timerRef.current) {
            timerRef.current = setInterval(() => {
                setElapsedTime((prev) => {
                    // Check for auto-submit at 20 minutes
                    if (prev >= 1200 - 1) { // 1200 seconds = 20 mins
                        if (timerRef.current) clearInterval(timerRef.current);
                        timerRef.current = null;

                        // Auto-submit logic must be handled carefully to avoid loops
                        // We'll trust the effect cleanup or separate trigger
                        // But actually we can't call handleSubmit easily from inside setState callback properly without refs
                        // So we'll trigger it via a separate effect or just check here to stop updates
                        return 1200;
                    }
                    return prev + 1;
                });
            }, 1000);
        }

        return () => {
            // Don't clear timer on phase change, only on unmount or finish
        };
    }, [containerStatus, iframeLoaded]);

    // Separate timer for provisioning time (used for progress UI)
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (containerStatus === 'provisioning') {
            interval = setInterval(() => {
                setProvisioningTime((prev) => prev + 1);
            }, 1000);
        } else {
            setProvisioningTime(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [containerStatus]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Watch for time limit
    useEffect(() => {
        if (elapsedTime >= 1200 && !finalTestsRunRef.current) {
            console.log('[IDE] Time limit reached (20 mins), auto-submitting...');
            finalTestsRunRef.current = true; // Mark as submitted
            toast({
                title: 'Time Limit Reached',
                description: '20 minutes have passed. Auto-submitting assessment...',
                variant: 'destructive'
            });
            handleSubmit();
        }
    }, [elapsedTime]);



    // Vapi poll phase and end listener removed


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

    // Hybrid approach: Real-time subscription + polling fallback
    // Real-time is fast but limited to 2 concurrent connections on FREE tier
    // Polling ensures reliability if real-time limit is reached
    useEffect(() => {
        if (!sessionId || sessionId === 'local-dev-session' || sessionId === 'local-dev-docker' || !user) {
            return;
        }

        console.log('[IDE] Setting up hybrid monitoring (real-time + polling) for session:', sessionId);

        // 1. Real-time subscription (fast when available)
        const channel = supabase
            .channel(`container-status-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'interview_sessions',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    console.log('[IDE] ⚡ Real-time update received:', payload.new);

                    const newStatus = payload.new.container_status;
                    const newUrl = payload.new.container_url;

                    // Update container status if changed
                    if (newStatus === 'running' && newUrl) {
                        console.log('[IDE] Container is now running:', newUrl);
                        setContainerUrl(newUrl);
                        setContainerStatus('running');

                        // Extract app name for agent
                        try {
                            const url = new URL(newUrl);
                            const appName = url.hostname.split('.')[0];
                            if (appName && appName !== 'localhost') {
                                setFlyAppName(appName);
                            }
                        } catch (e) {
                            console.error('[IDE] Failed to parse app name:', e);
                        }

                        // Auto-start KICK_OFF call logic removed

                    } else if (newStatus === 'error' || newStatus === 'stopped') {
                        console.log('[IDE] Container error/stopped:', newStatus);
                        setContainerStatus('error');
                        setErrorDetails(`Container ${newStatus}`);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[IDE] Real-time subscription status:', status);
                // If subscription fails (e.g., FREE tier connection limit), polling fallback will handle it
            });

        // 2. Polling fallback (runs every 10s as backup)
        // Only polls if container is still provisioning
        const pollInterval = setInterval(() => {
            if (containerStatus === 'provisioning') {
                console.log('[IDE] 🔄 Polling for container status (fallback)...');
                fetchContainerInfo(user);
            }
        }, 10000); // 10 seconds (less aggressive than before)

        return () => {
            console.log('[IDE] Cleaning up real-time subscription and polling');
            channel.unsubscribe();
            clearInterval(pollInterval);
        };
    }, [sessionId, user, containerStatus]);

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
                console.error('[IDE] No active session found for candidate:', candidateId);
                setErrorDetails('No active session found. Please start a new assessment.');
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

                // Auto-start KICK_OFF call logic removed

            } else if (session.container_status === 'provisioning' || !session.container_url) {
                // Set provisioning state - real-time subscription will handle updates
                setContainerStatus('provisioning');
                console.log('[IDE] Container provisioning, waiting for real-time update...');
                // NO MORE POLLING - real-time subscription will update state
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
            setErrorDetails(error instanceof Error ? error.message : 'Unknown error occurred');
            setContainerStatus('error');
        }
    };

    // Safety timeout for iframe loading
    useEffect(() => {
        if (containerStatus === 'running' && !iframeLoaded) {
            // If iframe hasn't loaded in 15 seconds, remove the overlay to let user see potentially underlying browser errors
            iframeTimeoutRef.current = setTimeout(() => {
                console.warn('[IDE] Iframe load timed out, forcing display');
                setIframeLoaded(true);
            }, 15000);
        }

        return () => {
            if (iframeTimeoutRef.current) clearTimeout(iframeTimeoutRef.current);
        };
    }, [containerStatus, iframeLoaded]);

    // Stop Vapi call if active
    const stopVapiCall = async (reason: string) => {
        // Vapi is disabled via feature flag
        if (!VAPI_ENABLED) {
            console.log('[IDE] Vapi is disabled via feature flag, skipping stop call');
            return;
        }

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
            // Create snapshot on submission (await to ensure content is captured before destruction)
            if (sessionId && sessionId !== 'local-dev-session' && sessionId !== 'local-dev-docker') {
                console.log('[IDE] Triggering snapshot creation on submission');
                try {
                    const response = await fetch('/api/snapshots/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sessionId,
                            trigger: 'submission',
                            message: 'Final submission snapshot',
                        }),
                    });

                    if (response.ok) {
                        console.log('[IDE] Submission snapshot created successfully');
                    } else {
                        console.warn('[IDE] Snapshot creation failed:', response.statusText);
                    }
                } catch (error) {
                    console.warn('[IDE] Snapshot creation error:', error);
                }
            }

            // Fire-and-forget: Run FULL test suite in the background
            // Don't await - this can take 4-5 minutes and we don't want candidates waiting
            // Results will still be logged to the database asynchronously
            // Container cleanup will happen AFTER tests complete
            if (testRunnerRef.current) {
                console.log('[IDE] Starting background test run with server-side destruction...');

                // Pass destroyAfter: true to let the server handle cleanup
                testRunnerRef.current.runTests('full', { destroyAfter: true })
                    .catch(error => {
                        console.error('[IDE] Background test run initialization failed:', error);
                    });
            }

            // Stop Vapi call if active
            await stopVapiCall('assessment_submitted');

            // Brief delay for toast visibility, then redirect
            await new Promise((resolve) => setTimeout(resolve, 500));

            toast({
                title: 'Assessment Submitted',
                description: 'Your work has been saved. Final validation is running in the background.',
            });

            router.push('/post-mortem');

        } catch (error) {
            console.error('[IDE] Error during submission:', error);
            // Still navigate even if cleanup fails
            toast({
                title: 'Assessment Submitted',
                description: 'Your work has been saved.',
            });
            router.push('/post-mortem');

        }
    };

    // NUCLEAR FALLBACK: Periodically force-hide Copilot/Chat from the parent
    // This handles cases where onLoad doesn't fire or DOM elements are lazy-loaded
    useEffect(() => {
        if (!containerUrl || !iframeRef.current) return;

        const intervalId = setInterval(() => {
            try {
                const iframe = iframeRef.current;
                // Graceful check for cross-origin access
                if (!iframe?.contentWindow?.document) return;

                const doc = iframe.contentDocument!;

                // 1. Re-inject CSS if missing
                if (!doc.getElementById('hermes-hide-copilot-nuclear')) {
                    const style = doc.createElement('style');
                    style.id = 'hermes-hide-copilot-nuclear';
                    style.textContent = `
                        /* NUCLEAR: Hide ALL chat/copilot UI */
                        .part.sidebar.right,
                        .sidebar.right,
                        [id*="workbench.view.extension.github-copilot"],
                        [id*="workbench.panel.chat"],
                        [id*="workbench.view.chat"],
                        [id*="chat"],
                        [class*="chat"],
                        .codicon-comment-discussion,
                        .codicon-copilot,
                        [aria-label*="Chat"],
                        [aria-label*="Copilot"],
                        [aria-label*="GitHub Copilot"] {
                            display: none !important;
                            visibility: hidden !important;
                            width: 0 !important;
                            height: 0 !important;
                            opacity: 0 !important;
                            pointer-events: none !important;
                            position: absolute !important;
                            left: -9999px !important;
                            z-index: -9999 !important;
                        }
                    `;
                    doc.head.appendChild(style);
                }

                // 2. Direct removal of elements
                const selectors = [
                    '.part.sidebar.right',
                    '[id*="workbench.view.extension.github-copilot"]',
                    '[id*="workbench.panel.chat"]',
                    '[aria-label*="Chat"]',
                    '[aria-label*="Copilot"]',
                    '[aria-label*="GitHub Copilot"]'
                ];

                selectors.forEach(selector => {
                    doc.querySelectorAll(selector).forEach((el: Element) => {
                        if (el instanceof HTMLElement) {
                            el.style.display = 'none';
                            el.remove();
                        }
                    });
                });

            } catch (e) {
                // Ignore cross-origin errors if they occur
            }
        }, 500);

        return () => clearInterval(intervalId);
    }, [containerUrl]);

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

    // Tab switch detection
    const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Check if user clicked preview button
                if (isPreviewingRef.current) {
                    console.log('[IDE] Valid tab switch (Preview), ignoring warning');
                    isPreviewingRef.current = false;
                    return;
                }
                setShowTabSwitchWarning(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

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
        // Calculate progress percentage based on elapsed time (0-100%)
        // Typical provisioning: 20-40s, so we'll use 35s as baseline
        const progressPercent = Math.min(Math.floor((provisioningTime / 35) * 100), 95);

        // Dynamic status message based on elapsed time
        const getStatusMessage = () => {
            if (provisioningTime < 5) return { step: 'Deploying container to Fly.io...', icon: '🚀' };
            if (provisioningTime < 10) return { step: 'Allocating compute resources...', icon: '⚙️' };
            if (provisioningTime < 15) return { step: 'Loading VS Code environment...', icon: '💻' };
            if (provisioningTime < 25) return { step: 'Starting development server...', icon: '🔥' };
            if (provisioningTime < 35) return { step: 'Warming up Next.js compiler...', icon: '⚡' };
            return { step: 'Finalizing setup...', icon: '✨' };
        };

        const currentStatus = getStatusMessage();
        const estimatedRemaining = Math.max(35 - provisioningTime, 5);

        return (
            <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
                <Header initialUser={user} />
                {/* section adjusted with pt-16 to move card lower on the screen */}
                <section className="flex-1 flex items-center justify-center px-4 pt-16">
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

                            {/* Progress Bar */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-400">Progress</span>
                                    <span className="text-sm font-mono text-blue-400">{progressPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Current Status */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">{currentStatus.icon}</div>
                                    <div className="flex-1">
                                        <p className="text-blue-300 font-medium text-sm mb-1">
                                            {currentStatus.step}
                                        </p>
                                        <p className="text-blue-400/70 text-xs">
                                            Estimated time remaining: ~{estimatedRemaining}s
                                        </p>
                                    </div>
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                </div>
                            </div>

                            {/* Progress Steps */}
                            <div className="space-y-3 mb-6">
                                <div className={`flex items-center gap-3 transition-colors ${provisioningTime >= 5 ? 'text-green-400' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${provisioningTime >= 5 ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <span className="text-sm">Deploy container</span>
                                    {provisioningTime >= 5 && <span className="text-xs">✓</span>}
                                </div>
                                <div className={`flex items-center gap-3 transition-colors ${provisioningTime >= 10 ? 'text-green-400' : provisioningTime >= 5 ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${provisioningTime >= 10 ? 'bg-green-500' : provisioningTime >= 5 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                    <span className="text-sm">Allocate resources</span>
                                    {provisioningTime >= 10 && <span className="text-xs">✓</span>}
                                </div>
                                <div className={`flex items-center gap-3 transition-colors ${provisioningTime >= 15 ? 'text-green-400' : provisioningTime >= 10 ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${provisioningTime >= 15 ? 'bg-green-500' : provisioningTime >= 10 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                    <span className="text-sm">Load VS Code</span>
                                    {provisioningTime >= 15 && <span className="text-xs">✓</span>}
                                </div>
                                <div className={`flex items-center gap-3 transition-colors ${provisioningTime >= 25 ? 'text-green-400' : provisioningTime >= 15 ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${provisioningTime >= 25 ? 'bg-green-500' : provisioningTime >= 15 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                    <span className="text-sm">Start dev server</span>
                                    {provisioningTime >= 25 && <span className="text-xs">✓</span>}
                                </div>
                                <div className={`flex items-center gap-3 transition-colors ${provisioningTime >= 35 ? 'text-green-400' : provisioningTime >= 25 ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${provisioningTime >= 35 ? 'bg-green-500' : provisioningTime >= 25 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                    <span className="text-sm">Warm up compiler</span>
                                    {provisioningTime >= 35 && <span className="text-xs">✓</span>}
                                </div>
                            </div>

                            {/* Helpful Tips */}
                            <div className="text-center border-t border-slate-700 pt-4">
                                <p className="text-slate-500 text-xs mb-2">💡 Pro Tip</p>
                                <p className="text-slate-400 text-sm">
                                    Your environment includes Claude Code, auto-save, and full terminal access
                                </p>
                            </div>
                        </div>

                        {/* Bottom Timer */}
                        <div className="text-center mt-6">
                            <p className="text-slate-500 text-sm">
                                Elapsed time: <span className="font-mono text-slate-400">{formatTime(provisioningTime)}</span>
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
                            {errorDetails || 'Your assessment environment could not be loaded. Please start an assessment first.'}
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
        <div className="h-screen flex flex-col bg-slate-900 overflow-hidden relative">
            {/* Tab Switch Warning Banner */}
            {showTabSwitchWarning && (
                <div className="absolute top-0 left-0 right-0 z-50 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 flex items-center justify-between shadow-lg animate-in slide-in-from-top-full duration-300">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-1.5 rounded-full">
                            <Eye className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium">
                            Tab switching detected. This will affect your score. To preview your app safely, please use the "Eye" button in the toolbar.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowTabSwitchWarning(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

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
                        onClick={() => setShowPreview(!showPreview)}
                        className={`p-2 transition-colors ${showPreview ? 'text-blue-400 bg-blue-400/10 rounded-lg' : 'text-slate-400 hover:text-white'}`}
                        title={showPreview ? "Close Preview" : "Preview App"}
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-600 mx-2" />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditorMode(editorMode === 'classic' ? 'monaco' : 'classic')}
                        className={cn(
                            "text-[10px] h-7 px-2 font-bold transition-all",
                            editorMode === 'monaco'
                                ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
                                : "bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200"
                        )}
                    >
                        {editorMode === 'monaco' ? 'MONACO ACTIVE' : 'TRY MONACO (BETA)'}
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex relative overflow-hidden">
                {/* Code-Server Iframe */}
                <div className={`relative transition-all duration-300 ${showPreview ? 'w-1/2 border-r border-slate-700' : 'flex-1'}`}>
                    {/* Monaco Editor Workspace */}
                    {editorMode === 'monaco' && sessionId && (
                        <div className="absolute inset-0 z-20 bg-slate-900">
                            <MonacoWorkspace sessionId={sessionId} />
                        </div>
                    )}

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
                        onLoad={() => {
                            setIframeLoaded(true);

                            // NUCLEAR OPTION: Aggressive CSS + MutationObserver to hide Copilot/Chat
                            try {
                                const iframe = iframeRef.current;
                                // We need to access the contentDocument. If it's blocked by cross-origin, this catch block catches it.
                                // Since we are on the same domain (likely routed via proxy or same host), this often works.
                                if (!iframe?.contentWindow?.document) return;

                                const doc = iframe.contentDocument!;

                                // 1. Inject aggressive CSS
                                const injectCSS = () => {
                                    if (doc.getElementById('hermes-hide-copilot-nuclear')) return;

                                    const style = doc.createElement('style');
                                    style.id = 'hermes-hide-copilot-nuclear';
                                    style.textContent = `
                                        /* NUCLEAR: Hide ALL chat/copilot UI */
                                        .part.sidebar.right,
                                        .sidebar.right,
                                        [id*="workbench.view.extension.github-copilot"],
                                        [id*="workbench.panel.chat"],
                                        [id*="workbench.view.chat"],
                                        [id*="chat"],
                                        [class*="chat"],
                                        .codicon-comment-discussion,
                                        .codicon-copilot,
                                        [aria-label*="Chat"],
                                        [aria-label*="Copilot"],
                                        [aria-label*="GitHub Copilot"] {
                                            display: none !important;
                                            visibility: hidden !important;
                                            width: 0 !important;
                                            height: 0 !important;
                                            opacity: 0 !important;
                                            pointer-events: none !important;
                                            position: absolute !important;
                                            left: -9999px !important;
                                            z-index: -9999 !important;
                                        }
                                    `;
                                    doc.head.appendChild(style);
                                    console.log('[Hermes] Nuclear CSS injected');
                                };

                                // 2. Hide/Remove elements directly via JS
                                const hideElements = () => {
                                    const selectors = [
                                        '.part.sidebar.right',
                                        '[id*="workbench.view.extension.github-copilot"]',
                                        '[id*="workbench.panel.chat"]',
                                        '[aria-label*="Chat"]',
                                        '[aria-label*="Copilot"]'
                                    ];

                                    selectors.forEach(selector => {
                                        doc.querySelectorAll(selector).forEach((el: Element) => {
                                            if (el instanceof HTMLElement) {
                                                el.style.display = 'none';
                                                el.remove(); // Delete it from DOM
                                            }
                                        });
                                    });
                                };

                                // Execute immediately
                                injectCSS();
                                hideElements();

                                // 3. Set up MutationObserver
                                const observer = new MutationObserver((mutations) => {
                                    let shouldHide = false;
                                    for (const mutation of mutations) {
                                        if (mutation.addedNodes.length > 0) {
                                            shouldHide = true;
                                            break;
                                        }
                                    }
                                    if (shouldHide) {
                                        injectCSS();
                                        hideElements();
                                    }
                                });

                                observer.observe(doc.documentElement, {
                                    childList: true,
                                    subtree: true
                                });

                                // 4. Periodic sweep (belt and suspenders)
                                const intervalId = setInterval(() => {
                                    hideElements();
                                }, 1000);

                                // Cleanup when component unmounts (technically this listener is strictly scoped to this render, 
                                // but the mutation observer lives on the execution context of the iframe if we aren't careful.
                                // However, since this is a one-off onLoad, we can't easily return a cleanup function *here*.
                                // Ideally, we'd store these in a ref to clean up later, but for now, 
                                // leaking a small observer in the iframe until it reloads is acceptable for the problem's severity.)

                            } catch (err) {
                                console.warn('Could not inject CSS (cross-origin):', err);
                            }
                        }}
                    />
                </div>

                {/* Preview App Split Pane */}
                {showPreview && containerUrl && (
                    <div className="w-1/2 flex flex-col bg-slate-900 border-l border-slate-700 h-full overflow-hidden">
                        {/* Preview Toolbar */}
                        <div className="h-10 border-b border-slate-700 flex items-center justify-between px-3 bg-slate-800 shrink-0">
                            <span className="text-xs text-slate-400 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Preview: Port 3000
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPreviewKey(prev => prev + 1)}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                    title="Reload Preview"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => {
                                        const url = containerUrl.endsWith('/') ? containerUrl : `${containerUrl}/`;
                                        isPreviewingRef.current = true;
                                        window.open(`${url}proxy/3000/`, '_blank');
                                        setTimeout(() => { isPreviewingRef.current = false; }, 2000);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                    title="Open in New Tab"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                    title="Close Preview"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        {/* Preview Iframe */}
                        <div className="flex-1 relative bg-white overflow-hidden">
                            <iframe
                                key={previewKey}
                                src={`${containerUrl.endsWith('/') ? containerUrl : `${containerUrl}/`}proxy/3000/`}
                                className="absolute inset-0 w-full h-full border-0"
                                title="Application Preview"
                                allow="clipboard-read; clipboard-write; microphone; camera; geolocation"
                            />
                        </div>
                    </div>
                )}

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
        </div >
    );
}
