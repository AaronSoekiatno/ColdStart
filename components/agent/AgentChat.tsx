'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, CheckCircle2, XCircle, X, Terminal, FileText, Search, Code, Cpu, ChevronDown, ChevronRight } from 'lucide-react';

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getToolIcon = (name: string) => {
        switch (name) {
            case 'run_command': return <Terminal className="w-3 h-3 text-amber-400" />;
            case 'read_file':
            case 'write_file':
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
                case 'write_file': return `Write ${act.input.path}`;
                case 'list_directory': return `List ${act.input.path}`;
                case 'search_code': return `Search "${act.input.query}"`;
                default: return JSON.stringify(act.input).substring(0, 50);
            }
        } catch (e) {
            return 'Processing...';
        }
    };

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

        // Create pending assistant message
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
                buffer = lines.pop() || ''; // Keep the incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const event = JSON.parse(line);

                        setMessages((prev) =>
                            prev.map((msg) => {
                                if (msg.id !== assistantMessageId) return msg;

                                const updatedMsg = { ...msg };

                                if (event.type === 'thought') {
                                    // Append thought to reasoning
                                    updatedMsg.reasoning = (updatedMsg.reasoning || '') + event.content;
                                } else if (event.type === 'tool_start') {
                                    // Add new tool log
                                    const newTool: ToolLog = {
                                        toolName: event.tool,
                                        input: event.input,
                                        status: 'running',
                                        result: ''
                                    };
                                    updatedMsg.toolActivity = [...(updatedMsg.toolActivity || []), newTool];
                                } else if (event.type === 'tool_result') {
                                    // Update last tool log
                                    if (updatedMsg.toolActivity && updatedMsg.toolActivity.length > 0) {
                                        const lastTool = updatedMsg.toolActivity[updatedMsg.toolActivity.length - 1];
                                        lastTool.status = 'complete';
                                        lastTool.result = event.result;
                                        // Force update of the array reference
                                        updatedMsg.toolActivity = [...updatedMsg.toolActivity];
                                    }
                                } else if (event.type === 'response_chunk') {
                                    // Append to content
                                    updatedMsg.content += event.content;
                                } else if (event.type === 'response') {
                                    // Final replacement (optional, if we want to ensure consistency)
                                    // updatedMsg.content = event.content;
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
        } finally {
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
                                                            {act.result && (
                                                                <details className="mt-1">
                                                                    <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none">Show Result</summary>
                                                                    <pre className="mt-1 bg-black/30 p-1 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-20">
                                                                        {act.result.substring(0, 300) + (act.result.length > 300 ? '...' : '')}
                                                                    </pre>
                                                                </details>
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
            <div className="bg-slate-800/50 backdrop-blur-sm border-t border-slate-700/50 p-4">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={
                            containerReady
                                ? 'Ask me anything...'
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
