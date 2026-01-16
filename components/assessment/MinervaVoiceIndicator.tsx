'use client';

import { useEffect, useState } from 'react';
import { Volume2, Mic, Phone, Loader2, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MinervaVoiceIndicatorProps {
    className?: string;
}

export function MinervaVoiceIndicator({ className }: MinervaVoiceIndicatorProps) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let vapiClient: any = null;
        let speechStartCallback: (() => void) | null = null;
        let speechEndCallback: (() => void) | null = null;
        let callStartCallback: (() => void) | null = null;
        let callEndCallback: (() => void) | null = null;
        let statusCheckInterval: NodeJS.Timeout | null = null;

        const setupVapiListeners = async () => {
            try {
                // Dynamically import Vapi client
                const vapiModule = await import('@/vapi-client.js');
                vapiClient = vapiModule.default || vapiModule;

                // Initialize listeners if needed
                if (vapiClient.initializeVapiListeners) {
                    await vapiClient.initializeVapiListeners();
                }

                // Register speech start callback
                speechStartCallback = () => {
                    setIsSpeaking(true);
                };

                // Register speech end callback
                speechEndCallback = () => {
                    setIsSpeaking(false);
                };

                // Register call start callback
                callStartCallback = () => {
                    setIsCallActive(true);
                };

                // Register call end callback
                callEndCallback = () => {
                    setIsCallActive(false);
                    setIsSpeaking(false);
                };

                // Register all callbacks
                if (vapiClient.onEvent) {
                    vapiClient.onEvent('onSpeechStart', speechStartCallback);
                    vapiClient.onEvent('onSpeechEnd', speechEndCallback);
                    vapiClient.onEvent('onCallStart', callStartCallback);
                    vapiClient.onEvent('onCallEnd', callEndCallback);

                    // Check current call status
                    if (vapiClient.isCallActive && vapiClient.isCallActive()) {
                        setIsCallActive(true);
                    }

                    // Poll for call status periodically (in case component mounts after call starts)
                    statusCheckInterval = setInterval(() => {
                        if (vapiClient.isCallActive && vapiClient.isCallActive()) {
                            setIsCallActive(true);
                        } else {
                            setIsCallActive(false);
                            setIsSpeaking(false);
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error('[MinervaVoiceIndicator] Failed to setup Vapi listeners:', error);
            }
        };

        setupVapiListeners();

        // Cleanup
        return () => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            if (vapiClient && vapiClient.offEvent) {
                if (speechStartCallback) {
                    vapiClient.offEvent('onSpeechStart', speechStartCallback);
                }
                if (speechEndCallback) {
                    vapiClient.offEvent('onSpeechEnd', speechEndCallback);
                }
                if (callStartCallback) {
                    vapiClient.offEvent('onCallStart', callStartCallback);
                }
                if (callEndCallback) {
                    vapiClient.offEvent('onCallEnd', callEndCallback);
                }
            }
        };
    }, []);

    const startInterview = async () => {
        if (isStarting || isCallActive) return;

        setIsStarting(true);
        try {
            // Get current session ID from Supabase (should already exist if on IDE page)
            const { supabase } = await import('@/lib/supabase');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Not authenticated');
            }

            // Get candidate's latest session
            const { data: candidate } = await supabase
                .from('candidates')
                .select('id')
                .eq('email', user.email)
                .single();

            if (!candidate) {
                throw new Error('Candidate not found');
            }

            const { data: session } = await supabase
                .from('interview_sessions')
                .select('session_id')
                .eq('candidate_id', candidate.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!session) {
                throw new Error('No active session found. Please start an assessment first.');
            }

            // Import and initialize Vapi client
            if (typeof window !== 'undefined') {
                const vapiModule = await import('@/vapi-client.js');
                const vapiClient = vapiModule.default || vapiModule;

                // Initialize listeners if needed
                if (vapiClient.initializeVapiListeners) {
                    await vapiClient.initializeVapiListeners();
                }

                const candidateName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate';

                // Request microphone permission
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    stream.getTracks().forEach(track => track.stop());
                } catch (permError) {
                    toast({
                        title: 'Microphone Permission Required',
                        description: 'Please allow microphone access to start the interview.',
                        variant: 'destructive',
                    });
                    setIsStarting(false);
                    return;
                }

                // Start the Vapi call with existing session
                if (vapiClient.startPhaseCall) {
                    await vapiClient.startPhaseCall(
                        session.session_id,
                        'KICK_OFF',
                        'kickoff',
                        []
                    );
                    setIsCallActive(true);
                    toast({
                        title: 'Interview started',
                        description: 'Minerva is connecting...',
                    });
                }
            }

            // Note: We're already on the IDE page, so no navigation needed
            // The IDE page will automatically detect the session and load the container
        } catch (error) {
            console.error('[MinervaVoiceIndicator] Failed to start interview:', error);
            toast({
                title: 'Failed to Start Interview',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
            setIsCallActive(false);
        } finally {
            setIsStarting(false);
        }
    };

    const endInterview = async () => {
        if (isEnding || !isCallActive) return;

        setIsEnding(true);
        try {
            // Import Vapi client
            const vapiModule = await import('@/vapi-client.js');
            const vapiClient = vapiModule.default || vapiModule;

            // Stop the call if active
            if (vapiClient.isCallActive && vapiClient.isCallActive()) {
                if (vapiClient.stopCall) {
                    await vapiClient.stopCall('user_requested');
                }
            }

            setIsCallActive(false);
            setIsSpeaking(false);

            toast({
                title: 'Interview ended',
                description: 'Minerva call has been terminated',
            });
        } catch (error) {
            console.error('[MinervaVoiceIndicator] Failed to end interview:', error);
            toast({
                title: 'Error',
                description: 'Failed to end interview. Please try again.',
                variant: 'destructive',
            });
            // Still update state even if there's an error
            setIsCallActive(false);
            setIsSpeaking(false);
        } finally {
            setIsEnding(false);
        }
    };

    // Don't show anything when no call is active (auto-start handles this)
    if (!isCallActive) {
        return null;
    }

    // Only show the speaking/listening indicator (no end button)
    return (
        <div
            className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md border transition-all duration-300',
                isSpeaking
                    ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-700/50 border-slate-600/50',
                className
            )}
        >
            <div className="relative">
                {isSpeaking ? (
                    <Volume2
                        className={cn(
                            'h-4 w-4 transition-colors duration-300',
                            isSpeaking ? 'text-blue-400' : 'text-slate-400'
                        )}
                    />
                ) : (
                    <Mic
                        className={cn(
                            'h-4 w-4 transition-colors duration-300',
                            'text-slate-400'
                        )}
                    />
                )}
                {isSpeaking && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute w-6 h-6 rounded-full bg-blue-400/30 animate-ping" />
                        <div className="absolute w-4 h-4 rounded-full bg-blue-400/50 animate-pulse" />
                    </div>
                )}
            </div>
            <span
                className={cn(
                    'text-xs font-medium transition-colors duration-300',
                    isSpeaking ? 'text-blue-300' : 'text-slate-300'
                )}
            >
                {isSpeaking ? 'Minerva Speaking' : 'Minerva Active'}
            </span>
        </div>
    );
}
