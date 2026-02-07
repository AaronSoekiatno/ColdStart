"use client";

import { useState } from 'react';
import { Code2, Clock, Target, Award, CheckCircle2, Play, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface AssessmentPreviewProps {
  companyName: string;
  githubRepoUrl?: string | null;
  codebaseProvided?: boolean;
}

export default function AssessmentPreview({ companyName, githubRepoUrl, codebaseProvided }: AssessmentPreviewProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'preview'>('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Configuration</h2>
        <p className="text-gray-600">
          This is what candidates will see when they complete your custom assessment
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            selectedTab === 'overview'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setSelectedTab('preview')}
          className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
            selectedTab === 'preview'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Candidate View
        </button>
      </div>

      {selectedTab === 'overview' ? (
        <div className="space-y-6">
          {/* Assessment Status */}
          <Card className="p-6 bg-white">
            <div className="flex items-start gap-4">
              {codebaseProvided ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Custom Assessment Generated
                    </h3>
                    <p className="text-gray-600 mb-4">
                      We've analyzed your codebase and created a tailored assessment that mirrors your actual work
                    </p>
                    {githubRepoUrl && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Code2 className="w-4 h-4" />
                        <span className="font-mono">{githubRepoUrl}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Using Standard Assessment
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Candidates will complete our standard full-stack assessment. Connect your codebase to generate custom challenges.
                    </p>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Connect GitHub Repository →
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Assessment Details Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Duration</h4>
                  <p className="text-sm text-gray-600">Time-based challenge</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600">20 minutes</div>
              <p className="text-sm text-gray-600 mt-2">
                Candidates have 20 minutes to complete the coding challenge in an isolated environment
              </p>
            </Card>

            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Evaluation Criteria</h4>
                  <p className="text-sm text-gray-600">What we measure</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Backend (API)</span>
                  <span className="font-semibold text-gray-900">40 pts</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Frontend (UI)</span>
                  <span className="font-semibold text-gray-900">40 pts</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Real-time Sync</span>
                  <span className="font-semibold text-gray-900">20 pts</span>
                </div>
              </div>
            </Card>
          </div>

          {/* What Candidates Will Build */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-green-600" />
              </div>
              <h4 className="font-bold text-gray-900">Challenge Description</h4>
            </div>

            {codebaseProvided ? (
              <div className="space-y-3">
                <p className="text-gray-700">
                  Based on your codebase analysis, candidates will build a feature that mirrors your actual architecture:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>Implement a RESTful API endpoint using your tech stack patterns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>Build a React component that follows your coding conventions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>Integrate real-time updates matching your system's complexity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>Write tests that match your coverage standards</span>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-700">
                  Standard Full-Stack Challenge: Build a real-time todo application
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <span>Create CRUD API endpoints (Express/FastAPI)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <span>Build an interactive React UI with state management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <span>Implement WebSocket for real-time synchronization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                    <span>Write unit and integration tests</span>
                  </li>
                </ul>
              </div>
            )}
          </Card>

          {/* Artifacts Collected */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Award className="w-5 h-5 text-orange-600" />
              </div>
              <h4 className="font-bold text-gray-900">What We Capture</h4>
            </div>
            <p className="text-gray-700 mb-4">
              During the assessment, we collect comprehensive evidence to evaluate the candidate:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Code diffs & commits</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Test results & coverage</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Code quality metrics</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Post-mortem reflection</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Debugging approach</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">Communication style</span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Candidate Preview */
        <div className="space-y-6">
          <Card className="p-8 bg-gradient-to-br from-blue-50 to-white border-2 border-blue-100">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
                <Code2 className="w-8 h-8 text-white" />
              </div>
              <div className="flex-grow">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {companyName} Engineering Assessment
                </h3>
                <p className="text-gray-700 mb-6">
                  Welcome to the {companyName} coding challenge. This is a 20-minute assessment designed to understand how you work in a real development environment.
                </p>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Clock className="w-5 h-5 text-blue-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 mb-1">20 min</div>
                    <div className="text-sm text-gray-600">Time limit</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Target className="w-5 h-5 text-purple-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 mb-1">100 pts</div>
                    <div className="text-sm text-gray-600">Total score</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <Award className="w-5 h-5 text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 mb-1">Full Stack</div>
                    <div className="text-sm text-gray-600">Challenge type</div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <h4 className="font-bold text-gray-900">What you'll build:</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex gap-3">
                      <span className="text-blue-600 font-bold">40%</span>
                      <span className="text-gray-700">Backend API with REST endpoints</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-blue-600 font-bold">40%</span>
                      <span className="text-gray-700">React frontend with interactive UI</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-blue-600 font-bold">20%</span>
                      <span className="text-gray-700">Real-time synchronization</span>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Assessment
                </motion.button>

                <p className="text-sm text-gray-500 mt-4 text-center">
                  You'll work in a real VS Code environment with access to documentation and AI tools
                </p>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 bg-white">
              <h4 className="font-bold text-gray-900 mb-3">What candidates see:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Clear task description with acceptance criteria</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Pre-scaffolded codebase with helpful comments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Live preview of their application</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Real-time test runner with feedback</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-white">
              <h4 className="font-bold text-gray-900 mb-3">What you'll receive:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Complete code submission with full history</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Automated test results and coverage report</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Code quality analysis and metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Candidate's written reflection on their approach</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
