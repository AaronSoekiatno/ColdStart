import { useRouter } from 'next/router';
import useSWR from 'swr';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { startPhaseCall, initializeVapiListeners } from '../../vapi-client';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Dashboard() {
    const router = useRouter();
    const { sessionId } = router.query;
    const [controlLoading, setControlLoading] = useState(false);
    const [vapiInitialized, setVapiInitialized] = useState(false);

    // Poll status every 1 second
    const { data: status, error, mutate } = useSWR(
        sessionId ? `/api/session/${sessionId}` : null,
        fetcher,
        { refreshInterval: 1000 }
    );

    // Initialize Vapi listeners on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !vapiInitialized) {
            initializeVapiListeners();
            setVapiInitialized(true);
        }
    }, [vapiInitialized]);

    // Start Vapi call when dashboard loads and phase requires it
    const [vapiStartAttempted, setVapiStartAttempted] = useState(false);

    useEffect(() => {
        if (!status || !status.session || !status.currentPhase) return;

        const { currentPhase, session } = status;

        // Only start Vapi if:
        // 1. Phase requires Vapi (vapiActive is true)
        // 2. Vapi is not already active
        // 3. We're in the browser
        // 4. We haven't already attempted to start it
        if (currentPhase.vapiActive &&
            status.vapi?.status === 'idle' &&
            !status.vapi?.active &&
            typeof window !== 'undefined' &&
            session.status === 'active' &&
            !vapiStartAttempted) {

            const startVapiCall = async () => {
                try {
                    setVapiStartAttempted(true);
                    const candidateName = session.candidateName || 'Candidate';
                    console.log('[Dashboard] Attempting to start Vapi call for phase:', currentPhase.id);
                    await startPhaseCall(
                        sessionId,
                        currentPhase.id,
                        currentPhase.id === 'KICK_OFF' ? 'kickoff' : 'reflection',
                        [] // No previous messages for now
                    );
                    console.log('[Dashboard] Successfully started Vapi call for phase:', currentPhase.id);
                } catch (error) {
                    console.error('[Dashboard] Failed to start Vapi call:', error);
                    setVapiStartAttempted(false); // Allow retry on error
                }
            };

            // Small delay to ensure everything is loaded
            const timer = setTimeout(startVapiCall, 1000);
            return () => clearTimeout(timer);
        }

        // Reset attempt flag if Vapi becomes active (call succeeded)
        if (status.vapi?.active) {
            setVapiStartAttempted(false);
        }
    }, [status, sessionId, vapiStartAttempted]);

    if (error) {
        console.error('Dashboard error:', error);
        return (
            <div className="container">
                <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem' }}>
                    <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error Loading Session</h2>
                    <p>{error.message || 'Failed to load session data'}</p>
                    <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                        Session ID: {sessionId}
                    </p>
                    <button
                        className="btn btn-primary"
                        style={{ marginTop: '1rem' }}
                        onClick={() => router.push('/')}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }
    if (!status || !status.session) return <div className="container">Loading dashboard...</div>;

    const { session, currentPhase, timer, vapi } = status;

    // Ensure session has required fields with defaults
    if (!session.status) {
        session.status = 'created';
    }
    const PHASES = ['KICK_OFF', 'BUILD', 'REFLECTION'];

    const handleControl = async (action, payload = {}) => {
        setControlLoading(true);
        try {
            await fetch('/api/interview/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action, payload })
            });
            mutate(); // Force refresh
        } catch (err) {
            alert('Control failed');
        } finally {
            setControlLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>{session.candidateName || 'Candidate'}</h1>
                    <div style={{ opacity: 0.7 }}>Session: {sessionId}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className={clsx('step', { active: session.status === 'active' })}>
                        Status: {(session.status || 'created').toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Phase Stepper */}
            <div className="stepper">
                {PHASES.map((phaseId, index) => {
                    const isActive = currentPhase.id === phaseId;
                    // Simple completed logic: if the phase index < current phase index
                    const currentPhaseIndex = PHASES.indexOf(currentPhase.id);
                    const isCompleted = PHASES.indexOf(phaseId) < currentPhaseIndex;

                    return (
                        <div key={phaseId} className={clsx('step', { active: isActive, completed: isCompleted })}>
                            {index + 1}. {phaseId.replace('_', ' ')}
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                {/* Main Monitor */}
                <div>
                    <div className="card" style={{ textAlign: 'center', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
                            CURRENT PHASE: {currentPhase.name}
                        </h3>

                        {/* Timer Display */}
                        <div style={{ fontSize: '5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                            {timer.isActive ? formatTime(timer.remaining) : '--:--'}
                        </div>

                        <div style={{ marginTop: '1rem', color: 'var(--text-color)', opacity: 0.8 }}>
                            {currentPhase.vapiActive ? (
                                <span style={{ color: 'var(--success)' }}>● Vapi Helper Active</span>
                            ) : (
                                <span style={{ color: 'var(--text-color)' }}>○ Coding Focus Mode (Vapi Sleep)</span>
                            )}
                        </div>

                        <p style={{ marginTop: '2rem', fontStyle: 'italic' }}>
                            "{currentPhase.purpose}"
                        </p>
                    </div>

                    {/* Logs */}
                    <div className="card">
                        <h3>Session Log</h3>
                        <div className="terminal-logs">
                            {session.phaseHistory && session.phaseHistory.length > 0 ? (
                                session.phaseHistory.slice().reverse().map((entry, i) => (
                                    <div key={i} style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#666' }}>[{new Date(entry.timestamp).toLocaleTimeString()}]</span>{' '}
                                        <span style={{ color: 'var(--primary)' }}>{entry.phase}</span>{' '}
                                        <span style={{ color: '#fff' }}>{entry.action}</span>
                                        {entry.action === 'commit' && ` - ${entry.commitId?.substring(0, 7)}`}
                                        {entry.action === 'test_result' && (
                                            <span style={{ color: entry.conclusion === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                                                {' '}[{entry.conclusion ? entry.conclusion.toUpperCase() : entry.status}]
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div>No events recorded yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Sidebar */}
                <div>
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>Controls</h3>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            {session.status === 'paused' ? (
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleControl('resume')}>
                                    RESUME
                                </button>
                            ) : (
                                <button className="btn" style={{ flex: 1 }} onClick={() => handleControl('pause')}>
                                    PAUSE
                                </button>
                            )}
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Adjust Time</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => handleControl('add_time', { seconds: 30 })}>+30s</button>
                                <button className="btn" onClick={() => handleControl('add_time', { seconds: 60 })}>+1m</button>
                                <button className="btn" onClick={() => handleControl('add_time', { seconds: -30 })}>-30s</button>
                            </div>
                        </div>

                        <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />

                        <button
                            className="btn btn-danger"
                            style={{ width: '100%', marginBottom: '1rem' }}
                            onClick={() => {
                                const target = prompt('Type the phase ID to jump to (e.g. BUILD or REFLECTION):');
                                if (target) handleControl('next_phase', { targetPhase: target.toUpperCase() });
                            }}
                        >
                            FORCE TRANSITION
                        </button>

                        <button
                            className="btn btn-danger"
                            style={{ width: '100%' }}
                            onClick={() => {
                                if (confirm('Are you sure you want to END the interview?')) handleControl('end_interview');
                            }}
                        >
                            END INTERVIEW
                        </button>

                    </div>

                    <div className="card">
                        <h3>Vapi Status</h3>
                        <div style={{ marginTop: '0.5rem' }}>
                            Status: <b>{vapi.status}</b>
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                            Active: {vapi.active ? 'YES' : 'NO'}
                        </div>
                        {vapi.active && (
                            <button
                                className="btn btn-danger"
                                style={{ width: '100%', marginTop: '1rem' }}
                                onClick={() => {
                                    if (confirm('Stop the call and end the interview? This will mark the interview as incomplete.')) {
                                        handleControl('stop_call');
                                    }
                                }}
                            >
                                🛑 Stop Call & End Interview
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
