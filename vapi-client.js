/**
 * Vapi Client - Phase-Aware Voice Agent Controller
 * 
 * Manages Vapi voice calls with phase-specific assistants,
 * automatic start/stop based on interview phases, and cost tracking.
 */

// Conditionally import Vapi or use a mock for Server-Side Rendering
let Vapi;
let vapi;

if (typeof window !== 'undefined') {
    Vapi = require("@vapi-ai/web").default;
    vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);
} else {
    // Server-side mock to prevent crashes
    console.log('[Vapi] Running on server - using mock Vapi client');
    vapi = {
        on: () => { },
        start: async () => console.log('Mock Vapi start'),
        stop: async () => console.log('Mock Vapi stop'),
        send: () => { },
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
export function initializeVapiListeners() {
    if (typeof window === 'undefined') return;

    vapi.on("call-start", async () => {
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

    vapi.on("call-end", () => {
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

    vapi.on("speech-start", () => {
        console.log("[Vapi] Assistant started speaking");
        eventCallbacks.onSpeechStart.forEach(cb => cb());
    });

    vapi.on("speech-end", () => {
        console.log("[Vapi] Assistant finished speaking");
        eventCallbacks.onSpeechEnd.forEach(cb => cb());
    });

    vapi.on("message", (message) => {
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

    vapi.on("error", (error) => {
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
    if (activeCall.status === 'idle') {
        console.log("[Vapi] No active call to stop");
        return null;
    }

    console.log(`[Vapi] Stopping call for session ${activeCall.sessionId}, reason: ${reason}`);
    activeCall.status = 'ending';

    try {
        await vapi.stop();
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
export function sendMessage(message) {
    if (!isCallActive()) {
        console.warn("[Vapi] Cannot send message - no active call");
        return false;
    }

    vapi.send({
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
        await vapi.start(assistantId);
        console.log("Voice call started");
    } catch (error) {
        console.error("Error starting call:", error);
    }
}

export async function stopVoiceCall() {
    try {
        await vapi.stop();
        console.log("Voice call stopped");
    } catch (error) {
        console.error("Error stopping call:", error);
    }
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    initializeVapiListeners();
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
