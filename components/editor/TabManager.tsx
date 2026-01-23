'use client';

import React from 'react';
import { X, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface Tab {
    id: string;
    name: string;
    isDirty?: boolean;
}

interface TabManagerProps {
    tabs: Tab[];
    activeTabId: string;
    onSelect: (tabId: string) => void;
    onClose: (tabId: string) => void;
}

export function TabManager({ tabs, activeTabId, onSelect, onClose }: TabManagerProps) {
    if (tabs.length === 0) return null;

    return (
        <div className="bg-slate-900 border-b border-slate-800 flex overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="flex h-10">
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        return (
                            <div
                                key={tab.id}
                                className={cn(
                                    "relative min-w-[120px] max-w-[200px] flex items-center justify-between px-3 h-full cursor-pointer border-r border-slate-800 text-xs font-medium transition-all group",
                                    isActive
                                        ? "bg-slate-800 text-slate-100 border-t-2 border-t-blue-500"
                                        : "bg-slate-900/50 text-slate-400 hover:bg-slate-800/80 hover:text-slate-300"
                                )}
                                onClick={() => onSelect(tab.id)}
                            >
                                <div className="flex items-center gap-2 truncate pr-4">
                                    <FileCode className={cn("h-3.5 w-3.5", isActive ? "text-blue-400" : "text-slate-500")} />
                                    <span className="truncate">{tab.name}</span>
                                    {tab.isDirty && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-1" />
                                    )}
                                </div>

                                <button
                                    className={cn(
                                        "p-0.5 rounded-md hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100",
                                        isActive && "opacity-100"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose(tab.id);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
