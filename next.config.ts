import type { NextConfig } from "next";

const nextConfig: NextConfig = {
<<<<<<< HEAD
  // External packages for server components (native modules)
  serverExternalPackages: [
    '@tailwindcss/oxide',
    '@tailwindcss/oxide-win32-x64-msvc',
    'lightningcss',
    'lightningcss-win32-x64-msvc',
  ],
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
    }
    
    // Help webpack resolve lightningcss native modules and React Server Components
    // Merge with existing aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
      'react-server-dom-webpack/client': require.resolve('react-server-dom-webpack/client'),
      ...(process.platform === 'win32' && process.arch === 'x64' 
        ? { 'lightningcss-win32-x64-msvc': require.resolve('lightningcss-win32-x64-msvc') }
        : {}),
    };
    
    // Ensure @vapi-ai/web is bundled (not externalized)
    // But externalize native modules like @tailwindcss/oxide-* and lightningcss-*
    if (config.externals) {
      // Remove @vapi-ai/web from externals if it's there
      if (Array.isArray(config.externals)) {
        config.externals = [
          ...config.externals.filter(
            (external: unknown) => {
              if (typeof external === 'string') {
                return external !== '@vapi-ai/web';
              }
              if (typeof external === 'function') {
                return true; // Keep function externals
              }
              return true;
            }
          ),
          // Externalize native modules
          /^@tailwindcss\/oxide-/,
          /^lightningcss-/,
        ];
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = (ctx: any, callback: any) => {
          // Externalize native modules
          if (typeof ctx.request === 'string') {
            if (ctx.request.startsWith('@tailwindcss/oxide-') || ctx.request.startsWith('lightningcss-')) {
              callback(null, ctx.request);
              return;
            }
          }
          
          originalExternals(ctx, (err: any, external: any) => {
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
    } else {
      // If no externals config, add one for native modules
      config.externals = [
        /^@tailwindcss\/oxide-/,
        /^lightningcss-/,
      ];
    }
    
    // Ensure native modules are properly resolved
    config.resolve.extensionAlias = {
      '.node': ['.node'],
    };
    
    return config;
=======
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
>>>>>>> main
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
