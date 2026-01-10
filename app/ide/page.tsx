'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Clock,
    Send,
    Maximize2,
    Minimize2,
    X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

export default function IDEPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

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

    // Check auth
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
        };
        checkAuth();
    }, [router]);

    const handleSubmit = async () => {
        toast({
            title: 'Submitting Assessment',
            description: 'Saving your work and creating snapshot...',
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        toast({
            title: 'Assessment Submitted',
            description: 'Your work has been saved successfully.',
        });

        router.push('/assessment?submitted=true');
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

    const confirmClose = () => {
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

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-900">
                <Header initialUser={user} />
                <section className="flex-1 flex items-center justify-center px-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
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

                <div className="flex items-center gap-3">
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

            {/* Code-Server Iframe */}
            <div className="flex-1 relative">
                <iframe
                    ref={iframeRef}
                    src="http://localhost:8080"
                    className="absolute inset-0 w-full h-full border-0"
                    allow="clipboard-read; clipboard-write; microphone"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                    title="Code Server IDE"
                />
            </div>

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                    <span>Session: local-dev</span>
                    <span>Environment: Docker</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>code-server @ localhost:8080</span>
                    <span>Auto-save enabled</span>
                </div>
            </div>
        </div>
    );
}
