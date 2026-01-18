'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, CheckCircle2, XCircle, X, Terminal, FileText, Search, Code, Cpu, ChevronDown, ChevronRight } from 'lucide-react';

interface ToolLog {
    toolName: string;
    input: any;
    result: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    status?: 'pending' | 'complete' | 'error';
    toolActivity?: ToolLog[];
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
        switch (act.toolName) {
            case 'run_command': return act.input.command;
            case 'read_file': return `Read ${act.input.path}`;
            case 'write_file': return `Wrote to ${act.input.path}`;
            case 'list_directory': return `List ${act.input.path}`;
            case 'search_code': return `Search "${act.input.query}"`;
            default: return JSON.stringify(act.input).substring(0, 50);
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
            // Build conversation history for context (exclude pending/last user msg)
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get response');
            }

            // Update assistant message with response
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: data.response,
                            status: 'complete',
                            toolActivity: data.toolActivity
                        }
                        : msg
                )
            );

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get response from agent';
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: `❌ Error: ${errorMessage}`,
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
                                    {message.toolActivity && message.toolActivity.length > 0 && (
                                        <div className="mb-3 bg-slate-900/40 rounded-lg overflow-hidden border border-slate-700/50">
                                            <div className="p-2 space-y-1.5">
                                                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                    <Cpu className="w-3 h-3" />
                                                    Agent Thoughts
                                                </div>
                                                {message.toolActivity.map((act, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-300 bg-slate-900/50 p-1.5 rounded border border-slate-800">
                                                        <span className="mt-0.5 shrink-0">{getToolIcon(act.toolName)}</span>
                                                        <div className="flex-1 overflow-hidden break-all">
                                                            <span className="text-blue-400 mr-2 font-semibold">{act.toolName}</span>
                                                            <span className="opacity-75">{getToolSummary(act)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>
                                {message.status === 'pending' && (
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
