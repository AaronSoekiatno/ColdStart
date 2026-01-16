/**
 * Vapi Client - Phase-Aware Voice Agent Controller
 * 
 * Manages Vapi voice calls with phase-specific assistants,
 * automatic start/stop based on interview phases, and cost tracking.
 * 
 * NOTE: This file must only be imported on the client-side.
 * Use dynamic imports in client components.
 */

// Conditionally import Vapi or use a mock for Server-Side Rendering
let Vapi;
let vapi;
let vapiInitialized = false;
let vapiInitPromise = null;

// Initialize Vapi client (lazy initialization for browser)
async function initializeVapi() {
    if (vapiInitialized) return vapi;
    if (vapiInitPromise) return vapiInitPromise;

    if (typeof window === 'undefined') {
        // Server-side mock
        vapi = {
            on: () => { },
            start: async () => console.log('Mock Vapi start'),
            stop: async () => console.log('Mock Vapi stop'),
            send: () => { },
            getCallStatus: () => ({ status: 'idle' })
        };
        vapiInitialized = true;
        return vapi;
    }

    // Browser-side: use dynamic import
    // The package uses CommonJS exports.default = Vapi
    vapiInitPromise = (async () => {
        try {
            // Standard dynamic import
            const VapiModule = await import("@vapi-ai/web");
            console.log('[Vapi] Import successful');

            if (!VapiModule) {
                throw new Error('Vapi module import returned null or undefined');
            }

            console.log('[Vapi] Module object type:', typeof VapiModule);
            console.log('[Vapi] Module keys:', Object.keys(VapiModule));
            if (VapiModule.default !== undefined) {
                console.log('[Vapi] Module.default type:', typeof VapiModule.default);
                console.log('[Vapi] Module.default:', VapiModule.default);
            }

            // Extract the Vapi constructor
            let VapiConstructor = null;

            // The package exports: export default class Vapi
            // Check default export first
            if (VapiModule.default !== undefined) {
                if (typeof VapiModule.default === 'function') {
                    VapiConstructor = VapiModule.default;
                    console.log('[Vapi] Found constructor in module.default (function)');
                } else if (VapiModule.default && typeof VapiModule.default === 'object') {
                    // Check if it's a wrapped object
                    if (VapiModule.default.default && typeof VapiModule.default.default === 'function') {
                        VapiConstructor = VapiModule.default.default;
                        console.log('[Vapi] Found constructor in module.default.default');
                    } else if (VapiModule.default.Vapi && typeof VapiModule.default.Vapi === 'function') {
                        VapiConstructor = VapiModule.default.Vapi;
                        console.log('[Vapi] Found constructor in module.default.Vapi');
                    }
                }
            }

            // Check named export
            if (!VapiConstructor && VapiModule.Vapi && typeof VapiModule.Vapi === 'function') {
                VapiConstructor = VapiModule.Vapi;
                console.log('[Vapi] Found constructor in module.Vapi');
            }

            // Last resort: module itself
            if (!VapiConstructor && typeof VapiModule === 'function') {
                VapiConstructor = VapiModule;
                console.log('[Vapi] Found constructor as module itself');
            }

            if (!VapiConstructor || typeof VapiConstructor !== 'function') {
                const debugInfo = {
                    moduleKeys: Object.keys(VapiModule),
                    hasDefault: 'default' in VapiModule,
                    defaultType: typeof VapiModule?.default,
                    defaultValue: VapiModule?.default?.toString?.()?.substring(0, 100) || String(VapiModule?.default),
                    hasVapi: 'Vapi' in VapiModule,
                    moduleType: typeof VapiModule,
                    moduleConstructor: VapiModule?.constructor?.name
                };
                console.error('[Vapi] Constructor not found. Full debug info:', debugInfo);
                console.error('[Vapi] Full module dump:', VapiModule);
                throw new Error(`Vapi constructor not found. Module has keys: ${Object.keys(VapiModule).join(', ')}. Default type: ${typeof VapiModule?.default}`);
            }

            Vapi = VapiConstructor;
            console.log('[Vapi] Using Vapi constructor:', Vapi.name || 'Anonymous', 'Type:', typeof Vapi);

            const apiKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '';
            if (!apiKey) {
                throw new Error('NEXT_PUBLIC_VAPI_PUBLIC_KEY environment variable is required. Please check your .env.local file.');
            }

            console.log('[Vapi] Initializing Vapi with API key (first 10 chars):', apiKey.substring(0, 10) + '...');
            vapi = new Vapi(apiKey);
            vapiInitialized = true;
            console.log('[Vapi] Vapi client initialized successfully');
            return vapi;
        } catch (error) {
            console.error('[Vapi] ========== VAPI SDK INITIALIZATION FAILED ==========');
            console.error('[Vapi] Error name:', error.name);
            console.error('[Vapi] Error message:', error.message);
            console.error('[Vapi] Error stack:', error.stack);
            console.error('[Vapi] =====================================================');

            // Provide helpful error message
            const helpfulMessage = error.message || 'Unknown error';
            let finalError;

            if (helpfulMessage.includes('NEXT_PUBLIC_VAPI_PUBLIC_KEY')) {
                finalError = new Error('Vapi SDK requires NEXT_PUBLIC_VAPI_PUBLIC_KEY environment variable. Please add it to your .env.local file and restart the dev server.');
            } else if (helpfulMessage.includes('import') || helpfulMessage.includes('module') || helpfulMessage.includes('constructor not found')) {
                finalError = new Error(`Failed to load Vapi SDK module. This might be a bundling issue. Please check: 1) @vapi-ai/web is installed (run: npm install @vapi-ai/web), 2) Restart your dev server, 3) Check browser console for detailed error. Original error: ${helpfulMessage}`);
            } else {
                finalError = new Error(`Vapi SDK initialization failed: ${helpfulMessage}. Please check the browser console for details.`);
            }

            throw finalError;
        }
    })();

    return vapiInitPromise;
}

