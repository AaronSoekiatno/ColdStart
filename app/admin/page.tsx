'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Users, Shield, Activity, ArrowRight, Server, FileText } from 'lucide-react';

export default function AdminDashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);
            setIsLoading(false);
        }
        checkAuth();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const modules = [
        {
            title: 'Candidates',
            description: 'View full profiles, GitHub verification, and assessment results.',
            icon: Users,
            color: 'bg-blue-100 text-blue-600',
            href: '/admin/candidates'
        },
        {
            title: 'Segmentation',
            description: 'Analyze candidate distribution across 5 key segments.',
            icon: Activity,
            color: 'bg-purple-100 text-purple-600',
            href: '/admin/segments'
        },
        // Future modules placeholders
        /*
        {
          title: 'Job Matches',
          description: 'Manage startup-candidate matching algorithms.',
          icon: Activity,
          color: 'bg-purple-100 text-purple-600',
          href: '/admin/matches' // Placeholder if it existed
        }
        */
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-900">Admin Portal</h1>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">{user?.email}</span>
                            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <Shield className="w-4 h-4 text-gray-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Management Modules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modules.map((module) => (
                            <div
                                key={module.title}
                                onClick={() => router.push(module.href)}
                                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${module.color}`}>
                                        <module.icon className="w-6 h-6" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{module.title}</h3>
                                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{module.description}</p>
                            </div>
                        ))}

                        {/* Coming Soon Card */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 border-dashed flex flex-col items-center justify-center text-center opacity-60">
                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                                <Server className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-500">More Coming Soon</h3>
                            <p className="text-sm text-gray-400 mt-1">Infrastructure and Analytics</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
