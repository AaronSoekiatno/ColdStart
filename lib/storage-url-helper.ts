/**
 * Storage URL Helper - Cache-Optimized Proxy URLs
 * 
 * This utility generates URLs that route through cache-optimized proxy endpoints
 * to leverage Supabase's cached egress quota instead of direct egress.
 * 
 * Benefits:
 * - Moves bandwidth from 5GB direct egress to 5GB cached egress quota
 * - Effectively doubles available bandwidth to 10GB total
 * - Reduces API costs and improves performance
 */

/**
 * Generate a cache-optimized resume proxy URL
 * Routes through /api/resumes/proxy with CDN caching headers
 * 
 * @param resumePath - Path to resume in Supabase Storage (e.g., "resumes/user-id/file.pdf")
 * @param version - Optional version/timestamp to force cache invalidation
 * @returns Proxied URL with authentication and CDN caching
 * 
 * @example
 * ```ts
 * const url = getResumeProxyUrl('resumes/123/resume.pdf');
 * // Returns: '/api/resumes/proxy?path=resumes%2F123%2Fresume.pdf'
 * 
 * const urlWithVersion = getResumeProxyUrl('resumes/123/resume.pdf', Date.now());
 * // Returns: '/api/resumes/proxy?path=resumes%2F123%2Fresume.pdf&v=1703001234567'
 * ```
 */
export function getResumeProxyUrl(resumePath: string, version?: number): string {
  if (!resumePath || resumePath.trim() === '') {
    console.warn('[getResumeProxyUrl] Empty resume path provided');
    return '';
  }

  const encodedPath = encodeURIComponent(resumePath);
  const baseUrl = `/api/resumes/proxy?path=${encodedPath}`;
  
  if (version !== undefined) {
    return `${baseUrl}&v=${version}`;
  }
  
  return baseUrl;
}

/**
 * Generate a cache-optimized image proxy URL
 * Routes through /api/image-proxy with CDN caching headers
 * 
 * @param imageUrl - Full URL to image (Supabase Storage or allowed external source)
 * @returns Proxied URL with CDN caching
 * 
 * @example
 * ```ts
 * const url = getImageProxyUrl('https://xyz.supabase.co/storage/v1/object/public/logos/company.png');
 * // Returns: '/api/image-proxy?url=https%3A%2F%2Fxyz.supabase.co%2F...'
 * ```
 */
export function getImageProxyUrl(imageUrl: string): string {
  if (!imageUrl || imageUrl.trim() === '') {
    console.warn('[getImageProxyUrl] Empty image URL provided');
    return '';
  }

  // If already a proxy URL, return as-is
  if (imageUrl.startsWith('/api/image-proxy')) {
    return imageUrl;
  }

  const encodedUrl = encodeURIComponent(imageUrl);
  return `/api/image-proxy?url=${encodedUrl}`;
}

/**
 * Check if a URL is already proxied through a cache-optimized endpoint
 * 
 * @param url - URL to check
 * @returns true if URL is already proxied
 */
export function isProxiedUrl(url: string): boolean {
  return url.startsWith('/api/resumes/proxy') || url.startsWith('/api/image-proxy');
}

/**
 * Get the cache TTL for different resource types
 * Useful for client-side cache invalidation logic
 */
export const CACHE_TTL = {
  /** Resume cache TTL: 1 hour (3600 seconds) */
  RESUME: 3600,
  /** Image cache TTL: 1 year (31536000 seconds) */
  IMAGE: 31536000,
  /** Startup data cache TTL: 24 hours (86400 seconds) */
  STARTUP: 86400,
  /** Matches cache TTL: 5 minutes (300 seconds) */
  MATCHES: 300,
} as const;
