'use client';

import React from 'react';
import { Tree } from 'react-arborist';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
    id: string;
    name: string;
    isOpen?: boolean;
    children?: FileNode[];
    content?: string;
    isFolder?: boolean;
}

interface FileTreeProps {
    data: FileNode[];
    onSelect: (node: FileNode) => void;
    activeFileId?: string;
}

export function FileTree({ data, onSelect, activeFileId }: FileTreeProps) {
    return (
        <div className="h-full bg-slate-900 text-slate-400 select-none">
            <Tree
                initialData={data}
                openByDefault={true}
                width={250}
                height={800} // This should be dynamic or handled by container
                indent={16}
                rowHeight={32}
                overscanCount={5}
                paddingTop={10}
                paddingBottom={10}
            >
                {(props) => {
                    const { node, style, dragHandle } = props;
                    const isActive = node.id === activeFileId;

                    return (
                        <div
                            style={style}
                            ref={dragHandle}
                            className={cn(
                                "flex items-center gap-2 px-2 cursor-pointer transition-colors duration-150",
                                isActive ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500" : "hover:bg-slate-800 hover:text-slate-200"
                            )}
                            onClick={() => {
                                if (!node.data.isFolder) {
                                    onSelect(node.data);
                                } else {
                                    node.toggle();
                                }
                            }}
                        >
                            {node.data.isFolder ? (
                                <>
                                    {node.isOpen ? (
                                        <ChevronDown className="h-4 w-4 shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0" />
                                    )}
                                    <Folder className="h-4 w-4 text-blue-500/80 fill-blue-500/20" />
                                </>
                            ) : (
                                <>
                                    <div className="w-4 h-4" /> {/* Spacer to align with folders */}
                                    <File className="h-4 w-4 text-slate-500" />
                                </>
                            )}
                            <span className="truncate text-sm font-medium">
                                {node.data.name}
                            </span>
                        </div>
                    );
                }}
            </Tree>
        </div>
    );
}
