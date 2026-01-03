import Vapi from "@vapi-ai/web";

// Initialize Vapi client
const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);

// Start a voice conversation
export async function startVoiceCall(assistantId) {
    try {
        await vapi.start(assistantId);
        console.log("Voice call started");
    } catch (error) {
        console.error("Error starting call:", error);
    }
}

// Stop the current conversation
export async function stopVoiceCall() {
    try {
        await vapi.stop();
        console.log("Voice call stopped");
    } catch (error) {
        console.error("Error stopping call:", error);
    }
}

// Listen to call events
export function setupVapiListeners() {
    // When call starts
    vapi.on("call-start", () => {
        console.log("Call has started");
    });

    // When call ends
    vapi.on("call-end", () => {
        console.log("Call has ended");
    });

    // When receiving messages from the assistant
    vapi.on("message", (message) => {
        console.log("Message received:", message);
    });

    // When there's an error
    vapi.on("error", (error) => {
        console.error("Vapi error:", error);
    });

    // Speech status updates
    vapi.on("speech-start", () => {
        console.log("Assistant started speaking");
    });

    vapi.on("speech-end", () => {
        console.log("Assistant finished speaking");
    });
}

export default vapi;
