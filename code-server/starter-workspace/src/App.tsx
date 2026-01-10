import { useState } from 'react'
import './App.css'

function App() {
    const [count, setCount] = useState(0)

    return (
        <div className="app">
            <header className="app-header">
                <h1>🚀 Assessment Workspace</h1>
                <p className="subtitle">Your development environment is ready!</p>
            </header>

            <main className="app-main">
                <div className="card">
                    <h2>Welcome to Your IDE</h2>
                    <p>
                        This is a fully functional React + TypeScript development environment
                        running in VS Code (code-server).
                    </p>

                    <div className="counter-section">
                        <button onClick={() => setCount((count) => count + 1)}>
                            Count is {count}
                        </button>
                        <p className="hint">
                            Edit <code>src/App.tsx</code> to see changes instantly
                        </p>
                    </div>
                </div>

                <div className="features">
                    <div className="feature">
                        <span className="icon">⚡</span>
                        <h3>Vite</h3>
                        <p>Lightning-fast HMR</p>
                    </div>
                    <div className="feature">
                        <span className="icon">⚛️</span>
                        <h3>React 18</h3>
                        <p>Latest React features</p>
                    </div>
                    <div className="feature">
                        <span className="icon">📘</span>
                        <h3>TypeScript</h3>
                        <p>Type-safe development</p>
                    </div>
                </div>

                <div className="instructions">
                    <h3>Getting Started</h3>
                    <ol>
                        <li>Open the integrated terminal (Ctrl + `)</li>
                        <li>Run <code>npm install</code> to install dependencies</li>
                        <li>Run <code>npm run dev</code> to start the dev server</li>
                        <li>Start building your assessment project!</li>
                    </ol>
                </div>
            </main>
        </div>
    )
}

export default App
