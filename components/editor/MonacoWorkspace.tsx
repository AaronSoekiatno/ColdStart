'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FileTree, FileNode } from './FileTree';
import { TabManager, Tab } from './TabManager';
// Used flexbox instead of react-resizable-panels for stability
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

import AgentChat from '@/components/agent/AgentChat';
import { ExternalLink, Eye, EyeOff, MessageSquare, X } from 'lucide-react';
import { WelcomeBriefing } from '../assessment/WelcomeBriefing';

interface MonacoWorkspaceProps {
    sessionId: string;
    showPreview: boolean;
    setShowPreview: (show: boolean) => void;
    showAgentChat: boolean;
    setShowAgentChat: (show: boolean) => void;
    containerUrl: string | null;
    flyAppName: string | null;
    containerReady: boolean;
    onLoad?: () => void;
}

export function MonacoWorkspace({
    sessionId,
    showPreview,
    setShowPreview,
    showAgentChat,
    setShowAgentChat,
    containerUrl,
    flyAppName,
    containerReady,
    onLoad
}: MonacoWorkspaceProps) {
    const { toast } = useToast();
    const [previewKey, setPreviewKey] = useState(0);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [openTabs, setOpenTabs] = useState<Tab[]>([
        { id: 'instructions', name: 'Instructions', isPermanent: true }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>('instructions');
    const [fileContents, setFileContents] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const openTabsRef = React.useRef<Tab[]>(openTabs);
    const [realtimeAvailable, setRealtimeAvailable] = React.useState<boolean>(true);

    // Keep ref in sync with state
    useEffect(() => {
        openTabsRef.current = openTabs;
    }, [openTabs]);

    // DEFINE CALLBACKS FIRST (before useEffects that depend on them)
    const fetchFileList = useCallback(async (preloadContents: boolean = true) => {
        // Only show loading spinner on initial load (with preload)
        // For background refreshes, don't show loading to avoid cutting off the agent
        if (preloadContents) {
            setIsLoading(true);
        }

        try {
            // 1. Fetch File List (Tree)
            const resp = await fetch(`/api/files/list?sessionId=${sessionId}`);
            const data = await resp.json();
            if (data.files) {
                setFiles(data.files);
            }

            // 2. Fetch All File Contents (Background Preload) - Only on initial load
            // This allows instant clicking without waiting for individual fetches
            if (preloadContents) {
                fetch(`/api/files/read-all?sessionId=${sessionId}`)
                    .then(r => r.json())
                    .then(contentData => {
                        if (contentData.files) {
                            console.log(`[MonacoWorkspace] Preloaded ${Object.keys(contentData.files).length} files`);
                            setFileContents(prev => ({ ...prev, ...contentData.files }));
                        }
                    })
                    .catch(err => console.error('Failed to preload files:', err));
            }

        } catch (err) {
            console.error('Failed to fetch files:', err);
        } finally {
            // Only clear loading if we set it
            if (preloadContents) {
                setIsLoading(false);
                if (onLoad) onLoad();
            }
        }
    }, [sessionId]);

    const fetchFileContent = useCallback(async (fileId: string) => {
        try {
            const resp = await fetch(`/api/files/read?sessionId=${sessionId}&path=${fileId}`);
            const data = await resp.json();
            return data.content || '';
        } catch (err) {
            console.error('Failed to read file:', err);
            return null;
        }
    }, [sessionId]);

    // Handler for direct file updates from agent (bypasses realtime)
    const handleFileChanged = useCallback((path: string, content: string) => {
        // Special signal to refresh file tree
        if (path === '__REFRESH__') {
            console.log('[MonacoWorkspace] 🤖 Agent complete, refreshing file list');
            fetchFileList(false);
            return;
        }

        console.log(`[MonacoWorkspace] 📄 Direct file update received: ${path}`);

        // Update file contents cache
        setFileContents(prev => ({ ...prev, [path]: content }));

        // Mark tab as clean (since this is from the agent, not user edits)
        setOpenTabs(prev => prev.map(t => t.id === path ? { ...t, isDirty: false } : t));
    }, [fetchFileList]);

    // USEEFFECTS AFTER CALLBACKS ARE DEFINED
    useEffect(() => {
        fetchFileList();

        // Cleanup timers on unmount
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [fetchFileList]);

    // Polling fallback when realtime is unavailable
    useEffect(() => {
        if (!realtimeAvailable && sessionId) {
            console.log('[MonacoWorkspace] Realtime unavailable, starting polling fallback...');

            // Poll every 5 seconds to check for file changes
            const pollInterval = setInterval(() => {
                // Only refresh tree, not individual files (to avoid disrupting user edits)
                console.log('[MonacoWorkspace] 🔄 Polling for file tree updates...');
                fetchFileList(false);
            }, 5000);

            pollIntervalRef.current = pollInterval;

            return () => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            };
        }
    }, [realtimeAvailable, sessionId, fetchFileList]);

    // Real-time file updates via Supabase Broadcast
    useEffect(() => {
        if (!sessionId) return;

        console.log(`[MonacoWorkspace] Subscribing to real-time updates for session:${sessionId}`);

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 3;

        const channel = supabase
            .channel(`session:${sessionId}`, {
                config: {
                    broadcast: { self: false },
                    presence: { key: '' }
                }
            })
            .on('broadcast', { event: 'file_update' }, async (payload: any) => {
                console.log('[MonacoWorkspace] ⚡ Received file_update:', payload);
                const { path } = payload.payload;

                // Note: We don't call fetchFileList() here to avoid rebuilding the tree multiple times
                // during agent execution. The tree will be rebuilt once when agent_complete fires.

                // Check if file is currently open
                const isFileOpen = openTabsRef.current.some(t => t.id === path);

                if (isFileOpen) {
                    // It's open: Fetch fresh content immediately to update editor
                    const tab = openTabsRef.current.find(t => t.id === path);
                    if (tab && !tab.isDirty) {
                        console.log(`[MonacoWorkspace] Auto-refreshing open file: ${path}`);
                        const freshContent = await fetchFileContent(path);
                        if (freshContent !== null) {
                            setFileContents(prev => ({ ...prev, [path]: freshContent }));
                        }
                    } else {
                        console.warn(`[MonacoWorkspace] Skipping update for ${path} because it has unsaved user changes.`);
                    }
                } else {
                    // It's closed: Invalidate cache if present
                    // This ensures that when the user DOES open it, we fetch fresh data instead of showing stale cache
                    setFileContents(prev => {
                        if (prev[path] !== undefined) {
                            console.log(`[MonacoWorkspace] Invalidating stale cache for closed file: ${path}`);
                            const next = { ...prev };
                            delete next[path]; // Remove from cache
                            return next;
                        }
                        return prev;
                    });
                }
            })
            .on('broadcast', { event: 'agent_complete' }, () => {
                console.log('[MonacoWorkspace] 🤖 Agent run complete, refreshing file list...');
                // Only fetch tree structure, don't preload all files again
                fetchFileList(false);
            })
            .subscribe((status: any) => {
                console.log(`[MonacoWorkspace] Subscription status: ${status}`);

                // Handle subscription errors gracefully
                if (status === 'CHANNEL_ERROR') {
                    console.error('[MonacoWorkspace] ❌ Realtime channel error - likely hit connection limit');
                    setRealtimeAvailable(false);
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        console.log(`[MonacoWorkspace] Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts}...`);
                        setTimeout(() => {
                            supabase.removeChannel(channel);
                            // Will reconnect on next update
                        }, 5000 * reconnectAttempts); // Exponential backoff
                    } else {
                        console.warn('[MonacoWorkspace] ⚠️ Max reconnect attempts reached. Falling back to polling.');
                        toast({
                            title: 'Using automatic refresh',
                            description: 'File updates will sync every 5 seconds',
                            variant: 'default'
                        });
                    }
                } else if (status === 'TIMED_OUT') {
                    console.warn('[MonacoWorkspace] ⚠️ Realtime subscription timed out');
                    setRealtimeAvailable(false);
                } else if (status === 'SUBSCRIBED') {
                    console.log('[MonacoWorkspace] ✅ Successfully subscribed to realtime updates');
                    setRealtimeAvailable(true);
                    reconnectAttempts = 0; // Reset on successful connection
                }
            });

        return () => {
            console.log('[MonacoWorkspace] Unsubscribing from file updates');
            supabase.removeChannel(channel);
        };
    }, [sessionId, fetchFileList, fetchFileContent]);

    const handleFileSelect = async (node: FileNode) => {
        // Add to tabs if not already there
        if (!openTabs.find(t => t.id === node.id)) {
            setOpenTabs(prev => [...prev, { id: node.id, name: node.name }]);
        }

        setActiveTabId(node.id);

        // OPTIMIZATION: Check if we already have the content in memory
        // Since we use Realtime updates, our local cache should be reasonably fresh.
        // This avoids the 2s fetch delay on every click.
        if (fileContents[node.id] !== undefined) {
            console.log(`[MonacoWorkspace] persisted cache hit for ${node.id}`);
            return;
        }

        // Only fetch if we don't have it
        console.log(`[MonacoWorkspace] fetching missing content for ${node.id}`);
        const content = await fetchFileContent(node.id);
        if (content !== null) {
            setFileContents(prev => ({ ...prev, [node.id]: content }));
            // Mark as clean since we just loaded fresh content
            setOpenTabs(prev => prev.map(t => t.id === node.id ? { ...t, isDirty: false } : t));
        }
    };

    const handleTabClose = (tabId: string) => {
        const tab = openTabs.find(t => t.id === tabId);
        if (tab?.isPermanent) return;

        const newTabs = openTabs.filter(t => t.id !== tabId);
        setOpenTabs(newTabs);
        if (activeTabId === tabId) {
            setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : '');
        }
    };

    const handleContentChange = (value: string | undefined) => {
        if (activeTabId && value !== undefined) {
            setFileContents(prev => ({ ...prev, [activeTabId]: value }));
            // Mark tab as dirty
            setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isDirty: true } : t));

            // Debounced auto-save
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                saveFile(activeTabId, value);
            }, 1000); // Auto-save after 1s of inactivity
        }
    };

    const saveFile = async (path: string, content: string) => {
        if (!content) return; // Don't save empty content if it's just loading

        try {
            const resp = await fetch('/api/files/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, path, content })
            });

            if (resp.ok) {
                // Mark tab as clean
                setOpenTabs(prev => prev.map(t => t.id === path ? { ...t, isDirty: false } : t));
            } else {
                const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
                const errorMessage = errorData.error || 'Failed to save file';

                console.error('Failed to save file:', errorMessage);

                // Show user-friendly error toast
                toast({
                    title: "Failed to save file",
                    description: errorMessage.includes('Connection')
                        ? "Connection to container lost. Your changes will be retried automatically."
                        : `Error saving ${path.split('/').pop()}: ${errorMessage}`,
                    variant: "destructive",
                });

                // Keep tab dirty so user knows it needs to be saved
            }
        } catch (error) {
            console.error('Failed to save file:', error);

            toast({
                title: "Failed to save file",
                description: "Network error. Your changes will be retried automatically.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-400">Loading workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 overflow-hidden relative">
            {/* Left Sidebar: File Tree */}
            <div className="w-[300px] flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 z-10">
                <div className="py-3 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <span className="text-[13px] font-bold uppercase tracking-wider text-slate-400">FILE EXPLORER</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-300" onClick={() => fetchFileList()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-auto min-h-0">
                    <FileTree
                        data={files}
                        onSelect={handleFileSelect}
                        activeFileId={activeTabId}
                    />
                </div>
            </div>

            {/* Right Content: Editor, Preview, and Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">
                <div className="flex-1 flex min-h-0 relative">
                    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800 relative">
                        <TabManager
                            tabs={openTabs}
                            activeTabId={activeTabId}
                            onSelect={setActiveTabId}
                            onClose={handleTabClose}
                        />
                        <div className="flex-1 relative min-h-0 w-full h-full">
                            {activeTabId === 'instructions' ? (
                                <div className="absolute inset-0 bg-[#1e1e1e]">
                                    <WelcomeBriefing />
                                </div>
                            ) : activeTabId ? (
                                <div className="absolute inset-0">
                                    <MonacoEditor
                                        path={activeTabId}
                                        value={fileContents[activeTabId] || ''}
                                        onChange={handleContentChange}
                                        onSave={() => saveFile(activeTabId, fileContents[activeTabId] || '')}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500 italic px-4 text-center bg-slate-900/50">
                                    <div className="max-w-sm">
                                        <p className="mb-2">Select a file from the explorer to start editing</p>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Embedded Preview */}
                    {showPreview && containerUrl && (
                        <div className="w-[40%] flex flex-col bg-slate-900 border-r border-slate-800 animate-in slide-in-from-right duration-300">
                            <div className="h-10 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Eye className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preview</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-500 hover:text-slate-300"
                                        onClick={() => setPreviewKey(k => k + 1)}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <a
                                        href={containerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-500 hover:text-slate-300"
                                        onClick={() => setShowPreview(false)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 bg-white relative">
                                <iframe
                                    key={previewKey}
                                    src={`${containerUrl.endsWith('/') ? containerUrl : `${containerUrl}/`}`}
                                    className="w-full h-full border-none"
                                    title="App Preview"
                                />
                            </div>
                        </div>
                    )}

                    {/* Embedded Agent Chat */}
                    {showAgentChat && (
                        <div className="w-[400px] flex flex-col bg-slate-900 border-l border-slate-800 animate-in slide-in-from-right duration-300">
                            <div className="h-10 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Assistant</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-500 hover:text-slate-300"
                                    onClick={() => setShowAgentChat(false)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <AgentChat
                                    sessionId={sessionId}
                                    flyAppName={flyAppName || ''}
                                    containerReady={containerReady}
                                    onClose={() => setShowAgentChat(false)}
                                    hideHeader={true}
                                    onFileChanged={handleFileChanged}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Terminal Panel (Full Width) */}

            </div>
        </div>
    );
}
