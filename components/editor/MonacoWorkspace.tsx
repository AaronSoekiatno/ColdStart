'use client';

import React, { useState, useEffect } from 'react';
import { MonacoEditor } from './MonacoEditor';
import { FileTree, FileNode } from './FileTree';
import { TabManager, Tab } from './TabManager';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonacoWorkspaceProps {
    sessionId: string;
}

export function MonacoWorkspace({ sessionId }: MonacoWorkspaceProps) {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');
    const [fileContents, setFileContents] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchFileList();
    }, [sessionId]);

    const fetchFileList = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch(`/api/files/list?sessionId=${sessionId}`);
            const data = await resp.json();
            if (data.files) {
                setFiles(data.files);
            }
        } catch (err) {
            console.error('Failed to fetch files:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = async (node: FileNode) => {
        // Add to tabs if not already there
        if (!openTabs.find(t => t.id === node.id)) {
            setOpenTabs(prev => [...prev, { id: node.id, name: node.name }]);
        }

        setActiveTabId(node.id);

        // Fetch content if not cached
        if (fileContents[node.id] === undefined) {
            try {
                const resp = await fetch(`/api/files/read?sessionId=${sessionId}&path=${node.id}`);
                const data = await resp.json();
                setFileContents(prev => ({ ...prev, [node.id]: data.content || '' }));
            } catch (err) {
                console.error('Failed to read file:', err);
            }
        }
    };

    const handleTabClose = (tabId: string) => {
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
        <div className="flex h-full bg-slate-950 text-slate-200 overflow-hidden border border-slate-800 rounded-xl shadow-2xl">
            <Group orientation="horizontal">
                {/* Left Sidebar: File Tree */}
                <Panel defaultSize={20} minSize={15} maxSize={40}>
                    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
                        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Explorer</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300" onClick={fetchFileList}>
                                <RefreshCw className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <FileTree
                                data={files}
                                onSelect={handleFileSelect}
                                activeFileId={activeTabId}
                            />
                        </div>
                    </div>
                </Panel>

                <Separator className="w-1 bg-slate-800 hover:bg-blue-500/50 transition-colors cursor-col-resize" />

                {/* Right Content: Editor */}
                <Panel defaultSize={80}>
                    <div className="flex flex-col h-full">
                        <TabManager
                            tabs={openTabs}
                            activeTabId={activeTabId}
                            onSelect={setActiveTabId}
                            onClose={handleTabClose}
                        />
                        <div className="flex-1 overflow-hidden relative">
                            {activeTabId ? (
                                <MonacoEditor
                                    path={activeTabId}
                                    value={fileContents[activeTabId] || ''}
                                    onChange={handleContentChange}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500 italic">
                                    Select a file from the explorer to start editing
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>
            </Group>
        </div>
    );
}
