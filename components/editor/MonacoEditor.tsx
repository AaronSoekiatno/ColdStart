'use client';

import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

interface MonacoEditorProps {
    path: string;
    value: string;
    onChange?: (value: string | undefined) => void;
    onSave?: () => void;
    readOnly?: boolean;
}

export function MonacoEditor({
    path,
    value,
    onChange,
    onSave,
    readOnly = false,
}: MonacoEditorProps) {
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Set up custom theme
        monaco.editor.defineTheme('hermes-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6272a4' },
                { token: 'keyword', foreground: 'ff79c6' },
                { token: 'string', foreground: 'f1fa8c' },
            ],
            colors: {
                'editor.background': '#0f172a', // slate-900
                'editor.foreground': '#f8f8f2',
                'editorLineNumber.foreground': '#475569', // slate-600
                'editorLineNumber.activeForeground': '#94a3b8', // slate-400
                'editor.selectionBackground': '#334155', // slate-700
                'editor.lineHighlightBackground': '#1e293b', // slate-800
                'editorCursor.foreground': '#3b82f6', // blue-500
            },
        });

        monaco.editor.setTheme('hermes-dark');

        // Add keybinding for Save (Cmd+S / Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (onSave) onSave();
        });

        // Configure editor options
        editor.updateOptions({
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            roundedSelection: true,
            automaticLayout: true,
            tabSize: 2,
        });
    };

    const getLanguage = (filePath: string) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'css':
                return 'css';
            case 'html':
                return 'html';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'py':
                return 'python';
            default:
                return 'plaintext';
        }
    };

    return (
        <div className="w-full h-full overflow-hidden">
            <Editor
                height="100%"
                path={path}
                language={getLanguage(path)}
                value={value}
                onChange={onChange}
                onMount={handleEditorDidMount}
                loading={
                    <div className="flex items-center justify-center h-full bg-slate-900">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                }
                options={{
                    readOnly,
                    wordWrap: 'on',
                }}
            />
        </div>
    );
}
