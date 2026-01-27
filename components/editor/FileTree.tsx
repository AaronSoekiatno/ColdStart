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
    const [dimensions, setDimensions] = React.useState({ width: 260, height: 800 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="h-full w-full bg-slate-900 text-slate-400 select-none overflow-hidden">
            <Tree
                initialData={data}
                openByDefault={true}
                width={dimensions.width || 300}
                height={dimensions.height || 500}
                indent={20}
                rowHeight={36}
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
                                isActive ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-500" : "hover:bg-slate-800 hover:text-slate-200"
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
                                        <ChevronDown className="h-5 w-5 shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5 shrink-0" />
                                    )}
                                    <Folder className="h-5 w-5 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
                                </>
                            ) : (
                                <>
                                    <div className="w-5 h-5" />
                                    <File className="h-5 w-5 text-slate-500" />
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
