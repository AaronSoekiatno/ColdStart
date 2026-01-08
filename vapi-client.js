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
            // Try multiple import strategies for Next.js compatibility
            let VapiModule = null;
            let importError = null;
            
            // Strategy 1: Standard dynamic import
            try {
                VapiModule = await import("@vapi-ai/web");
                console.log('[Vapi] Standard import successful');
            } catch (e) {
                console.warn('[Vapi] Standard import failed, trying alternative...', e);
                importError = e;
                
                // Strategy 2: Try importing from dist directly
                try {
                    VapiModule = await import("@vapi-ai/web/dist/vapi.js");
                    console.log('[Vapi] Direct dist import successful');
                } catch (e2) {
                    console.warn('[Vapi] Direct dist import also failed', e2);
                    
                    // Strategy 3: Try with ?module suffix (for some bundlers)
                    try {
                        VapiModule = await import("@vapi-ai/web?module");
                        console.log('[Vapi] Module suffix import successful');
                    } catch (e3) {
                        console.error('[Vapi] All import strategies failed');
                        throw new Error(`Failed to import @vapi-ai/web. Original error: ${importError?.message || 'Unknown error'}`);
                    }
                }
            }
            
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
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || 'vapi-assistant-placeholder';

// Assistant IDs mapping - all phases use the same assistant
const ASSISTANT_IDS = {
    kickoff: VAPI_ASSISTANT_ID,
    bug_injection: VAPI_ASSISTANT_ID,
    post_mortem: VAPI_ASSISTANT_ID
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

// Event callbacks
const eventCallbacks = {
    onCallStart: [],
    onCallEnd: [],
    onSpeechStart: [],
    onSpeechEnd: [],
    onMessage: [],
    onError: []
};

/**
 * Initialize Vapi event listeners
 */
export async function initializeVapiListeners() {
    if (typeof window === 'undefined') return;
    
    const initializedVapi = await initializeVapi();

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

    initializedVapi.on("call-end", () => {
        const duration = activeCall.startTime
            ? Math.floor((Date.now() - activeCall.startTime) / 1000)
            : 0;

        console.log(`[Vapi] Call ended for phase ${activeCall.phaseId}, duration: ${duration}s`);

        const callData = {
            ...activeCall,
            duration,
            messages: [...activeCall.messageBuffer] // Include collected messages
        };

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
        console.log("[Vapi] Message:", message);

        // Collect transcript messages for conversation history
        if (message.type === 'transcript' && message.transcript) {
            const role = message.transcript.role; // 'user' or 'assistant'
            const content = message.transcript.text;

            if (role && content) {
                activeCall.messageBuffer.push({ role, content });
            }
        }

        eventCallbacks.onMessage.forEach(cb => cb(message));
    });

    initializedVapi.on("error", (error) => {
        console.error("[Vapi] Error:", error);
        activeCall.status = 'idle';
        eventCallbacks.onError.forEach(cb => cb(error));
    });

    console.log("[Vapi] Event listeners initialized");
}

/**
 * Start a phase-specific voice call
 */
/**
 * Start a phase-specific voice call
 */
export async function startPhaseCall(sessionId, phaseId, assistantType, previousMessages = [], overrides = null, context = null) {
    // Note: 'overrides' parameter kept for backwards compatibility but is no longer used
    // All assistant configuration comes from the Vapi dashboard
    // 'context' can contain candidateName for personalizing the first message
    if (activeCall.status !== 'idle') {
        console.warn(`[Vapi] Call already in progress for session ${activeCall.sessionId}`);
        return null;
    }

    const assistantId = ASSISTANT_IDS[assistantType];
    if (!assistantId) {
        throw new Error(`Unknown assistant type: ${assistantType}`);
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
        // Start Vapi call with optional conversation history
        const callOptions = {};

        if (previousMessages.length > 0) {
            callOptions.messages = previousMessages;
        }

        // Personalize first message if candidate name is provided (for KICK_OFF phase)
        if (context?.candidateName && phaseId === 'KICK_OFF') {
            // Replace {candidate's name} placeholder in first message
            // Note: Vapi dashboard first message should use {candidate's name} as placeholder
            callOptions.assistantOverrides = {
                firstMessage: `Hello ${context.candidateName}, I'm Minerva and I'll be helping you through this challenge today. Before we start, do you have any questions?`
            };
            console.log(`[Vapi] Personalizing first message for ${context.candidateName}`);
        }

        await vapi.start(assistantId, callOptions);
        return activeCall;
    } catch (error) {
        console.error("[Vapi] Failed to start call:", error);
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
    if (eventCallbacks[eventType]) {
        eventCallbacks[eventType].push(callback);
    }
}

/**
 * Remove event callback
 */
export function offEvent(eventType, callback) {
    if (eventCallbacks[eventType]) {
        const index = eventCallbacks[eventType].indexOf(callback);
        if (index > -1) {
            eventCallbacks[eventType].splice(index, 1);
        }
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
    ASSISTANT_IDS
};
