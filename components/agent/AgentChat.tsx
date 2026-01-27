'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, CheckCircle2, XCircle, X, Terminal, FileText, Search, Code, Cpu, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

interface ToolLog {
    toolName: string;
    input: any;
    result?: string;
    status: 'running' | 'complete' | 'error';
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    status?: 'pending' | 'streaming' | 'complete' | 'error';
    toolActivity?: ToolLog[];
    reasoning?: string; // New field for thinking process
}

interface AgentChatProps {
    sessionId: string;
    flyAppName?: string | null;
    containerReady: boolean;
    onClose?: () => void;
    hideHeader?: boolean;
    onFileChanged?: (path: string, content: string) => void; // NEW: Direct file update callback
}

export default function AgentChat({ sessionId, flyAppName, containerReady, onClose, hideHeader, onFileChanged }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // File referencing state
    const [files, setFiles] = useState<string[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0); // For keyboard navigation
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load chat history on mount (only once per sessionId)
    useEffect(() => {
        if (!sessionId || historyLoaded) return;

        // 1. Try to load from localStorage for instant recovery
        const cacheKey = `agent-chat-v2-${sessionId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const messagesWithDates = parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
                console.log(`[AgentChat] Recovered ${messagesWithDates.length} messages from cache`);
                setMessages(messagesWithDates);
            } catch (e) {
                console.error('[AgentChat] Failed to parse cached messages', e);
            }
        }

        console.log(`[AgentChat] Loading chat history for ${sessionId}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        fetch(`/api/agent/chat-history?sessionId=${sessionId}`, {
            signal: controller.signal
        })
            .then(res => {
                clearTimeout(timeoutId);
                return res.json();
            })
            .then(data => {
                if (data.messages && data.messages.length > 0) {
                    console.log(`[AgentChat] Loaded ${data.messages.length} messages from history`);
                    // Convert timestamp strings back to Date objects
                    const messagesWithDates = data.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    setMessages(messagesWithDates);
                }
                setHistoryLoaded(true);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                if (err.name !== 'AbortError') {
                    console.error('Failed to load chat history:', err);
                }
                setHistoryLoaded(true);
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [sessionId, historyLoaded]);

    // Save chat history whenever messages change (debounced)
    useEffect(() => {
        if (!historyLoaded || messages.length === 0) return;

        // Immediate localStorage sync for local persistence (prevents loss on fast reopen)
        const cacheKey = `agent-chat-v2-${sessionId}`;
        localStorage.setItem(cacheKey, JSON.stringify(messages));

        const saveTimer = setTimeout(() => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for saves

            fetch('/api/agent/chat-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, messages }),
                signal: controller.signal
            })
                .then(res => {
                    clearTimeout(timeoutId);
                    return res.json();
                })
                .then(() => {
                    console.log(`[AgentChat] Saved ${messages.length} messages to history`);
                    // Also update localStorage cache
                    const cacheKey = `agent-chat-v2-${sessionId}`;
                    localStorage.setItem(cacheKey, JSON.stringify(messages));
                })
                .catch(err => {
                    clearTimeout(timeoutId);
                    if (err.name !== 'AbortError') {
                        console.error('Failed to save chat history:', err);
                    }
                });
        }, 5000); // Increased debounce to 5 seconds (less aggressive)

        return () => clearTimeout(saveTimer);
    }, [messages, sessionId, historyLoaded]);

    // Fetch workspace files when container is ready
    useEffect(() => {
        if (containerReady && flyAppName) {
            fetch('/api/agent/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flyAppName })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.files) setFiles(data.files);
                })
                .catch(err => console.error('Failed to load file list:', err));
        }
    }, [containerReady, flyAppName]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    }, [input]);

    // Handle input changes for mentions
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInput(newValue);

        // Simple regex to detect if user is typing a mention at the end or valid position
        // Check for @ followed by non-whitespace chars at the end of string or cursor position
        // For simplicity, we'll check the last word
        const lastWordMatch = newValue.match(/@(\S*)$/);

        if (lastWordMatch) {
            setShowMentions(true);
            setMentionQuery(lastWordMatch[1]);
            setMentionIndex(0); // Reset selection
        } else {
            setShowMentions(false);
        }
    };

    const handleMentionSelect = (filename: string) => {
        // Replace the partial mention with the full path
        const newValue = input.replace(/@(\S*)$/, `@/${filename} `);
        setInput(newValue);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const filteredFiles = files.filter(f => f.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5); // Limit to 5 results

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions && filteredFiles.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev > 0 ? prev - 1 : filteredFiles.length - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev < filteredFiles.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleMentionSelect(filteredFiles[mentionIndex]);
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const getToolIcon = (name: string) => {
        switch (name) {
            case 'run_command': return <Terminal className="w-3 h-3 text-amber-400" />;
            case 'read_file':
            case 'write_file':
            case 'edit_file':
            case 'undo_change':
            case 'list_directory': return <FileText className="w-3 h-3 text-blue-400" />;
            case 'search_code': return <Search className="w-3 h-3 text-green-400" />;
            default: return <Code className="w-3 h-3 text-slate-400" />;
        }
    };

    const getToolSummary = (act: ToolLog) => {
        try {
            switch (act.toolName) {
                case 'run_command': return act.input.command;
                case 'read_file': return `Read ${act.input.path}`;
                case 'write_file': return `Update ${act.input.path}`;
                case 'edit_file': return `Edit ${act.input.path} (lines ${act.input.start_line}-${act.input.end_line})`;
                case 'undo_change': return `Revert ${act.input.path}`;
                case 'list_directory': return `List ${act.input.path}`;
                case 'search_code': return `Search "${act.input.query}"`;
                default: return JSON.stringify(act.input).substring(0, 50);
            }
        } catch (e) {
            return 'Processing...';
        }
    };

    const handleUndo = async (path: string, diff: string) => {
        // Create a synthetic user message for "Undo"
        const undoMessageId = crypto.randomUUID();
        const undoText = `Undo changes to ${path}`;

        const undoMsg: Message = {
            id: undoMessageId,
            role: 'user',
            content: undoText,
            timestamp: new Date(),
            status: 'complete'
        };

        setMessages((prev) => [...prev, undoMsg]);
        setIsLoading(true);

        // Create a synthetic assistant message to show the action
        const assistantMessageId = crypto.randomUUID();
        const assistantMsg: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming', // Start as streaming/running
            toolActivity: [{
                toolName: 'undo_change', // Custom internal tool name for display
                input: { path },
                status: 'running',
                result: ''
            }]
        };

        setMessages((prev) => [...prev, assistantMsg]);

        try {
            const response = await fetch('/api/agent/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flyAppName,
                    path,
                    diff // Send the diff to revert
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to undo changes');
            }

            // Update success state
            setMessages((prev) =>
                prev.map(msg => {
                    if (msg.id !== assistantMessageId) return msg;
                    return {
                        ...msg,
                        status: 'complete',
                        toolActivity: [{
                            toolName: 'undo_change',
                            input: { path },
                            status: 'complete',
                            result: 'Successfully reverted changes.' // Simple success message
                        }],
                        content: `Reverted ${path} to its previous state.`
                    };
                })
            );

        } catch (error: any) {
            console.error('Error undoing:', error);
            // Update error state
            setMessages((prev) =>
                prev.map(msg => {
                    if (msg.id !== assistantMessageId) return msg;
                    return {
                        ...msg,
                        status: 'error',
                        toolActivity: [{
                            toolName: 'undo_change',
                            input: { path },
                            status: 'error',
                            result: error.message
                        }],
                        content: `Failed to undo changes: ${error.message}`
                    };
                })
            );
        } finally {
            setIsLoading(false);
        }
    };

    const processResponseStream = async (response: Response, assistantMessageId: string) => {
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to get response');
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Mark assistant message as streaming
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === assistantMessageId
                    ? { ...msg, status: 'streaming' }
                    : msg
            )
        );

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const event = JSON.parse(line);

                    // Handle file_changed events directly (bypass realtime)
                    if (event.type === 'file_changed' && onFileChanged) {
                        console.log(`[AgentChat] 📄 File changed: ${event.path}`);
                        onFileChanged(event.path, event.content);
                    }

                    // Handle agent_complete to trigger file list refresh
                    if (event.type === 'agent_complete' && onFileChanged) {
                        console.log('[AgentChat] 🤖 Agent complete, triggering refresh');
                        // Signal to refresh file list (pass empty path as signal)
                        onFileChanged('__REFRESH__', '');
                    }

                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== assistantMessageId) return msg;

                            const updatedMsg = { ...msg };

                            if (event.type === 'thought') {
                                updatedMsg.reasoning = (updatedMsg.reasoning || '') + event.content;
                            } else if (event.type === 'tool_start') {
                                const newTool: ToolLog = {
                                    toolName: event.tool,
                                    input: event.input,
                                    status: 'running',
                                    result: ''
                                };
                                updatedMsg.toolActivity = [...(updatedMsg.toolActivity || []), newTool];
                            } else if (event.type === 'tool_result') {
                                if (updatedMsg.toolActivity && updatedMsg.toolActivity.length > 0) {
                                    const lastTool = updatedMsg.toolActivity[updatedMsg.toolActivity.length - 1];
                                    lastTool.status = 'complete';
                                    lastTool.result = event.result;
                                    updatedMsg.toolActivity = [...updatedMsg.toolActivity];
                                }
                            } else if (event.type === 'response_chunk') {
                                updatedMsg.content += event.content;
                            } else if (event.type === 'response') {
                                updatedMsg.status = 'complete';
                            } else if (event.type === 'error') {
                                updatedMsg.content += `\n❌ Error: ${event.error}`;
                                updatedMsg.status = 'error';
                            }

                            return updatedMsg;
                        })
                    );
                } catch (e) {
                    console.warn('Error parsing stream line:', e);
                }
            }
        }
        setIsLoading(false);
    }


    const sendMessage = async () => {
        if (!input.trim() || isLoading || !containerReady) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input,
            timestamp: new Date(),
            status: 'complete',
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const assistantMessageId = crypto.randomUUID();
        setMessages((prev) => [
            ...prev,
            {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                status: 'pending',
            },
        ]);

        try {
            const conversationHistory = messages
                .filter(m => m.content.trim() !== '' || (m.toolActivity && m.toolActivity.length > 0) || m.reasoning)
                .map(m => ({
                    role: m.role,
                    content: m.content.trim() || (m.role === 'assistant' ? "I've processed your request using tools." : "Continuing...")
                }));

            const response = await fetch('/api/agent/chat-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: input,
                    flyAppName,
                    conversationHistory
                }),
                // Important: No client-side timeout - let the stream continue
                // The server has a 5-minute maxDuration which is appropriate for agent tasks
            });

            await processResponseStream(response, assistantMessageId);

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get response from agent';
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: msg.content || `❌ Error: ${errorMessage}`,
                            status: 'error',
                        }
                        : msg
                )
            );
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] text-neutral-200 font-sans selection:bg-white/10">
            {/* Header */}
            {!hideHeader && (
                <div className="bg-[#151515]/80 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src="/images/claude-logo.png" className="w-6 h-6 object-contain" alt="Claude Logo" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold tracking-tight text-white uppercase flex items-center gap-2">
                                    Claude Code
                                </h2>
                                {!containerReady && (
                                    <span className="text-[10px] text-amber-400/80 font-medium">Initializing Environment...</span>
                                )}
                            </div>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto">
                        <div className="w-20 h-20 rounded-full bg-[#D97757]/10 flex items-center justify-center border border-[#D97757]/20 shadow-[0_0_30px_rgba(217,119,87,0.1)]">
                            <img src="/images/claude-logo.png" className="w-10 h-10 object-contain" alt="Claude" />
                        </div>
                        <div>
                            <p className="text-2xl font-semibold text-white font-serif italic">
                                How can I help you today?
                            </p>
                            <p className="text-slate-400 mt-3 text-sm leading-relaxed max-w-xs mx-auto">
                                I'm Claude, your AI coding assistant. I can help you build, debug, and understand complex codebases.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
                    >
                        <div
                            className={`group relative max-w-[92%] sm:max-w-[85%] rounded-3xl px-5 py-4 transition-all duration-300 ${message.role === 'user'
                                ? 'bg-white text-black rounded-br-none'
                                : 'bg-[#111111] text-neutral-200 rounded-bl-none border border-white/5'
                                }`}
                        >
                            <div className="flex flex-col space-y-3 min-w-0">
                                {/* Reasoning / Thinking Block */}
                                {message.reasoning && (
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 relative overflow-hidden group/thinking">
                                        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                            <div className="w-1 h-1 rounded-full bg-white/50 animate-pulse" />
                                            Thinking
                                        </div>
                                        <div className="text-xs text-slate-400/90 italic leading-relaxed break-words font-mono line-clamp-[10] group-hover/thinking:line-clamp-none transition-all cursor-pointer">
                                            {message.reasoning}
                                        </div>
                                    </div>
                                )}

                                {/* Tools Execution Block */}
                                {message.toolActivity && message.toolActivity.length > 0 && (
                                    <div className="space-y-2 max-w-full overflow-hidden">
                                        <div className="flex items-center gap-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <Terminal className="w-3 h-3" />
                                            Active Processes
                                        </div>
                                        <div className="space-y-1.5 max-w-full">
                                            {message.toolActivity.map((act, i) => (
                                                <div key={i} className="flex flex-col bg-black/40 rounded-xl border border-white/5 overflow-hidden transition-all hover:border-white/10 max-w-full">
                                                    <div className="flex items-center gap-3 p-2.5">
                                                        <div className={`p-1.5 rounded-lg ${act.status === 'running' ? 'bg-white/5' : 'bg-white/5'}`}>
                                                            {act.status === 'running' ? (
                                                                <Loader2 className="w-3 h-3 animate-spin text-white/40" />
                                                            ) : (
                                                                getToolIcon(act.toolName)
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0 overflow-hidden">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold font-mono text-white/60">{act.toolName}</span>
                                                                {act.status === 'running' && <span className="text-[9px] text-neutral-500 font-medium animate-pulse">EXECUTING...</span>}
                                                            </div>
                                                            <span className="text-[10px] text-neutral-400 block truncate font-mono opacity-80">{getToolSummary(act)}</span>
                                                        </div>
                                                    </div>

                                                    {(act.toolName === 'write_file' || act.toolName === 'edit_file') && act.result && act.status === 'complete' ? (
                                                        (() => {
                                                            let diff = null;
                                                            try {
                                                                const parsed = JSON.parse(act.result);
                                                                diff = parsed.diff;
                                                            } catch (e) {
                                                                diff = null;
                                                            }

                                                            if (diff) {
                                                                return (
                                                                    <div className="px-2 pb-2 mt-1 w-full overflow-hidden">
                                                                        <details className="group/diff bg-black/60 rounded-xl border border-white/5 overflow-hidden shadow-2xl">
                                                                            <summary className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-white/5 transition-colors">
                                                                                <span className="text-[10px] font-bold text-slate-500 group-hover/diff:text-slate-300 tracking-tighter uppercase">Diff</span>
                                                                                <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-open/diff:rotate-180 transition-transform" />
                                                                            </summary>
                                                                            <div className="border-t border-white/5 overflow-hidden">
                                                                                <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-white/10">
                                                                                    <table className="w-full border-collapse text-[10px] font-mono leading-relaxed">
                                                                                        <tbody>
                                                                                            {diff.split('\n').map((line: string, idx: number) => {
                                                                                                if (!line && idx === diff.split('\n').length - 1) return null;

                                                                                                let colorClass = 'text-slate-500';
                                                                                                let bgClass = '';
                                                                                                if (line.startsWith('+')) {
                                                                                                    colorClass = 'text-emerald-400';
                                                                                                    bgClass = 'bg-emerald-500/10';
                                                                                                } else if (line.startsWith('-')) {
                                                                                                    colorClass = 'text-rose-400';
                                                                                                    bgClass = 'bg-rose-500/10';
                                                                                                } else if (line.startsWith('@@')) {
                                                                                                    colorClass = 'text-blue-400';
                                                                                                    bgClass = 'bg-blue-500/5';
                                                                                                }

                                                                                                return (
                                                                                                    <tr key={idx} className={`${bgClass} group/line hover:bg-white/5 transition-colors`}>
                                                                                                        <td className="w-10 shrink-0 select-none text-slate-700 text-right pr-3 border-r border-white/5 py-0.5 align-top group-hover/line:text-slate-500">
                                                                                                            {idx + 1}
                                                                                                        </td>
                                                                                                        <td className={`${colorClass} pl-3 py-0.5 break-all whitespace-pre-wrap font-mono`}>
                                                                                                            {line}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                                <div className="flex justify-end p-2 bg-black/40 border-t border-white/5">
                                                                                    <button
                                                                                        onClick={() => handleUndo(act.input.path, diff || '')}
                                                                                        disabled={isLoading}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 rounded-lg text-[10px] font-bold text-black transition-all disabled:opacity-50"
                                                                                    >
                                                                                        <RotateCcw className="w-3 h-3" />
                                                                                        REVERT CHANGES
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()
                                                    ) : act.result && (
                                                        <div className="px-2 pb-2 mt-1 w-full overflow-hidden">
                                                            <details className="group/result bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                                                                <summary className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-white/5 transition-colors">
                                                                    <span className="text-[10px] font-bold text-slate-500 group-hover/result:text-slate-300 tracking-tighter uppercase">
                                                                        {act.toolName === 'read_file' ? 'FILE CONTENT' : 'COMMAND OUTPUT'}
                                                                    </span>
                                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-open/result:rotate-180 transition-transform" />
                                                                </summary>
                                                                <div className="p-0 border-t border-white/5 backdrop-blur-sm shadow-inner">
                                                                    <div className="p-4 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                                                        <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                                                            {act.result.length > 5000 ? act.result.substring(0, 5000) + '... (truncated)' : act.result}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            </details>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Main Text Content */}
                                {message.content && (
                                    <div className={`text-sm leading-relaxed ${message.role === 'user' ? 'font-medium' : ''} break-words min-w-0`}>
                                        {message.content.split('```').map((block, i) => {
                                            if (i % 2 === 1) {
                                                const lines = block.split('\n');
                                                const lang = lines[0].trim();
                                                const code = lines.slice(1).join('\n').trim();
                                                return (
                                                    <div key={i} className="my-4 bg-black/40 rounded-xl overflow-hidden border border-white/10 max-w-full">
                                                        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{lang || 'code'}</span>
                                                            <button
                                                                onClick={() => navigator.clipboard.writeText(code)}
                                                                className="p-1 text-slate-500 hover:text-white transition-colors"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <pre className="p-4 text-xs font-mono overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 max-w-full">
                                                            <code className="break-normal whitespace-pre">{code}</code>
                                                        </pre>
                                                    </div>
                                                );
                                            }
                                            return <p key={i} className="whitespace-pre-wrap break-words">{block}</p>;
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Status Indicators */}
                            {(message.status === 'streaming' || message.status === 'pending') && (
                                <div className="absolute -bottom-1 -right-1">
                                    <div className="flex space-x-0.5 bg-neutral-800 p-1.5 rounded-full shadow-lg border border-white/10">
                                        <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                                    </div>
                                </div>
                            )}

                            {message.status === 'error' && (
                                <div className="absolute -bottom-2 -right-2 bg-rose-500 p-1.5 rounded-full shadow-lg border border-white/20">
                                    <XCircle className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                        <span className="mt-1.5 px-3 text-[9px] font-bold text-slate-500/50 uppercase tracking-widest">
                            {message.role === 'user' ? 'You' : 'Claude'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input */}
            <div className="bg-slate-900 border-t border-white/5 p-4 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                {/* Mention Popup */}
                {showMentions && filteredFiles.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-3 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-[10px] font-bold text-slate-500 px-4 py-2.5 bg-white/5 border-b border-white/5 uppercase tracking-widest">
                            Contextual Assets
                        </div>
                        <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {filteredFiles.map((file, i) => {
                                const parts = file.split('/');
                                const fileName = parts.pop();
                                const dirPath = parts.join('/');

                                return (
                                    <button
                                        key={file}
                                        onClick={() => handleMentionSelect(file)}
                                        className={`w-full text-left px-4 py-3 transition-all ${i === mentionIndex
                                            ? 'bg-white/10 text-white'
                                            : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-bold truncate">{fileName}</span>
                                            {dirPath && (
                                                <span className="text-[10px] opacity-40 truncate font-mono">{dirPath}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="max-w-4xl mx-auto flex gap-4 items-end relative">
                    <div className="flex-1 relative group">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                containerReady
                                    ? 'Use @ for files'
                                    : 'Environmental latency detecting...'
                            }
                            disabled={isLoading || !containerReady}
                            rows={1}
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10 transition-all disabled:opacity-50 resize-none overflow-hidden min-h-[56px] max-h-[400px]"
                            style={{ height: 'auto' }}
                        />

                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !input.trim() || !containerReady}
                        className="h-14 w-14 shrink-0 bg-[#D97757] hover:bg-[#C86A4C] disabled:opacity-20 disabled:grayscale text-white rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-[#D97757]/20 active:scale-90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5 fill-current" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
