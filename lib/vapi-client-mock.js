/**
 * Mock Vapi Client for Testing
 * 
 * Simulates Vapi calls without actually triggering the API
 * Use this for testing to avoid charges
 */

// Mock active call state
let mockActiveCall = {
    callId: null,
    sessionId: null,
    phaseId: null,
    assistantType: null,
    startTime: null,
    status: 'idle',
    messageBuffer: []
};

// Mock event callbacks
const mockEventCallbacks = {
    onCallStart: [],
    onCallEnd: [],
    onSpeechStart: [],
    onSpeechEnd: [],
    onMessage: [],
    onError: []
};

/**
 * Initialize mock Vapi listeners
 */
export function initializeVapiListeners() {
    console.log('[MOCK Vapi] Event listeners initialized (mock mode)');
}

/**
 * Start a mock phase call
 */
export async function startPhaseCall(sessionId, phaseId, assistantType, previousMessages = []) {
    console.log('\n🎭 [MOCK Vapi] Starting call...');
    console.log(`   Session: ${sessionId}`);
    console.log(`   Phase: ${phaseId}`);
    console.log(`   Assistant: ${assistantType}`);
    console.log(`   Context messages: ${previousMessages.length}`);

    const callId = `mock_call_${Date.now()}`;

    mockActiveCall = {
        callId,
        sessionId,
        phaseId,
        assistantType,
        startTime: Date.now(),
        status: 'active',
        messageBuffer: []
    };

    // Simulate call start event
    setTimeout(() => {
        console.log('   ✅ [MOCK Vapi] Call connected');
        mockEventCallbacks.onCallStart.forEach(cb => cb(mockActiveCall));
    }, 100);

    // Simulate a short conversation
    setTimeout(() => {
        simulateConversation(phaseId);
    }, 500);

    return mockActiveCall;
}

/**
 * Simulate a realistic conversation based on phase
 */
function simulateConversation(phaseId) {
    const conversations = {
        KICK_OFF: [
            { role: 'assistant', content: 'Welcome to Minerva! What\'s your name?' },
            { role: 'user', content: 'Hi, I\'m testing the system.' },
            { role: 'assistant', content: 'Great! Your task is ready. You have 10 minutes for the BUILD phase.' }
        ],
        BUG_INJECTION: [
            { role: 'assistant', content: 'We\'ve detected a critical bug in your code.' },
            { role: 'user', content: 'What\'s the issue?' },
            { role: 'assistant', content: 'The authentication module has a security flaw. You have 5 minutes to fix it.' }
        ],
        POST_MORTEM: [
            { role: 'assistant', content: 'Let\'s review your performance. How did you approach the bug?' },
            { role: 'user', content: 'I identified the token validation issue and fixed it.' },
            { role: 'assistant', content: 'Excellent. Your interview is now complete.' }
        ]
    };

    const messages = conversations[phaseId] || [
        { role: 'assistant', content: 'Phase started' },
        { role: 'user', content: 'Acknowledged' }
    ];

    // Simulate messages arriving over time
    messages.forEach((msg, index) => {
        setTimeout(() => {
            console.log(`   💬 [MOCK Vapi] ${msg.role}: "${msg.content}"`);
            mockActiveCall.messageBuffer.push(msg);
            mockEventCallbacks.onMessage.forEach(cb => cb({
                type: 'transcript',
                transcript: { role: msg.role, text: msg.content }
            }));
        }, index * 800);
    });

    // Simulate call end after conversation
    setTimeout(() => {
        endMockCall();
    }, messages.length * 800 + 500);
}

/**
 * End the mock call
 */
function endMockCall() {
    if (mockActiveCall.status === 'idle') return;

    const duration = Math.floor((Date.now() - mockActiveCall.startTime) / 1000);

    console.log(`   🏁 [MOCK Vapi] Call ended (${duration}s)`);

    const callData = {
        ...mockActiveCall,
        duration,
        messages: [...mockActiveCall.messageBuffer]
    };

    mockActiveCall = {
        callId: null,
        sessionId: null,
        phaseId: null,
        assistantType: null,
        startTime: null,
        status: 'idle',
        messageBuffer: []
    };

    mockEventCallbacks.onCallEnd.forEach(cb => cb(callData));
}

/**
 * Stop the current mock call
 */
export async function stopCall(reason = 'manual') {
    console.log(`   ⏹️  [MOCK Vapi] Stopping call (reason: ${reason})`);
    endMockCall();
    return { success: true, reason };
}

/**
 * Get current call status
 */
export function getCallStatus() {
    return { ...mockActiveCall };
}

/**
 * Check if a call is currently active
 */
export function isCallActive() {
    return mockActiveCall.status === 'active';
}

/**
 * Register event callback
 */
export function onEvent(eventType, callback) {
    if (mockEventCallbacks[eventType]) {
        mockEventCallbacks[eventType].push(callback);
    }
}

/**
 * Remove event callback
 */
export function offEvent(eventType, callback) {
    if (mockEventCallbacks[eventType]) {
        const index = mockEventCallbacks[eventType].indexOf(callback);
        if (index > -1) {
            mockEventCallbacks[eventType].splice(index, 1);
        }
    }
}

/**
 * Calculate call cost estimate (always $0 in mock)
 */
export function estimateCost(durationSeconds) {
    return 0; // Mock calls are free!
}

/**
 * Mock send message
 */
export function sendMessage(message) {
    console.log(`   📤 [MOCK Vapi] Sending message: "${message}"`);
    return true;
}

// Legacy exports for backwards compatibility
export async function startVoiceCall(assistantId) {
    console.log(`[MOCK Vapi] Would start voice call with assistant: ${assistantId}`);
}

export async function stopVoiceCall() {
    console.log('[MOCK Vapi] Would stop voice call');
}

export default {
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
    stopVoiceCall
};
