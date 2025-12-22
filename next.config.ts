import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack is used instead of Turbopack (via --webpack flag in dev script)
  // This avoids Windows symlink permission issues
  webpack: (config, { isServer }) => {
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
