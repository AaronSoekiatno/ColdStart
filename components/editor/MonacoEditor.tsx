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
    const valueRef = useRef<string>(value);
    const isUpdatingRef = useRef<boolean>(false); // Track programmatic updates

    // Sync external value changes to editor (e.g., from agent edits)
    useEffect(() => {
        console.log(`[MonacoEditor] useEffect triggered - path: ${path}, value length: ${value?.length || 0}, valueRef: ${valueRef.current?.length || 0}`);

        if (editorRef.current) {
            const editor = editorRef.current;
            const currentValue = editor.getValue();

            console.log(`[MonacoEditor] Comparing - currentEditor: ${currentValue?.length || 0}, newValue: ${value?.length || 0}`);

            // Update editor if the external value differs from current editor content
            // This ensures external changes (from agent, polling, etc.) always sync
            if (currentValue !== value) {
                console.log(`[MonacoEditor] 🔄 Values differ, updating editor for ${path}`);

                const position = editor.getPosition();
                const scrollTop = editor.getScrollTop();

                // Mark that we're doing a programmatic update to prevent onChange from firing
                isUpdatingRef.current = true;

                // Update the value
                editor.setValue(value);

                // Reset the flag after a short delay to allow onChange to settle
                setTimeout(() => {
                    isUpdatingRef.current = false;
                }, 100);

                // Restore cursor position and scroll if possible
                if (position) {
                    editor.setPosition(position);
                }
                editor.setScrollTop(scrollTop);

                console.log(`[MonacoEditor] ✅ Editor updated for ${path}`);
            }

            valueRef.current = value;
        }
    }, [value, path]);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        valueRef.current = value;

        // Configure diagnostics to ignore specific errors related to missing types
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            diagnosticCodesToIgnore: [
                2792, // Cannot find module
                2347, // Untyped function calls
                2694, // Namespace has no exported member
                2307, // Cannot find module (again)
                2304, // Cannot find name
                2875, // Cannot find namespace
                2614, // Module has no exported member
                2580, // Cannot find name
            ]
        });

        // 1. Configure compiler options to fix "Cannot find module" and path alias errors
        const compilerOptions = {
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            esModuleInterop: true,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            reactNamespace: 'React',
            allowJs: true,
            typeRoots: ['node_modules/@types'],
            baseUrl: '/', // Important for resolving @/ paths relative to root
            paths: {
                '@/*': ['./*'] // Map @/ imports to project root
            }
        };

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

        // 2. Add safe type shims for common external libraries to silence unresolved module errors
        // This is a browser-only editor, so we don't have real node_modules. 
        // We declare these as 'any' to prevent red squiggles.
        const commonLibs = [
            'next-themes',
            'next/navigation',
            'next/headers',
            'next/server',
            'next/image',
            'next/link',
            'react',
            'react-dom',
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'sonner',
            'zod',
            'react-hook-form',
            '@supabase/ssr',
            '@supabase/supabase-js',
            'framer-motion',
            'recharts',
            'date-fns'
        ];

        commonLibs.forEach(lib => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                `declare module '${lib}' { const content: any; export = content; export default content; }`,
                `file:///node_modules/@types/${lib}/index.d.ts`
            );
        });

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

    // Wrapper to prevent onChange from firing during programmatic updates
    const handleChange = (value: string | undefined) => {
        if (isUpdatingRef.current) {
            console.log(`[MonacoEditor] Ignoring onChange during programmatic update for ${path}`);
            return;
        }
        if (onChange) {
            onChange(value);
        }
    };

    return (
        <div className="w-full h-full overflow-hidden">
            <Editor
                height="100%"
                path={path}
                language={getLanguage(path)}
                value={value}
                onChange={handleChange}
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