// Initialize immediately for server-side
if (typeof window === 'undefined') {
    initializeVapi();
} else {
    // For browser, initialize asynchronously but create placeholder
    // vapi will be set when initializeVapi() completes
    vapi = {
        on: () => { console.warn('[Vapi] Vapi not initialized yet - call initializeVapi() first'); },
        start: async (...args) => {
            const initializedVapi = await initializeVapi();
            return initializedVapi.start(...args);
        },
        stop: async (...args) => {
            const initializedVapi = await initializeVapi();
            return initializedVapi.stop(...args);
        },
        send: () => { console.warn('[Vapi] Vapi not initialized yet'); },
        getCallStatus: () => ({ status: 'idle' })
    };
}

// Assistant ID (single assistant for all phases, loaded from environment)
// Note: In browser context, must use NEXT_PUBLIC_ prefix or pass from server
const VAPI_KICKOFF_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID || 'vapi-assistant-placeholder';
const VAPI_REFLECTION_ID = process.env.NEXT_PUBLIC_VAPI_REFLECTION_ASSISTANT_ID || '9c68493e-6e1d-444b-a66d-f0069df8f782';

// Assistant IDs mapping - kickoff and reflection use separate assistants
const ASSISTANT_IDS = {
    kickoff: VAPI_KICKOFF_ID,
    reflection: VAPI_REFLECTION_ID
};

// Track active call state
let activeCall = {
    callId: null,
    sessionId: null,
    phaseId: null,
    assistantType: null,
    startTime: null,
    status: 'idle', // idle, connecting, active, ending
    messageBuffer: [] // Collect messages during the call
};

// Track if listeners have been initialized to prevent duplicates
let listenersInitialized = false;

