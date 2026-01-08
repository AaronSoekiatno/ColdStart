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
  const vapiEventCallbacksRef = useRef<{
    onMessage?: (message: any) => void;
    onCallStart?: () => void;
    onCallEnd?: (callData: any) => void;
    onError?: (error: any) => void;
  }>({});
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Register Vapi event callbacks once when component mounts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupCallbacks = async () => {
      const vapiModule = await import('@/vapi-client.js');
      const vapiClient = vapiModule.default || vapiModule;
      vapiClientRef.current = vapiClient;

      // Ensure listeners are initialized
      if (vapiClient.initializeVapiListeners) {
        await vapiClient.initializeVapiListeners();
      }

      if (!vapiClient || !vapiClient.onEvent) return;

      // Remove old callbacks if they exist
      if (vapiEventCallbacksRef.current.onMessage && vapiClient.offEvent) {
        vapiClient.offEvent('onMessage', vapiEventCallbacksRef.current.onMessage);
      }

      // Register message callback
      const messageCallback = (message: any) => {
        console.log('[Interview] ✅ MESSAGE CALLBACK FIRED!', message);
        console.log('[Interview] Message type:', message?.type);
        
        if (message.type === 'transcript' && message.role && message.transcript) {
          console.log('[Interview] Processing transcript message:', { role: message.role, content: message.transcript });
          const role = message.role;
          const content = message.transcript;
          const isPartial = message.transcriptType === 'partial';
          
          if (role && content) {
            console.log('[Interview] Adding message to UI:', { role, content, isPartial });
            setMessages((prev) => {
              // For partial transcripts, update the last message if it's from the same role
              if (isPartial) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === role) {
                  // Update the last message with new partial content
                  const updated = [...prev];
                  updated[updated.length - 1] = { role, content, timestamp: new Date() };
                  return updated;
                } else {
                  // No matching last message, add new one
                  return [...prev, { role, content, timestamp: new Date() }];
                }
              } else {
                // For final transcripts, always check if we need to update or add
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === role && lastMessage.content !== content) {
                  // Replace the last partial with the final version
                  const updated = [...prev];
                  updated[updated.length - 1] = { role, content, timestamp: new Date() };
                  return updated;
                } else if (!lastMessage || lastMessage.role !== role || lastMessage.content !== content) {
                  // Add new final message only if it's different
                  return [...prev, { role, content, timestamp: new Date() }];
                }
                // If it's the same as the last message, don't add duplicate
                return prev;
              }
            });
          }
        }
      };

      vapiEventCallbacksRef.current.onMessage = messageCallback;
      console.log('[Interview] About to register message callback...', {
        callbackType: typeof messageCallback,
        callbackName: messageCallback.name || 'anonymous',
        vapiClientExists: !!vapiClient,
        onEventExists: typeof vapiClient.onEvent,
        refStored: !!vapiEventCallbacksRef.current.onMessage
      });
      
      // Check callback status before registering
      if (vapiClient.getCallbackStatus) {
        console.log('[Interview] Callback status BEFORE registration:');
        vapiClient.getCallbackStatus();
      }
      
      vapiClient.onEvent('onMessage', messageCallback);
      console.log('[Interview] ✅ Message callback registered in useEffect');
      
      // Check callback status after registering
      if (vapiClient.getCallbackStatus) {
        console.log('[Interview] Callback status AFTER registration:');
        vapiClient.getCallbackStatus();
      }
      
      // Test the callback directly after a short delay to verify it works
      setTimeout(() => {
        console.log('[Interview] Testing callback directly after 2 seconds...');
        if (vapiEventCallbacksRef.current.onMessage) {
          try {
            vapiEventCallbacksRef.current.onMessage({
              type: 'transcript',
              role: 'assistant',
              transcriptType: 'final',
              transcript: 'Test message from direct callback invocation'
            });
            console.log('[Interview] ✅ Direct callback test completed');
          } catch (error) {
            console.error('[Interview] ❌ Direct callback test failed:', error);
          }
        } else {
          console.warn('[Interview] ⚠️ Callback not found in ref for direct test');
        }
      }, 2000);

      // Register other callbacks
      if (!vapiEventCallbacksRef.current.onCallStart) {
        const callStartCallback = () => {
          setInterviewStatus((prev) => ({ ...prev, status: 'active' }));
          durationIntervalRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
          toast({ title: 'Call started', description: 'Minerva is now connected' });
        };
        vapiEventCallbacksRef.current.onCallStart = callStartCallback;
        vapiClient.onEvent('onCallStart', callStartCallback);
      }

      if (!vapiEventCallbacksRef.current.onCallEnd) {
        const callEndCallback = (callData: any) => {
          console.log('[Interview] Call ended event received:', callData);
          setInterviewStatus((prev) => ({ ...prev, status: 'ended' }));
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }
          toast({ title: 'Call ended', description: 'Interview session completed' });
          
          // Send messages to server for storage
          if (callData?.sessionId && callData?.phaseId && callData?.messages) {
            console.log(`[Interview] Sending ${callData.messages.length} messages to server for storage...`);
            fetch('/api/vapi/call-end', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: callData.sessionId,
                phaseId: callData.phaseId,
                callId: callData.callId,
                duration: callData.duration,
                messages: callData.messages
              })
            })
            .then(response => response.json())
            .then(data => {
              console.log('[Interview] Messages stored successfully:', data);
            })
            .catch(error => {
              console.error('[Interview] Failed to store messages:', error);
            });
          } else {
            console.warn('[Interview] Missing data in callData:', callData);
          }
        };
        vapiEventCallbacksRef.current.onCallEnd = callEndCallback;
        vapiClient.onEvent('onCallEnd', callEndCallback);
      }

      if (!vapiEventCallbacksRef.current.onError) {
        const errorCallback = (error: any) => {
          console.error('[Interview] VAPI ERROR:', error);
          toast({ title: 'Call Error', description: error?.message || 'An error occurred', variant: 'destructive' });
          setInterviewStatus((prev) => ({ ...prev, status: 'error' }));
        };
        vapiEventCallbacksRef.current.onError = errorCallback;
        vapiClient.onEvent('onError', errorCallback);
      }
    };

    setupCallbacks();

    // Cleanup
    return () => {
      if (vapiClientRef.current && vapiClientRef.current.offEvent) {
        if (vapiEventCallbacksRef.current.onMessage) {
          vapiClientRef.current.offEvent('onMessage', vapiEventCallbacksRef.current.onMessage);
        }
      }
    };
  }, []); // Run once on mount

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
      // Remove event listeners on unmount
      if (vapiClientRef.current && vapiClientRef.current.offEvent) {
        if (vapiEventCallbacksRef.current.onMessage) {
          vapiClientRef.current.offEvent('onMessage', vapiEventCallbacksRef.current.onMessage);
        }
        if (vapiEventCallbacksRef.current.onCallStart) {
          vapiClientRef.current.offEvent('onCallStart', vapiEventCallbacksRef.current.onCallStart);
        }
        if (vapiEventCallbacksRef.current.onCallEnd) {
          vapiClientRef.current.offEvent('onCallEnd', vapiEventCallbacksRef.current.onCallEnd);
        }
        if (vapiEventCallbacksRef.current.onError) {
          vapiClientRef.current.offEvent('onError', vapiEventCallbacksRef.current.onError);
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
        
        // Listeners are auto-initialized on module load, but ensure they're ready
        // initializeVapiListeners() is idempotent - it won't register duplicates
        if (vapiClient.initializeVapiListeners) {
          await vapiClient.initializeVapiListeners();
        }

        // CRITICAL FIX: Always create fresh callbacks with the CURRENT module instance
        // This ensures callbacks are in the correct eventCallbacks array that the listeners use
        console.log('[Interview] Setting up callbacks with current module instance...');
        
        if (!vapiClient) {
          console.error('[Interview] vapiClient is null/undefined');
          throw new Error('Vapi client not available');
        }
        
        if (typeof vapiClient.onEvent !== 'function') {
          console.error('[Interview] vapiClient.onEvent is not a function:', typeof vapiClient.onEvent);
          throw new Error('Vapi client onEvent method not available');
        }

        // Check current callback status
        if (vapiClient.getCallbackStatus) {
          console.log('[Interview] Callback status BEFORE registration:');
          vapiClient.getCallbackStatus();
        }

        // CRITICAL: Always register message callback - don't remove old ones to avoid losing callbacks
        // Create and register message callback
        console.log('[Interview] Creating NEW message callback...');
        
        // Remove old callback from ref if it exists (but don't call offEvent - might not work by reference)
        // We'll rely on the callback function itself being the same reference
        if (vapiEventCallbacksRef.current.onMessage && vapiClient.offEvent) {
          console.log('[Interview] Attempting to remove old message callback...');
          try {
            vapiClient.offEvent('onMessage', vapiEventCallbacksRef.current.onMessage);
          } catch (err) {
            console.warn('[Interview] Could not remove old callback (might not exist):', err);
          }
        }
        
        const messageCallback = (message: any) => {
          console.log('[Interview] ✅ MESSAGE CALLBACK FIRED!', message);
          
          if (message.type === 'transcript' && message.role && message.transcript) {
            const role = message.role;
            const content = message.transcript;
            const isPartial = message.transcriptType === 'partial';
            
            if (role && content) {
              setMessages((prev) => {
                // For partial transcripts, update the last message if it's from the same role
                if (isPartial) {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.role === role) {
                    // Update the last message with new partial content
                    const updated = [...prev];
                    updated[updated.length - 1] = { role, content, timestamp: new Date() };
                    return updated;
                  } else {
                    // No matching last message, add new one
                    return [...prev, { role, content, timestamp: new Date() }];
                  }
                } else {
                  // For final transcripts, always check if we need to update or add
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.role === role && lastMessage.content !== content) {
                    // Replace the last partial with the final version
                    const updated = [...prev];
                    updated[updated.length - 1] = { role, content, timestamp: new Date() };
                    return updated;
                  } else if (!lastMessage || lastMessage.role !== role || lastMessage.content !== content) {
                    // Add new final message only if it's different
                    return [...prev, { role, content, timestamp: new Date() }];
                  }
                  // If it's the same as the last message, don't add duplicate
                  return prev;
                }
              });
            }
          }
        };
        
        // Store callback in ref before registering
        vapiEventCallbacksRef.current.onMessage = messageCallback;
        
        console.log('[Interview] About to register message callback via onEvent...');
        console.log('[Interview] vapiClient.onEvent type:', typeof vapiClient.onEvent);
        
        // Verify onEvent exists and is a function
        if (typeof vapiClient.onEvent !== 'function') {
          console.error('[Interview] ❌ vapiClient.onEvent is not a function!', vapiClient);
          throw new Error('vapiClient.onEvent is not available');
        }
        
        // Register the callback
        vapiClient.onEvent('onMessage', messageCallback);
        console.log('[Interview] ✅ Message callback registered!');
        
        // Verify registration immediately with detailed logging
        if (vapiClient.getCallbackStatus) {
          const status = vapiClient.getCallbackStatus();
          console.log('[Interview] Callback status AFTER registration:', status);
          if (status.onMessage === 0) {
            console.error('[Interview] ❌ CRITICAL: Callback registration failed! No callbacks in array after registration!');
            // Try to register again directly using the window singleton
            if (typeof window !== 'undefined' && (window as any).__VAPI_EVENT_CALLBACKS__) {
              console.log('[Interview] Attempting direct registration via window singleton...');
              (window as any).__VAPI_EVENT_CALLBACKS__.onMessage.push(messageCallback);
              const newStatus = vapiClient.getCallbackStatus();
              console.log('[Interview] After direct registration:', newStatus);
            }
          }
        }

        // Create and register other callbacks
        if (!vapiEventCallbacksRef.current.onCallStart) {
          const callStartCallback = () => {
            setInterviewStatus((prev) => ({ ...prev, status: 'active' }));
            durationIntervalRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
            toast({ title: 'Call started', description: 'Minerva is now connected' });
          };
          vapiEventCallbacksRef.current.onCallStart = callStartCallback;
          vapiClient.onEvent('onCallStart', callStartCallback);
        }

        if (!vapiEventCallbacksRef.current.onCallEnd) {
          const callEndCallback = (callData: any) => {
            console.log('[Interview] Call ended with data:', callData);
            
            // Update UI
            setInterviewStatus((prev) => ({ ...prev, status: 'ended' }));
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }
            toast({ title: 'Call ended', description: 'Interview session completed' });
            
            // CRITICAL: Send messages to server for storage
            if (callData?.sessionId && callData?.phaseId && callData?.messages) {
              console.log(`[Interview] Sending ${callData.messages.length} messages to server for storage...`);
              fetch('/api/vapi/call-end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: callData.sessionId,
                  phaseId: callData.phaseId,
                  callId: callData.callId,
                  duration: callData.duration,
                  messages: callData.messages
                })
              })
              .then(response => response.json())
              .then(data => {
                console.log('[Interview] Messages stored successfully:', data);
              })
              .catch(error => {
                console.error('[Interview] Failed to store messages:', error);
              });
            } else {
              console.warn('[Interview] Missing data in callData:', callData);
            }
          };
          vapiEventCallbacksRef.current.onCallEnd = callEndCallback;
          vapiClient.onEvent('onCallEnd', callEndCallback);
        }

        if (!vapiEventCallbacksRef.current.onError) {
          const errorCallback = (error: any) => {
            console.error('[Interview] VAPI ERROR:', error);
            toast({ title: 'Call Error', description: error?.message || 'An error occurred', variant: 'destructive' });
            setInterviewStatus((prev) => ({ ...prev, status: 'error' }));
          };
          vapiEventCallbacksRef.current.onError = errorCallback;
          vapiClient.onEvent('onError', errorCallback);
        }
        
        // Final verification before starting call
        if (vapiClient.getCallbackStatus) {
          console.log('[Interview] Final callback status before starting call:');
          vapiClient.getCallbackStatus();
        }

        // Now start the call
        if (vapiClient) {
          // Manually start the Vapi call for KICK_OFF phase
          // The orchestrator doesn't start it client-side, so we need to do it here
          try {
            const candidateName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate';
            
            // Ensure Vapi client is ready
            if (!vapiClient.startPhaseCall) {
              console.error('[Interview] Vapi client missing startPhaseCall method');
              throw new Error('Vapi client not properly initialized');
            }
            
            // Request microphone permission explicitly before starting call
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              // Immediately stop the stream - we just needed permission
              stream.getTracks().forEach(track => track.stop());
              console.log('[Interview] Microphone permission granted');
            } catch (permError) {
              console.error('[Interview] Microphone permission denied:', permError);
              toast({
                title: 'Microphone Permission Required',
                description: 'Please allow microphone access to start the interview.',
                variant: 'destructive',
              });
              setInterviewStatus((prev) => ({ ...prev, status: 'error' }));
              return;
            }
            
            // CRITICAL: Verify callbacks are registered before starting call
            // If none exist, register an emergency callback to prevent message loss
            if (vapiClient.getCallbackStatus) {
              const status = vapiClient.getCallbackStatus();
              console.log('[Interview] Callback status RIGHT BEFORE starting call:', status);
              if (status.onMessage === 0) {
                console.error('[Interview] ⚠️ CRITICAL: No message callbacks registered! Registering emergency callback...');
                // Register emergency callback to prevent message loss
                // Use the same callback function we registered earlier if it exists in ref
                if (vapiEventCallbacksRef.current.onMessage) {
                  console.log('[Interview] Re-registering callback from ref...');
                  vapiClient.onEvent('onMessage', vapiEventCallbacksRef.current.onMessage);
                  const newStatus = vapiClient.getCallbackStatus();
                  console.log('[Interview] After emergency registration:', newStatus);
                } else {
                  // Last resort: create a new emergency callback
                  console.log('[Interview] Creating new emergency callback...');
                  const emergencyCallback = (message: any) => {
                    console.log('[Interview] ✅ EMERGENCY CALLBACK FIRED!', message);
                    if (message.type === 'transcript' && message.role && message.transcript) {
                      const role = message.role;
                      const content = message.transcript;
                      const isPartial = message.transcriptType === 'partial';
                      
                      if (role && content) {
                        setMessages((prev) => {
                          if (isPartial) {
                            const lastMessage = prev[prev.length - 1];
                            if (lastMessage && lastMessage.role === role) {
                              const updated = [...prev];
                              updated[updated.length - 1] = { role, content, timestamp: new Date() };
                              return updated;
                            } else {
                              return [...prev, { role, content, timestamp: new Date() }];
                            }
                          } else {
                            const lastMessage = prev[prev.length - 1];
                            if (lastMessage && lastMessage.role === role && lastMessage.content !== content) {
                              const updated = [...prev];
                              updated[updated.length - 1] = { role, content, timestamp: new Date() };
                              return updated;
                            } else if (!lastMessage || lastMessage.role !== role || lastMessage.content !== content) {
                              return [...prev, { role, content, timestamp: new Date() }];
                            }
                            return prev;
                          }
                        });
                      }
                    }
                  };
                  vapiEventCallbacksRef.current.onMessage = emergencyCallback;
                  vapiClient.onEvent('onMessage', emergencyCallback);
                  const newStatus = vapiClient.getCallbackStatus();
                  console.log('[Interview] Emergency callback registered:', newStatus);
                }
              }
            }

            console.log('[Interview] Starting Vapi call with:', {
              sessionId: data.sessionId,
              phase: 'KICK_OFF',
              assistantType: 'kickoff',
              candidateName
            });
            
            const callResult = await vapiClient.startPhaseCall(
              data.sessionId,
              'KICK_OFF',
              'kickoff',
              [], // No previous messages
              null, // No overrides
              { candidateName } as any // Personalize with candidate name
            );
            console.log('[Interview] Vapi call started successfully:', callResult);
            
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
            } else if (errorMessage.includes('permission') || errorMessage.includes('microphone')) {
              userMessage = 'Microphone permission is required. Please allow microphone access and try again.';
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

