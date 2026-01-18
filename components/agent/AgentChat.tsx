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
}

export default function AgentChat({ sessionId, flyAppName, containerReady, onClose }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // File referencing state
    const [files, setFiles] = useState<string[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0); // For keyboard navigation
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    // Handle input changes for mentions
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        } else if (e.key === 'Enter') {
            sendMessage();
        }
    };

    const getToolIcon = (name: string) => {
        switch (name) {
            case 'run_command': return <Terminal className="w-3 h-3 text-amber-400" />;
            case 'read_file':
            case 'write_file':
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
                case 'undo_change': return `Revert ${act.input.path}`;
                case 'list_directory': return `List ${act.input.path}`;
                case 'search_code': return `Search "${act.input.query}"`;
                default: return JSON.stringify(act.input).substring(0, 50);
            }
        } catch (e) {
            return 'Processing...';
        }
    };

    const handleUndo = async (path: string, originalContent: string) => {
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
                    content: originalContent || '' // Ensure string
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
            const conversationHistory = messages.map(m => ({
                role: m.role,
                content: m.content
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
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                        <h2 className="text-lg font-semibold text-white">AI Coding Agent</h2>
                        {!containerReady && (
                            <span className="text-xs text-amber-400">Container starting...</span>
                        )}
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 mt-12">
                        <p className="text-lg mb-2">👋 Hi! I'm your AI coding assistant</p>
                        <p className="text-sm">
                            Ask me to write code, fix bugs, or explain concepts
                        </p>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800/50 backdrop-blur-sm text-slate-100 border border-slate-700/50'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    {/* Reasoning Block */}
                                    {message.reasoning && (
                                        <div className="mb-3 text-sm text-slate-400 italic border-l-2 border-slate-700 pl-3">
                                            {message.reasoning}
                                        </div>
                                    )}

                                    {message.toolActivity && message.toolActivity.length > 0 && (
                                        <div className="mb-3 bg-slate-900/40 rounded-lg overflow-hidden border border-slate-700/50">
                                            <div className="p-2 space-y-1.5">
                                                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                    <Cpu className="w-3 h-3" />
                                                    Process
                                                </div>
                                                {message.toolActivity.map((act, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-300 bg-slate-900/50 p-1.5 rounded border border-slate-800">
                                                        <span className="mt-0.5 shrink-0">
                                                            {act.status === 'running' ? (
                                                                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                                            ) : (
                                                                getToolIcon(act.toolName)
                                                            )}
                                                        </span>
                                                        <div className="flex-1 overflow-hidden break-all">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-blue-400 font-bold">{act.toolName}</span>
                                                                {act.status === 'running' && <span className="text-xs text-slate-500 italic">running...</span>}
                                                            </div>
                                                            <span className="opacity-75 block">{getToolSummary(act)}</span>
                                                            {act.toolName === 'write_file' && act.result && act.status === 'complete' ? (
                                                                (() => {
                                                                    let diff = null;
                                                                    let originalContent = '';
                                                                    try {
                                                                        const parsed = JSON.parse(act.result);
                                                                        diff = parsed.diff;
                                                                        originalContent = parsed.originalContent;
                                                                    } catch (e) {
                                                                        // Legacy or error result
                                                                        diff = null;
                                                                    }

                                                                    if (diff) {
                                                                        return (
                                                                            <div className="mt-2">
                                                                                <details open className="group">
                                                                                    <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none flex items-center gap-2">
                                                                                        <span>Show Diff</span>
                                                                                        <div className="flex-1 border-b border-slate-700/50 relative top-[1px]" />
                                                                                    </summary>
                                                                                    <div className="relative mt-2">
                                                                                        <pre className="bg-black/40 p-2 rounded-md text-[10px] font-mono overflow-x-auto">
                                                                                            {diff.split('\n').map((line: string, i: number) => {
                                                                                                let colorClass = 'text-slate-400';
                                                                                                if (line.startsWith('+')) colorClass = 'text-green-400 bg-green-900/10 block w-full';
                                                                                                if (line.startsWith('-')) colorClass = 'text-red-400 bg-red-900/10 block w-full';
                                                                                                if (line.startsWith('Index:') || line.startsWith('===')) colorClass = 'text-slate-500 italic';
                                                                                                return (
                                                                                                    <span key={i} className={colorClass}>
                                                                                                        {line}{'\n'}
                                                                                                    </span>
                                                                                                );
                                                                                            })}
                                                                                        </pre>
                                                                                        <div className="flex justify-end mt-2">
                                                                                            <button
                                                                                                onClick={() => handleUndo(act.input.path, originalContent)}
                                                                                                disabled={isLoading}
                                                                                                className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-300 transition-colors disabled:opacity-50"
                                                                                            >
                                                                                                <RotateCcw className="w-3 h-3" />
                                                                                                <span>Undo Change</span>
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                </details>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    // Fallback for non-JSON result
                                                                    return (
                                                                        <details className="mt-1">
                                                                            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none">Show Result</summary>
                                                                            <pre className="mt-1 bg-black/30 p-1 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-20">
                                                                                {act.result.substring(0, 300) + (act.result.length > 300 ? '...' : '')}
                                                                            </pre>
                                                                        </details>
                                                                    );
                                                                })()
                                                            ) : (
                                                                act.result && (
                                                                    <details className="mt-1">
                                                                        <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none">Show Result</summary>
                                                                        <pre className="mt-1 bg-black/30 p-1 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-20">
                                                                            {act.result.substring(0, 300) + (act.result.length > 300 ? '...' : '')}
                                                                        </pre>
                                                                    </details>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>
                                {message.status === 'pending' || message.status === 'streaming' && (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                )}
                                {message.status === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                )}
                            </div>
                            <p className="text-xs opacity-60 mt-1">
                                {message.timestamp.toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-slate-800/50 backdrop-blur-sm border-t border-slate-700/50 p-4 relative">
                {/* Mention Popup */}
                {showMentions && filteredFiles.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                        <div className="text-xs font-semibold text-slate-500 px-3 py-2 bg-slate-900/50 border-b border-slate-700">
                            Select File
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {filteredFiles.map((file, i) => (
                                <button
                                    key={file}
                                    onClick={() => handleMentionSelect(file)}
                                    className={`w-full text-left px-3 py-2 text-xs truncate transition-colors ${i === mentionIndex
                                            ? 'bg-blue-600/20 text-blue-300'
                                            : 'text-slate-300 hover:bg-slate-700/50'
                                        }`}
                                >
                                    {file}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            containerReady
                                ? 'Ask me anything... (Use @ to reference files)'
                                : 'Waiting for container...'
                        }
                        disabled={isLoading || !containerReady}
                        className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !input.trim() || !containerReady}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 font-medium transition-all flex items-center justify-center"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
