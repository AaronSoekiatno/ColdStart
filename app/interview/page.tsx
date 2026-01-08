'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

// Vapi client will be imported dynamically when needed

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InterviewStatus {
  sessionId: string | null;
  phase: string | null;
  status: 'idle' | 'starting' | 'connecting' | 'active' | 'ended' | 'error';
}

export default function InterviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>({
    sessionId: null,
    phase: null,
    status: 'idle',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vapiClientRef = useRef<any>(null);
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (vapiClientRef.current && interviewStatus.status === 'active') {
        try {
          vapiClientRef.current.stopCall('page_unmount');
        } catch (error) {
          console.error('Error stopping call on unmount:', error);
        }
      }
    };
  }, [interviewStatus.status]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/?signup=true&redirect=/interview');
        return;
      }
      setUser(currentUser);
      setIsLoading(false);
    };
    checkAuth();
  }, [router]);

  const startInterview = async () => {
    if (interviewStatus.status === 'starting' || interviewStatus.status === 'active') {
      return;
    }

    setInterviewStatus({ ...interviewStatus, status: 'starting' });
    setMessages([]);
    setCallDuration(0);

    try {
      // Start the interview session
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start interview');
      }

      const data = await response.json();
      setInterviewStatus({
        sessionId: data.sessionId,
        phase: data.phase?.id || data.phase || null,
        status: 'connecting',
      });

      // Import and initialize Vapi client (browser-only)
      if (typeof window !== 'undefined') {
        const vapiModule = await import('@/vapi-client.js');
        const vapiClient = vapiModule.default || vapiModule;
        vapiClientRef.current = vapiClient;
        
        // Ensure listeners are initialized
        if (vapiClient.initializeVapiListeners) {
          vapiClient.initializeVapiListeners();
        }

        // Set up Vapi event listeners and start the call
        if (vapiClient)

          // Listen for messages
          vapiClient.onEvent('onMessage', (message: any) => {
            if (message.type === 'transcript' && message.transcript) {
              const role = message.transcript.role;
              const content = message.transcript.text;
              if (role && content) {
                setMessages((prev) => [
                  ...prev,
                  { role, content, timestamp: new Date() },
                ]);
              }
            }
          });

          // Listen for call start
          vapiClient.onEvent('onCallStart', () => {
            setInterviewStatus((prev) => ({ ...prev, status: 'active' }));
            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
            toast({
              title: 'Call started',
              description: 'Minerva is now connected',
            });
          });

          // Listen for call end
          vapiClient.onEvent('onCallEnd', () => {
            setInterviewStatus((prev) => ({ ...prev, status: 'ended' }));
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }
            toast({
              title: 'Call ended',
              description: 'Interview session completed',
            });
          });

          // Manually start the Vapi call for KICK_OFF phase
          // The orchestrator doesn't start it client-side, so we need to do it here
          try {
            const candidateName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate';
            
            // Ensure Vapi client is ready
            if (!vapiClient.startPhaseCall) {
              console.error('[Interview] Vapi client missing startPhaseCall method');
              throw new Error('Vapi client not properly initialized');
            }
            
            const callResult = await vapiClient.startPhaseCall(
              data.sessionId,
              'KICK_OFF',
              'kickoff',
              [], // No previous messages
              null, // No overrides
              { candidateName } as any // Personalize with candidate name
            );
            console.log('[Interview] Vapi call started for session', data.sessionId, callResult);
            
            // The call should trigger onCallStart event which will update status to 'active'
            // Set a timeout to mark as active if event doesn't fire
            setTimeout(() => {
              setInterviewStatus((prev) => {
                if (prev.status === 'connecting') {
                  return { ...prev, status: 'active' };
                }
                return prev;
              });
            }, 3000);
          } catch (vapiError) {
            console.error('[Interview] Failed to start Vapi call:', vapiError);
            const errorMessage = vapiError instanceof Error ? vapiError.message : String(vapiError);
            
            // Check for common issues
            let userMessage = errorMessage;
            if (errorMessage.includes('NEXT_PUBLIC_VAPI_PUBLIC_KEY')) {
              userMessage = 'Vapi API key not configured. Please add NEXT_PUBLIC_VAPI_PUBLIC_KEY to your .env.local file and restart the dev server.';
            } else if (errorMessage.includes('constructor not found') || errorMessage.includes('module')) {
              userMessage = 'Failed to load Vapi SDK. Please check the browser console for details and ensure @vapi-ai/web is installed.';
            } else if (errorMessage.includes('Failed to import')) {
              userMessage = 'Failed to load Vapi SDK module. Please restart the dev server.';
            }
            
            toast({
              title: 'Failed to Start Voice Call',
              description: userMessage,
              variant: 'destructive',
            });
            // Mark as error instead of active
            setInterviewStatus((prev) => ({ ...prev, status: 'error' }));
          }
        }

      toast({
        title: 'Interview starting',
        description: 'Connecting to Minerva...',
      });
    } catch (error) {
      console.error('Error starting interview:', error);
      setInterviewStatus({ ...interviewStatus, status: 'error' });
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start interview',
        variant: 'destructive',
      });
    }
  };

  const endInterview = async () => {
    try {
      if (vapiClientRef.current) {
        // Check if call is active using the isCallActive function
        const isActive = vapiClientRef.current.isCallActive ? vapiClientRef.current.isCallActive() : false;
        if (isActive) {
          await vapiClientRef.current.stopCall('user_requested');
        }
      }
      
      // Always update status and clear timer, even if no active call
      setInterviewStatus((prev) => ({ ...prev, status: 'ended' }));
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      toast({
        title: 'Interview ended',
        description: 'Session has been terminated',
      });
    } catch (error) {
      console.error('Error ending interview:', error);
      // Still update status even if there's an error
      setInterviewStatus((prev) => ({ ...prev, status: 'ended' }));
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      toast({
        title: 'Interview ended',
        description: 'Session terminated (there may have been an issue stopping the call)',
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="flex-1 flex items-center justify-center px-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
        </section>
      </div>
    );
  }

  const isActive = interviewStatus.status === 'active' || interviewStatus.status === 'connecting';
  const canStart = interviewStatus.status === 'idle' || interviewStatus.status === 'ended' || interviewStatus.status === 'error';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0F172A' }}>
      <Header initialUser={user} />
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-4xl bg-gray-900 border-gray-800 text-white">
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">Interview with Minerva</h1>
                <p className="text-gray-400">
                  {interviewStatus.phase ? `Phase: ${interviewStatus.phase}` : 'Technical Assessment Interview'}
                </p>
              </div>
              {isActive && (
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold">{formatDuration(callDuration)}</div>
                  <div className="text-xs text-gray-400">Call Duration</div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-6 space-y-6">
            {/* Agent Video/Audio Area (Zoom-style) */}
            <div className="relative bg-gray-800 rounded-lg aspect-video flex items-center justify-center overflow-hidden">
              {interviewStatus.status === 'connecting' ? (
                <div className="text-center">
                  <Loader2 className="h-16 w-16 animate-spin text-blue-400 mx-auto mb-4" />
                  <p className="text-gray-400">Connecting to Minerva...</p>
                </div>
              ) : interviewStatus.status === 'active' ? (
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Volume2 className="h-16 w-16 text-white" />
                  </div>
                  <p className="text-gray-300 font-medium">Minerva is speaking...</p>
                  <p className="text-sm text-gray-500 mt-2">Listen carefully and respond naturally</p>
                </div>
              ) : interviewStatus.status === 'ended' ? (
                <div className="text-center">
                  <PhoneOff className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Call ended</p>
                </div>
              ) : (
                <div className="text-center">
                  <Phone className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Ready to start interview</p>
                </div>
              )}
            </div>

            {/* Conversation Transcript */}
            <div className="bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Conversation</h3>
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No messages yet. Start the interview to begin...</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'assistant'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        <div className="text-xs font-semibold mb-1 opacity-75">
                          {msg.role === 'assistant' ? 'Minerva' : 'You'}
                        </div>
                        <div className="text-sm">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {canStart ? (
                <Button
                  onClick={startInterview}
                  disabled={interviewStatus.status === 'starting' || interviewStatus.status === 'connecting'}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg disabled:opacity-50"
                >
                  {interviewStatus.status === 'starting' || interviewStatus.status === 'connecting' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-5 w-5" />
                      Start Interview
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setIsMuted(!isMuted)}
                    variant="outline"
                    className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                    disabled={interviewStatus.status === 'ended' || interviewStatus.status === 'error'}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="mr-2 h-5 w-5" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Mute
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={endInterview}
                    disabled={interviewStatus.status === 'ended'}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 disabled:opacity-50"
                  >
                    <PhoneOff className="mr-2 h-5 w-5" />
                    End Interview
                  </Button>
                </>
              )}
              
              {/* Debug info */}
              {interviewStatus.status === 'error' && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-200">
                  <p className="font-semibold">Error: Failed to start voice call</p>
                  <p className="mt-1">Please check:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                    <li>Browser microphone permissions are granted</li>
                    <li>NEXT_PUBLIC_VAPI_PUBLIC_KEY is set in environment variables</li>
                    <li>VAPI_ASSISTANT_ID is configured correctly</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

