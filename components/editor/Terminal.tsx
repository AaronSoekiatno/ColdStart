'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Loader2 } from 'lucide-react';

interface TerminalProps {
    sessionId: string;
    containerReady: boolean;
}

export function Terminal({ sessionId, containerReady }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Initialize Terminal
    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            theme: {
                background: '#0f172a', // slate-900
                foreground: '#f8f8f2',
                cursor: '#3b82f6',
                selectionBackground: '#334155',
                black: '#21222c',
                red: '#ff5555',
                green: '#50fa7b',
                yellow: '#f1fa8c',
                blue: '#bd93f9',
                magenta: '#ff79c6',
                cyan: '#8be9fd',
                white: '#f8f8f2',
                brightBlack: '#6272a4',
                brightRed: '#ff6e6e',
                brightGreen: '#69ff94',
                brightYellow: '#ffffa5',
                brightBlue: '#d6acff',
                brightMagenta: '#ff92df',
                brightCyan: '#a4ffff',
                brightWhite: '#ffffff',
            },
            convertEol: true, // Convert \n to \r\n
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        term.write('\x1b[34mWelcome to Hermes Cloud Terminal\x1b[0m\r\n');
        term.write('Connecting to container...\r\n');

        // Handle resizing
        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        // Also resize on mount after a small delay to ensure layout is computed
        setTimeout(() => fitAddon.fit(), 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    // Connect WebSocket
    useEffect(() => {
        if (!containerReady || !sessionId || !xtermRef.current) return;

        // Prevent double connections based on dependency changes
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/socket/terminal?sessionId=${sessionId}`;

        // Note: We're taking a risk here assuming we can route WS through Next.js
        // If this fails, we will need a dedicated polling fallback or separate WS server.
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            xtermRef.current?.write('\r\n\x1b[32mConnected!\x1b[0m\r\n$ ');

            // Send initial resize
            if (xtermRef.current) {
                const { cols, rows } = xtermRef.current;
                ws.send(JSON.stringify({ type: 'resize', cols, rows }));
            }
        };

        ws.onmessage = (event) => {
            xtermRef.current?.write(event.data);
        };

        ws.onclose = () => {
            setIsConnected(false);
            xtermRef.current?.write('\r\n\x1b[31mDisconnected from server\x1b[0m\r\n');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            xtermRef.current?.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
        };

        // Term -> WS
        xtermRef.current.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'input', data }));
            }
        });

        // Term Resize -> WS
        xtermRef.current.onResize(({ cols, rows }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols, rows }));
            }
        });

        return () => {
            ws.close();
        };
    }, [sessionId, containerReady]);

    // Re-fit on container visibility/size changes
    useEffect(() => {
        if (fitAddonRef.current) {
            setTimeout(() => {
                try {
                    fitAddonRef.current?.fit();
                } catch (e) {
                    // Ignore resize errors if terminal is hidden
                }
            }, 100);
        }
    }, [containerReady]);

    return (
        <div className="h-full w-full bg-slate-900 relative">
            <div ref={terminalRef} className="h-full w-full" />
            {!isConnected && containerReady && (
                <div className="absolute top-2 right-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
            )}
        </div>
    );
}
