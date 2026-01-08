import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack is used instead of Turbopack (via --webpack flag in dev script)
  // This avoids Windows symlink permission issues
  webpack: (config, { isServer }) => {
    // Handle @vapi-ai/web for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      
      // Ensure @vapi-ai/web is properly resolved and not externalized
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    
    // Ensure @vapi-ai/web is bundled (not externalized)
    if (config.externals) {
      // Remove @vapi-ai/web from externals if it's there
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter(
          (external) => {
            if (typeof external === 'string') {
              return external !== '@vapi-ai/web';
            }
            if (typeof external === 'function') {
              return true; // Keep function externals
            }
            return true;
          }
        );
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = (ctx, callback) => {
          originalExternals(ctx, (err, external) => {
            if (err || !external) {
              callback(err, external);
              return;
            }
            // Don't externalize @vapi-ai/web
            if (external === '@vapi-ai/web') {
              callback(null, undefined);
              return;
            }
            callback(null, external);
          });
        };
      }
    }
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      {
        protocol: "https",
        hostname: "bookface-images.s3.amazonaws.com",
      },
    ],
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
