import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        candidateEmail: '',
        candidateName: '',
        githubUsername: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/interview/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.ok) {
                router.push(`/dashboard/${data.sessionId}`);
            } else {
                alert('Error: ' + data.error);
                setLoading(false);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to start interview');
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="card" style={{ maxWidth: '600px', margin: '4rem auto' }}>
                <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    Hermes <span style={{ color: 'var(--primary)' }}>Interview System</span>
                </h1>
                <h2 style={{ marginBottom: '2rem', textAlign: 'center', opacity: 0.7 }}>
                    Interview Session Control
                </h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Candidate Email</label>
                        <input
                            className="input"
                            type="email"
                            required
                            value={formData.candidateEmail}
                            onChange={(e) =>
                                setFormData({ ...formData, candidateEmail: e.target.value })
                            }
                            placeholder="e.g. alice@example.com"
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label>Candidate Name</label>
                        <input
                            className="input"
                            required
                            value={formData.candidateName}
                            onChange={(e) =>
                                setFormData({ ...formData, candidateName: e.target.value })
                            }
                            placeholder="e.g. Alice Smith"
                        />
                        <small style={{ opacity: 0.7, fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                            This name will be used in the Vapi agent's introduction
                        </small>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label>GitHub Username (Optional)</label>
                        <input
                            className="input"
                            value={formData.githubUsername}
                            onChange={(e) =>
                                setFormData({ ...formData, githubUsername: e.target.value })
                            }
                            placeholder="For repo access"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Initializing...' : 'Start Interview Session'}
                    </button>
                </form>
            </div>
        </div>
    );
}