// Event callbacks - Use a global/window-level storage to ensure single instance across module reloads
// This prevents issues with Next.js module hot-reloading creating multiple instances
let eventCallbacks;
if (typeof window !== 'undefined') {
    // Use window-level storage to persist across module reloads
    if (!window.__VAPI_EVENT_CALLBACKS__) {
        window.__VAPI_EVENT_CALLBACKS__ = {
            onCallStart: [],
            onCallEnd: [],
            onSpeechStart: [],
            onSpeechEnd: [],
            onMessage: [],
            onError: []
        };
    }
    eventCallbacks = window.__VAPI_EVENT_CALLBACKS__;
} else {
    // Server-side: use module-level storage
    eventCallbacks = {
        onCallStart: [],
        onCallEnd: [],
        onSpeechStart: [],
        onSpeechEnd: [],
        onMessage: [],
        onError: []
    };
}

/**
 * Initialize Vapi event listeners
 */
export async function initializeVapiListeners() {
    if (typeof window === 'undefined') return;

    // Prevent duplicate listener registration
    if (listenersInitialized) {
        console.log('[Vapi] Listeners already initialized, skipping duplicate registration');
        return;
    }

    const initializedVapi = await initializeVapi();

    // Mark as initialized BEFORE registering listeners to prevent race conditions
    listenersInitialized = true;

    initializedVapi.on("call-start", async () => {
        activeCall.status = 'active';
        activeCall.startTime = Date.now();
        activeCall.messageBuffer = []; // Reset message buffer for new call
        console.log(`[Vapi] Call started for phase ${activeCall.phaseId}`);

        // Record call start in session via API (client-side can't directly access server modules)
        if (activeCall.sessionId) {
            try {
                await fetch(`/api/vapi/call-start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: activeCall.sessionId,
                        callId: activeCall.callId
                    })
                });
            } catch (error) {
                console.error('[Vapi] Failed to record call start in session:', error);
            }
        }

        eventCallbacks.onCallStart.forEach(cb => cb(activeCall));
    });

    initializedVapi.on("call-end", async () => {
        const duration = activeCall.startTime
            ? Math.floor((Date.now() - activeCall.startTime) / 1000)
            : 0;

        console.log(`[Vapi] Call ended for phase ${activeCall.phaseId}, duration: ${duration}s`);
        console.log(`[Vapi] Collected ${activeCall.messageBuffer.length} messages to store`);

        const callData = {
            ...activeCall,
            duration,
            messages: [...activeCall.messageBuffer] // Include collected messages
        };

        // Store messages via API (critical for persistence!)
        if (activeCall.sessionId && activeCall.phaseId) {
            try {
                console.log(`[Vapi] Sending ${activeCall.messageBuffer.length} messages to /api/vapi/call-end`);
                const response = await fetch(`/api/vapi/call-end`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: activeCall.sessionId,
                        phaseId: activeCall.phaseId,
                        callId: activeCall.callId,
                        duration,
                        messages: activeCall.messageBuffer
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log(`[Vapi] ✅ Successfully stored ${result.messagesStored || 0} messages`);
                } else {
                    console.error('[Vapi] ❌ Failed to store messages:', await response.text());
                }
            } catch (error) {
                console.error('[Vapi] ❌ Failed to call /api/vapi/call-end:', error);
            }
        } else {
            console.warn('[Vapi] Cannot store messages - missing sessionId or phaseId');
        }

        activeCall = {
            callId: null,
            sessionId: null,
            phaseId: null,
            assistantType: null,
            startTime: null,
            status: 'idle',
            messageBuffer: []
        };

        eventCallbacks.onCallEnd.forEach(cb => cb(callData));
    });

    initializedVapi.on("speech-start", () => {
        console.log("[Vapi] Assistant started speaking");
        eventCallbacks.onSpeechStart.forEach(cb => cb());
    });

    initializedVapi.on("speech-end", () => {
        console.log("[Vapi] Assistant finished speaking");
        eventCallbacks.onSpeechEnd.forEach(cb => cb());
    });

    initializedVapi.on("message", (message) => {
        console.log("[Vapi] Message received:", message);
        console.log(`[Vapi] Number of registered onMessage callbacks: ${eventCallbacks.onMessage.length}`);

        // Collect transcript messages for conversation history
        // CRITICAL: Only store FINAL transcripts, not partial ones
        // Also deduplicate: Vapi may send the same final transcript multiple times
        if (message.type === 'transcript' && message.role && message.transcript) {
            const isFinal = message.transcriptType === 'final';

            if (isFinal && message.role && message.transcript) {
                const role = message.role; // 'user' or 'assistant'
                const content = message.transcript; // Text is directly in transcript property

                // Deduplicate: Check if we've already stored this exact message
                // (Vapi may send the same final transcript multiple times)
                const isDuplicate = activeCall.messageBuffer.some(
                    (msg) => msg.role === role && msg.content === content
                );

                if (!isDuplicate) {
                    activeCall.messageBuffer.push({ role, content });
                    console.log(`[Vapi] Stored final transcript: ${role} - ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
                } else {
                    console.log(`[Vapi] Skipping duplicate final transcript: ${role} - ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
                }
            }
        }

        // Call all registered callbacks with detailed logging
        if (eventCallbacks.onMessage.length === 0) {
            console.warn("[Vapi] ⚠️ No callbacks registered for onMessage! Message will be lost.");
        } else {
            console.log(`[Vapi] Calling ${eventCallbacks.onMessage.length} callback(s) for message type: ${message.type}`);
            eventCallbacks.onMessage.forEach((cb, index) => {
                console.log(`[Vapi] About to call callback ${index + 1}/${eventCallbacks.onMessage.length} - type: ${typeof cb}, name: ${cb.name || 'anonymous'}`);
                try {
                    cb(message);
                    console.log(`[Vapi] ✅ Callback ${index + 1} completed successfully`);
                } catch (error) {
                    console.error(`[Vapi] ❌ Callback ${index + 1} errored:`, error);
                    console.error(`[Vapi] Error stack:`, error?.stack);
                }
            });
        }
    });

    initializedVapi.on("error", (error) => {
        // Collect all error information into a single object for easy viewing
        const errorReport = {
            timestamp: new Date().toISOString(),
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            // Extract all possible error properties
            message: error?.message,
            name: error?.name,
            code: error?.code,
            status: error?.status,
            statusCode: error?.statusCode,
            type: error?.type,
            error: error?.error,
            errorMessage: error?.errorMessage,
            details: error?.details,
            stack: error?.stack,
            // Try to capture the raw error object
            rawError: error
        };

        // Remove undefined values
        Object.keys(errorReport).forEach(key => {
            if (errorReport[key] === undefined) delete errorReport[key];
        });

        // SINGLE CONSOLIDATED ERROR LOG - All error info in one place
        console.error("[Vapi] ========== COMPLETE ERROR REPORT ==========");
        console.error("[Vapi] Full error details:", errorReport);

        // Also try to stringify if it's an object
        if (error && typeof error === 'object') {
            try {
                const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
                console.error("[Vapi] Error JSON string:", errorString);
            } catch (e) {
                console.error("[Vapi] Could not stringify error:", e);
            }
        }

        console.error("[Vapi] ===========================================");

        // Extract message for callbacks
        let errorMessage = 'Unknown Vapi error';
        if (error) {
            if (error instanceof Error) {
                errorMessage = error.message || error.toString();
            } else if (typeof error === 'object') {
                errorMessage = error.message || error.error || error.errorMessage || JSON.stringify(error);
            } else {
                errorMessage = String(error);
            }
        }

        // Create enhanced error object
        const enhancedError = error instanceof Error
            ? error
            : (error && typeof error === 'object' && Object.keys(error).length > 0
                ? error
                : { message: errorMessage, originalError: error });

        activeCall.status = 'idle';
        eventCallbacks.onError.forEach(cb => {
            try {
                cb(enhancedError);
            } catch (callbackError) {
                console.error("[Vapi] Error in error callback:", callbackError);
            }
        });
    });

    console.log("[Vapi] Event listeners initialized successfully");
}

/**
 * Reset listener initialization flag (for testing purposes)
 */
export function resetVapiListeners() {
    listenersInitialized = false;
}

/**
 * Start a phase-specific voice call
 */
export async function startPhaseCall(sessionId, phaseId, assistantType, previousMessages = []) {
    if (activeCall.status !== 'idle') {
        console.warn(`[Vapi] Call already in progress for session ${activeCall.sessionId}`);
        return null;
    }

    const assistantId = ASSISTANT_IDS[assistantType];
    if (!assistantId) {
        throw new Error(`Unknown assistant type: ${assistantType}`);
    }

    // Log assistant ID (first few chars only for security) and warn if using placeholder
    console.log(`[Vapi] Using assistant ID: ${assistantId.substring(0, Math.min(8, assistantId.length))}... (length: ${assistantId.length})`);
    if (assistantId === 'vapi-assistant-placeholder') {
        console.error('[Vapi] ⚠️  ERROR: Using placeholder assistant ID! Set NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local and restart dev server.');
    }

    const contextInfo = previousMessages.length > 0
        ? `with ${previousMessages.length} previous messages`
        : 'without previous context';

    console.log(`[Vapi] Starting call for session ${sessionId}, phase ${phaseId}, assistant ${assistantType} ${contextInfo}`);

    activeCall = {
        callId: `call_${Date.now()}`,
        sessionId,
        phaseId,
        assistantType,
        startTime: null,
        status: 'connecting',
        messageBuffer: []
    };

    try {
        // Validate assistant ID
        if (!assistantId || assistantId === 'vapi-assistant-placeholder') {
            const errorMsg = 'VAPI_ASSISTANT_ID is not configured. Please set it in your .env.local file.';
            console.error(`[Vapi] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log(`[Vapi] Starting call with assistant ID: ${assistantId}`);

        // Start Vapi call with optional conversation history
        const callOptions = {};

        if (previousMessages.length > 0) {
            callOptions.messages = previousMessages;
            console.log(`[Vapi] Including ${previousMessages.length} previous messages`);
        }

        console.log(`[Vapi] Call options:`, JSON.stringify(callOptions, null, 2));
        console.log(`[Vapi] Calling vapi.start() with assistant ID: ${assistantId}`);

        await vapi.start(assistantId, callOptions);
        console.log(`[Vapi] vapi.start() call completed successfully`);
        return activeCall;
    } catch (error) {
        console.error("[Vapi] ========== FAILED TO START CALL ==========");
        console.error("[Vapi] Error:", error);
        console.error("[Vapi] Error message:", error?.message);
        console.error("[Vapi] Error stack:", error?.stack);
        console.error("[Vapi] Error name:", error?.name);
        console.error("[Vapi] Assistant ID used:", assistantId);
        console.error("[Vapi] ===========================================");
        activeCall.status = 'idle';
        throw error;
    }
}

/**
 * Stop the current voice call
 */
export async function stopCall(reason = 'manual') {
    const initializedVapi = await initializeVapi();

    if (activeCall.status === 'idle') {
        console.log("[Vapi] No active call to stop");
        return null;
    }

    console.log(`[Vapi] Stopping call for session ${activeCall.sessionId}, reason: ${reason}`);
    activeCall.status = 'ending';

    try {
        await initializedVapi.stop();
        return { success: true, reason };
    } catch (error) {
        console.error("[Vapi] Failed to stop call:", error);
        throw error;
    }
}

/**
 * Get current call status
 */
export function getCallStatus() {
    return { ...activeCall };
}

/**
 * Check if a call is currently active
 */
export function isCallActive() {
    return activeCall.status === 'active' || activeCall.status === 'connecting';
}

/**
 * Register event callback
 */
export function onEvent(eventType, callback) {
    console.log(`[Vapi] onEvent called - eventType: ${eventType}, callback type: ${typeof callback}`);
    if (eventCallbacks[eventType]) {
        eventCallbacks[eventType].push(callback);
        console.log(`[Vapi] Callback registered for ${eventType}. Total callbacks: ${eventCallbacks[eventType].length}`);
        console.log(`[Vapi] All registered callbacks for ${eventType}:`, eventCallbacks[eventType].map((cb, i) => ({ index: i, type: typeof cb, name: cb.name || 'anonymous' })));
    } else {
        console.error(`[Vapi] Unknown event type: ${eventType}. Available types:`, Object.keys(eventCallbacks));
    }
}

/**
 * Remove event callback
 */
export function offEvent(eventType, callback) {
    console.log(`[Vapi] offEvent called - eventType: ${eventType}, callback type: ${typeof callback}`);
    if (eventCallbacks[eventType]) {
        const beforeLength = eventCallbacks[eventType].length;
        const index = eventCallbacks[eventType].indexOf(callback);
        if (index > -1) {
            eventCallbacks[eventType].splice(index, 1);
            console.log(`[Vapi] ✅ Callback removed from ${eventType}. Before: ${beforeLength}, After: ${eventCallbacks[eventType].length}`);
        } else {
            console.warn(`[Vapi] ⚠️ Callback not found in ${eventType} array (was trying to remove)`);
            console.log(`[Vapi] Current callbacks in array:`, eventCallbacks[eventType].map((cb, i) => ({ index: i, type: typeof cb })));
        }
    } else {
        console.error(`[Vapi] Unknown event type in offEvent: ${eventType}`);
    }
}

/**
 * Calculate call cost estimate
 */
export function estimateCost(durationSeconds) {
    const costPerMinute = parseFloat(process.env.VAPI_COST_PER_MINUTE || '0.10');
    return (durationSeconds / 60) * costPerMinute;
}

/**
 * Get callback registration status (for debugging)
 */
export function getCallbackStatus() {
    const status = {
        onMessage: eventCallbacks.onMessage.length,
        onCallStart: eventCallbacks.onCallStart.length,
        onCallEnd: eventCallbacks.onCallEnd.length,
        onError: eventCallbacks.onError.length,
    };
    console.log('[Vapi] Callback status:', status);
    return status;
}

/**
 * Send a message to the assistant (if supported)
 */
export async function sendMessage(message) {
    if (!isCallActive()) {
        console.warn("[Vapi] Cannot send message - no active call");
        return false;
    }

    const initializedVapi = await initializeVapi();
    initializedVapi.send({
        type: 'add-message',
        message: {
            role: 'user',
            content: message
        }
    });

    return true;
}

// Legacy exports for backwards compatibility
export async function startVoiceCall(assistantId) {
    try {
        const initializedVapi = await initializeVapi();
        await initializedVapi.start(assistantId);
        console.log("Voice call started");
    } catch (error) {
        console.error("Error starting call:", error);
    }
}

export async function stopVoiceCall() {
    try {
        const initializedVapi = await initializeVapi();
        await initializedVapi.stop();
        console.log("Voice call stopped");
    } catch (error) {
        console.error("Error stopping call:", error);
    }
}

// Auto-initialize listeners if in browser (async, but don't block)
if (typeof window !== 'undefined') {
    initializeVapiListeners().catch(err => {
        console.error('[Vapi] Failed to auto-initialize listeners:', err);
    });
}

export { vapi };

export default {
    vapi,
    initializeVapiListeners,
    startPhaseCall,
    stopCall,
    getCallStatus,
    isCallActive,
    onEvent,
    offEvent,
    estimateCost,
    sendMessage,
    startVoiceCall,
    stopVoiceCall,
    getCallbackStatus,
    ASSISTANT_IDS
};
