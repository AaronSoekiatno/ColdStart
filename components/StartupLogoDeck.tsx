"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { ScrollAnimate } from "@/components/ScrollAnimate";

interface StartupLogo {
  id: string;
  name: string;
  company_logo: string;
}

export function StartupLogoDeck() {
  const [startups, setStartups] = useState<StartupLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  
  // Direct IntersectionObserver for reliable scroll detection
  useEffect(() => {
    if (!wrapperRef.current || shouldAnimate) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldAnimate(true);
            observer.disconnect(); // Only trigger once
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
      }
    );
    
    observer.observe(wrapperRef.current);
    
    // Check if already visible on mount
    const checkInitialVisibility = () => {
      if (wrapperRef.current && !shouldAnimate) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight * 1.5 && rect.bottom > -200;
        if (isInViewport) {
          setShouldAnimate(true);
          observer.disconnect();
        }
      }
    };
    
    // Check after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(checkInitialVisibility, 100);
    
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [shouldAnimate, startups.length]);

  useEffect(() => {
    async function fetchStartupLogos() {
      try {
        const response = await fetch("/api/startups/logos");
        if (!response.ok) {
          throw new Error("Failed to fetch startup logos");
        }
        const data = await response.json();
        setStartups(data.startups || []);
      } catch (err) {
        console.error("Error fetching startup logos:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchStartupLogos();
  }, []);

  if (loading) {
    return (
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-gray-400">Loading startup logos...</div>
          </div>
        </div>
      </section>
    );
  }

  if (error || startups.length === 0) {
    return null; // Don't show section if there's an error or no logos
  }

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <ScrollAnimate direction="up" delay={0} threshold={0.2}>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight text-gray-900 mb-4">
              The Definitive YC Startup Database
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto flex items-center justify-center gap-2 flex-wrap">
              Connect with 1000's of{' '}
              <Image
                src="https://www.getbluma.com/ycLogo.avif"
                alt="Y Combinator"
                width={120}
                height={24}
                className="inline-block h-6 w-auto"
                unoptimized
              />{' '}
              startups actively hiring interns
            </p>
          </div>
        </ScrollAnimate>

        <div ref={wrapperRef} className={`w-full logo-grid-wrapper ${shouldAnimate ? 'is-visible' : ''}`}>
          <div className="w-full px-2">
            <div className="grid grid-cols-12 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(18,minmax(0,1fr))] lg:grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
              {startups.slice(0, 144).map((startup, index) => (
                    <div
                      key={startup.id}
                  className="bg-white rounded-sm p-0 border border-gray-200 hover:border-blue-400 transition-all duration-300 aspect-square flex items-center justify-center group overflow-hidden logo-item"
                      style={{
                    animationDelay: `${index * 0.03}s`,
                      }}
                    >
                      <Image
                        src={startup.company_logo}
                        alt={startup.name}
                    width={100}
                    height={100}
                    className="w-full h-full"
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      objectFit: 'cover'
                    }}
                        unoptimized
                        title={startup.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
          </div>

        {/* Add CSS animation for fadeInUp */}
        <style jsx>{`
          .logo-item {
            opacity: 0;
            transform: translateY(20px);
          }
          
          .logo-grid-wrapper.is-visible .logo-item {
            animation: fadeInUp 0.5s ease-out both;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </section>
  );
}
