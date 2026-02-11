'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import {
    FileText,
    Zap,
    Linkedin,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Loader2,
    Upload,
    Lock,
    Search,
    Users
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function LinkedInSync() {
    const [method, setMethod] = useState<'csv' | 'api' | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'results'>('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const startCsvFlow = () => {
        setMethod('csv');
        setStatus('uploading');
        setLogs(['Awaiting file selection...']);
    };

    const startApiFlow = () => {
        setMethod('api');
        setStatus('processing');
        simulateApiFlow();
    };

    const simulateApiFlow = () => {
        setLogs(['Connecting to PhantomBuster...', 'Initializing LinkedIn session...']);
        setProgress(10);

        setTimeout(() => {
            setLogs(prev => [...prev, 'Session established.', 'Ingesting connections...']);
            setProgress(40);
        }, 2000);

        setTimeout(() => {
            setLogs(prev => [...prev, 'Imported 1,247 connections.', 'Enriching with Hermes Graph Data...']);
            setProgress(70);
        }, 4000);

        setTimeout(() => {
            setLogs(prev => [...prev, 'Enrichment complete: Found 412 GitHub profiles.', 'Added to Private Network Layer.']);
            setProgress(95);
        }, 6000);


        setTimeout(() => {
            setStatus('results');
        }, 8000);
    };

    const handleCsvUpload = () => {
        setStatus('processing');
        setLogs(['Parsing Connections.csv...', 'Extracted 842 connections.']);
        setProgress(50);

        setTimeout(() => {
            setLogs(prev => [...prev, 'Enriching with Hermes library...', 'Added 842 candidates to your Private Network.']);
            setProgress(100);
            setStatus('results');
        }, 2000);

    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            <Head>
                <title>LinkedIn Sync | Hermes</title>
            </Head>

            {/* Header */}
            <div className="bg-white border-b border-gray-200 py-8 mb-12">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Linkedin className="text-white w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LinkedIn Network Sync</h1>
                    </div>
                    <p className="text-lg text-gray-600 max-w-2xl">
                        Import your personal network to discover high-signal candidates and former colleagues currently in the Hermes database.
                    </p>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-6">
                {status === 'idle' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* CSV Card */}
                        <Card className="p-8 border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer group flex flex-col items-center text-center bg-white shadow-sm" onClick={startCsvFlow}>
                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <FileText className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">CSV Upload</h2>
                            <p className="text-gray-500 mb-6 flex-1">
                                Download your official LinkedIn connection data and upload it here. 100% secure and compliant.
                            </p>
                            <ul className="text-sm text-left w-full space-y-2 mb-8 text-gray-600 bg-gray-50 p-4 rounded-lg">
                                <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Most reliable method</li>
                                <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> No password required</li>
                                <li className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 text-amber-500" /> Takes 10 mins to prep</li>
                            </ul>
                            <Button variant="outline" className="w-full border-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                Select CSV Method
                            </Button>
                        </Card>

                        {/* API Card */}
                        <Card className="p-8 border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer group flex flex-col items-center text-center bg-white shadow-sm" onClick={startApiFlow}>
                            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Zap className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">Quick Import</h2>
                            <p className="text-gray-500 mb-6 flex-1">
                                Our automated agent will scrape your network in minutes. Fastest way to see results.
                            </p>
                            <ul className="text-sm text-left w-full space-y-2 mb-8 text-gray-600 bg-gray-50 p-4 rounded-lg">
                                <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Fully automated sync</li>
                                <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Results in under 5 mins</li>
                                <li className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 text-amber-500" /> Requires credentials</li>
                            </ul>
                            <Button variant="outline" className="w-full border-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                Select Quick Method
                            </Button>
                        </Card>
                    </div>
                )}

                {status === 'uploading' && (
                    <Card className="p-12 text-center bg-white shadow-md">
                        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                            <Upload className="w-10 h-10 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Upload Connections.csv</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            Select the CSV file you received from LinkedIn (Settings &gt; Data Privacy &gt; Get a copy of your data).
                        </p>
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 mb-8 hover:border-blue-400 transition-colors bg-gray-50 cursor-pointer" onClick={handleCsvUpload}>
                            <p className="text-gray-400">Click to browse or drag and drop file here</p>
                        </div>
                        <Button variant="ghost" onClick={() => setStatus('idle')}>Go Back</Button>
                    </Card>
                )}

                {status === 'processing' && (
                    <Card className="p-12 bg-white shadow-md">
                        <div className="flex items-center gap-4 mb-8">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <div>
                                <h2 className="text-xl font-bold">Importing your network...</h2>
                                <p className="text-gray-500">This may take a few minutes. You can leave this page.</p>
                            </div>
                        </div>

                        <Progress value={progress} className="h-3 mb-8" />

                        <div className="bg-gray-900 rounded-xl p-6 font-mono text-sm text-gray-300 h-64 overflow-y-auto">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-2 flex gap-3">
                                    <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
                                    <span className={i === logs.length - 1 ? "text-blue-400" : ""}>
                                        {i === logs.length - 1 && "➜ "} {log}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {status === 'results' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Import Complete! 🎉</h2>
                                <p className="text-gray-600">{method === 'api' ? '1,247' : '842'} candidates added to your Private Network. 30% enriched with Hermes data.</p>

                            </div>
                            <Button onClick={() => setStatus('idle')} variant="outline">Import More</Button>
                        </div>

                        <div className="grid gap-4">
                            {[
                                { name: "John Doe", title: "Senior Software Engineer", company: "Anthropic", connection: "Founder's Network", avatar: "JD" },
                                { name: "Sarah Williams", title: "Product Manager", company: "OpenAI", connection: "Founder's Network", avatar: "SW" },
                                { name: "Alex Chen", title: "ML Infrastructure", company: "Scale AI", connection: "Founder's Network", avatar: "AC" },
                            ].map((match, i) => (
                                <Card key={i} className="p-5 flex items-center justify-between bg-white hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                                            {match.avatar}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900">{match.name}</h3>
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100 uppercase text-[10px] tracking-wider font-bold">
                                                    {match.connection}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">{match.title} · {match.company}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" className="text-blue-600 hover:text-blue-700 font-medium">
                                        View Profile <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Card>
                            ))}
                        </div>

                        <div className="bg-blue-600 rounded-2xl p-8 text-white flex items-center justify-between shadow-xl shadow-blue-200">
                            <div>
                                <h3 className="text-xl font-bold mb-2">Ready to explore all matches?</h3>
                                <p className="text-blue-100 opacity-90">View all 8 candidates from your network in the dashboard.</p>
                            </div>
                            <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8">
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>
                )}
            </main>

            {/* Security Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4 px-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-green-500" /> AES-256 Encryption</div>
                        <div className="flex items-center gap-1.5"><Search className="w-4 h-4" /> GDPR Compliant</div>
                        <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Founder-Scoped Only</div>
                    </div>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-gray-900 transition-colors">Security Audit</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
