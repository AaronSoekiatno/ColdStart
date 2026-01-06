import { useRouter } from 'next/router';
import useSWR from 'swr';
import clsx from 'clsx';
import { useState } from 'react';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Dashboard() {
    const router = useRouter();
    const { sessionId } = router.query;
    const [controlLoading, setControlLoading] = useState(false);

    // Poll status every 1 second
    const { data: status, error, mutate } = useSWR(
        sessionId ? `/api/session/${sessionId}` : null,
        fetcher,
        { refreshInterval: 1000 }
    );

    if (error) return <div className="container">Error loading session</div>;
    if (!status) return <div className="container">Loading dashboard...</div>;

    const { session, currentPhase, timer, vapi } = status;
    const PHASES = ['KICK_OFF', 'BUILD', 'BUG_INJECTION', 'FIX', 'POST_MORTEM'];

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
                        Status: {session.status.toUpperCase()}
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
                                const target = prompt('Type the phase ID to jump to (e.g. BUG_INJECTION or FIX):');
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
