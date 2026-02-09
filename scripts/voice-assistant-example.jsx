import { useEffect, useState } from 'react';
import vapi, { startVoiceCall, stopVoiceCall, initializeVapiListeners } from '../vapi-client';

export default function VoiceAssistant() {
    const [isCallActive, setIsCallActive] = useState(false);
    const [assistantSpeaking, setAssistantSpeaking] = useState(false);

    useEffect(() => {
        // Set up event listeners when component mounts
        vapi.on('call-start', () => setIsCallActive(true));
        vapi.on('call-end', () => {
            setIsCallActive(false);
            setAssistantSpeaking(false);
        });
        vapi.on('speech-start', () => setAssistantSpeaking(true));
        vapi.on('speech-end', () => setAssistantSpeaking(false));

        // Cleanup listeners when component unmounts
        return () => {
            vapi.removeAllListeners();
        };
    }, []);

    const handleStartCall = async () => {
        // Replace 'your-assistant-id' with your actual Vapi assistant ID
        await startVoiceCall('your-assistant-id');
    };

    const handleStopCall = async () => {
        await stopVoiceCall();
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Voice Assistant</h1>

            <div style={{ marginTop: '20px' }}>
                {!isCallActive ? (
                    <button
                        onClick={handleStartCall}
                        style={{
                            padding: '15px 30px',
                            fontSize: '16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        Start Voice Call
                    </button>
                ) : (
                    <button
                        onClick={handleStopCall}
                        style={{
                            padding: '15px 30px',
                            fontSize: '16px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        End Call
                    </button>
                )}
            </div>

            <div style={{ marginTop: '20px' }}>
                <p>Status: {isCallActive ? '🟢 Call Active' : '⚫ No Active Call'}</p>
                {assistantSpeaking && <p>🗣️ Assistant is speaking...</p>}
            </div>
        </div>
    );
}
