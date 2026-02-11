"use client";

import { motion } from "framer-motion";
import { Upload, Code, Users, Calendar, Check, Search, FileText, Terminal, MessageSquare, Briefcase } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface StartupWithFounders {
  id: string;
  name: string;
  founders_pfp: string[];
  founder_names: string[];
}

export function NewHowItWorks() {
  const [foundersData, setFoundersData] = useState<StartupWithFounders[]>([]);

  useEffect(() => {
    async function fetchFounders() {
      try {
        const response = await fetch("/api/startups/founders-pfp");
        if (response.ok) {
          const data = await response.json();
          const shuffled = (data.startups || []).sort(() => 0.5 - Math.random());
          setFoundersData(shuffled.slice(0, 3));
        }
      } catch (err) {
        console.error("Error fetching founder profile pictures:", err);
      }
    }
    fetchFounders();
  }, []);

  return (
    <section className="bg-white py-24 sm:py-32" id="how-it-works">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-24">
          <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl" style={{ fontFamily: 'Ivy Journal, serif' }}>
            Get hired for what you can do.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Stop applying into the void. Prove your skills, get matched directly with founders, and skip the first round.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {/* Step 1: Connect Profile */}
          <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl bg-gray-50 border border-gray-200 p-8 sm:p-12">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm">
                  <Upload className="h-4 w-4" /> <span>Step 1</span>
                </div>
                <h3 className="text-3xl font-bold tracking-tight text-gray-900">Connect your profile</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Upload your resume and connect your GitHub. We analyze your experience, code quality, and contributions to understand your true engineering potential.
                </p>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex gap-3">
                    <Check className="h-6 w-5 flex-none text-gray-900" />
                    <span>Instant skill extraction from resume.</span>
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-6 w-5 flex-none text-gray-900" />
                    <span>Deep analysis of GitHub history.</span>
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-6 w-5 flex-none text-gray-900" />
                    <span>Identify key strengths and patterns.</span>
                  </li>
                </ul>
              </div>
              <div className="lg:w-1/2 w-full">
                {/* Resume Analysis Visual */}
                <div className="relative w-full rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden transform rotate-1 transition-transform hover:rotate-0 duration-500 p-6">
                  <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">resume.pdf</div>
                      <div className="text-xs text-gray-500">Processing...</div>
                    </div>
                    <div className="ml-auto text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Completed</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="bg-gray-100 rounded-md px-2 py-1 text-xs font-medium text-gray-600">Python Expert</div>
                      <div className="bg-gray-100 rounded-md px-2 py-1 text-xs font-medium text-gray-600">React</div>
                      <div className="bg-gray-100 rounded-md px-2 py-1 text-xs font-medium text-gray-600">PostgreSQL</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Search className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-900">Inferred Skills</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Based on GitHub activity, candidate demonstrates senior-level patterns in distributed systems and API design.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Work Trial */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-full">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm mb-4">
                <Code className="h-4 w-4" /> <span>Step 2</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Prove it with code</h3>
              <p className="text-gray-600">
                Complete a tailored 20-minute engineering mission. No whiteboard riddles—just real work that mirrors startup challenges.
              </p>
            </div>

            <div className="flex-1 relative min-h-[250px] flex items-center justify-center mt-4 bg-gray-900 rounded-xl p-4 overflow-hidden border border-gray-800">
              {/* Code Visual */}
              <div className="w-full font-mono text-xs">
                <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <span className="text-gray-400 ml-2">mission.ts</span>
                </div>
                <div className="space-y-1">
                  <div className="flex"><span className="text-gray-500 w-6">1</span><span className="text-purple-400">async function</span> <span className="text-blue-400">solveChallenge</span>() {'{'}</div>
                  <div className="flex"><span className="text-gray-500 w-6">2</span>  <span className="text-gray-500">// Your implementation here</span></div>
                  <div className="flex"><span className="text-gray-500 w-6">3</span>  <span className="text-purple-400">const</span> result = <span className="text-purple-400">await</span> ai.<span className="text-blue-300">optimize</span>(data);</div>
                  <div className="flex"><span className="text-gray-500 w-6">4</span>  <span className="text-blue-400">return</span> result;</div>
                  <div className="flex"><span className="text-gray-500 w-6">5</span>{'}'}</div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-2 text-green-400">
                  <Terminal className="w-3 h-3" />
                  <span>All tests passed (5/5)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Warm Introductions */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-full">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm mb-4">
                <Users className="h-4 w-4" /> <span>Step 3</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Direct Founder Intros</h3>
              <p className="text-gray-600">
                Browse active roles and get introduced directly to founders. No cold emails, no ghosting.
              </p>
            </div>

            <div className="flex-1 relative mt-4">
              <div className="space-y-3">
                {foundersData.length > 0 ? foundersData.map((startup, i) => (
                  <div key={startup.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-blue-200 transition-colors shadow-sm">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {startup.founders_pfp?.[0] ? (
                        <Image
                          src={`/api/image-proxy?url=${encodeURIComponent(startup.founders_pfp[0])}`}
                          alt={startup.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-bold">
                          {startup.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 truncate">{startup.name}</p>
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Hiring</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">Founder is online</p>
                    </div>
                  </div>
                )) : (
                  // Fallback UI
                  [1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Step 4: Land Interview */}
          <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl bg-gray-900 text-white p-8 sm:p-12">
            <div className="absolute top-0 right-0 p-32 bg-blue-600/20 blur-3xl rounded-full pointer-events-none"></div>
            <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
              <div className="lg:w-1/2 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/20">
                  <Calendar className="h-4 w-4" /> <span>Step 4</span>
                </div>
                <h3 className="text-3xl font-bold tracking-tight">Interviews land in your inbox</h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Sit back while our AI agent handles the scheduling. You just show up to the interview with a warm introduction already made.
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <MessageSquare className="w-4 h-4 text-white" /> Direct Chat with Founders
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <Briefcase className="w-4 h-4 text-white" /> Fast-tracked Process
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 w-full flex justify-center">
                {/* Calendar Visual */}
                <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 text-gray-900 transform rotate-1 hover:rotate-0 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">You have a new interview!</div>
                      <div className="text-xs text-gray-500">Scheduled for Tomorrow, 2:00 PM</div>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                        {foundersData[0]?.founders_pfp?.[0] ?
                          <Image src={`/api/image-proxy?url=${encodeURIComponent(foundersData[0].founders_pfp[0])}`} width={32} height={32} alt="Founder" /> :
                          <div className="w-full h-full bg-gray-300" />
                        }
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900">John (Founder)</span> is excited to meet you.
                      </div>
                    </div>
                  </div>
                  <button className="w-full py-2.5 rounded-lg bg-[#498EDC] text-white font-medium hover:bg-[#3d7cc2] transition-colors shadow-lg shadow-blue-500/20">
                    Add to Calendar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
