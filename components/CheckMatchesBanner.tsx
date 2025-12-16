'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FounderPfp {
  url: string;
  name: string;
}

export function CheckMatchesBanner() {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [founderPfps, setFounderPfps] = useState<FounderPfp[]>([]);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('checkMatchesBannerDismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
        return;
      }

      // Check if user just finished enhancing their resume
      const justEnhanced = sessionStorage.getItem('justEnhancedResume');
      if (justEnhanced === 'true') {
        setShouldShow(true);
        // Clear the flag so it doesn't show again on refresh
        sessionStorage.removeItem('justEnhancedResume');
        
        // Check if founder pfps were preloaded and stored
        const storedPfps = sessionStorage.getItem('bannerFounderPfps');
        if (storedPfps) {
          try {
            const pfps = JSON.parse(storedPfps);
            setFounderPfps(pfps);
            // Clear stored data after using it
            sessionStorage.removeItem('bannerFounderPfps');
            // Images should already be cached from preloading
          } catch (error) {
            console.error('Error parsing stored founder pfps:', error);
            // Fallback to fetching if parsing fails
            fetchTopMatches();
          }
        } else {
          // Fallback: fetch if not preloaded
          fetchTopMatches();
        }
      }
    }
  }, []);

  const fetchTopMatches = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/matches?page=1&limit=5', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const matches = data.matches || [];
        
        // Extract founder profile pictures from top matches
        const pfps: FounderPfp[] = [];
        matches.forEach((match: any) => {
          if (match.startup?.founders_pfp) {
            // Parse founders_pfp - handle both array and string formats
            let founderProfilePictures: string[] = [];
            if (Array.isArray(match.startup.founders_pfp)) {
              founderProfilePictures = match.startup.founders_pfp
                .map((url: any) => String(url).trim())
                .filter((url: string) => url && url !== '');
            } else if (typeof match.startup.founders_pfp === 'string') {
              founderProfilePictures = match.startup.founders_pfp
                .split(',')
                .map((url: string) => url.trim())
                .filter((url: string) => url && url !== '');
            }

            // Get founder names
            const founderNames = match.startup.founder_names
              ? match.startup.founder_names.split(',').map((n: string) => n.trim())
              : [];

            // Add first founder from each match (limit to 4 total)
            if (founderProfilePictures.length > 0 && pfps.length < 4) {
              const firstName = founderNames[0] || match.startup.name || 'Founder';
              pfps.push({
                url: founderProfilePictures[0],
                name: firstName,
              });
            }
          }
        });

        const finalPfps = pfps.slice(0, 4); // Limit to 4 profile pictures
        setFounderPfps(finalPfps);
        
        // Preload images immediately after fetching
        preloadImages(finalPfps);
      }
    } catch (error) {
      console.error('Error fetching matches for banner:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const preloadImages = (pfps: FounderPfp[]) => {
    pfps.forEach((founder, index) => {
      if (founder.url && founder.url.trim() !== '') {
        const img = new Image();
        const imageUrl = `/api/image-proxy?url=${encodeURIComponent(founder.url)}`;
        
        img.onerror = () => {
          console.log(`[CheckMatchesBanner] Failed to preload image for ${founder.name}:`, founder.url);
          setFailedImages(prev => new Set(prev).add(index));
        };
        
        // Start loading the image (browser will cache it)
        img.src = imageUrl;
      }
    });
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkMatchesBannerDismissed', 'true');
    }
  };

  const handleViewMatches = () => {
    window.location.href = '/matches';
  };

  // Don't show if dismissed or flag not set
  if (isDismissed || !shouldShow) {
    return null;
  }

  // Get initials for fallback
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || '?';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Founder Profile Pictures */}
          {founderPfps.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              {founderPfps.map((founder, index) => (
                <div
                  key={index}
                  className="relative w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden flex-shrink-0"
                  style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                >
                  {founder.url && !failedImages.has(index) ? (
                    <Image
                      src={`/api/image-proxy?url=${encodeURIComponent(founder.url)}`}
                      alt={founder.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      unoptimized
                      loading="eager"
                      priority={index < 2} // Prioritize first 2 images
                      onError={() => {
                        setFailedImages(prev => new Set(prev).add(index));
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <span className="text-gray-600 text-sm font-semibold">
                        {getInitials(founder.name)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Title and Content */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-[#498EDC]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to meet your matches?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Your resume is enhanced! Check out your personalized matches with YC startups.
              </p>
              <Button
                onClick={handleViewMatches}
                className="bg-[#498EDC] hover:bg-[#3a7bc4] text-white text-sm px-6 py-2 h-auto rounded-full"
              >
                View Matches
              </Button>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

