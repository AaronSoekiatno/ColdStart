/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for running behind code-server proxy
  assetPrefix: '/proxy/3000',

  // Optimize for constrained environments (1 vCPU)
  // Constraints removed for faster compilation

  // Skip type checking during dev for faster compilation
  typescript: {
    ignoreBuildErrors: true,
  },

  // Skip linting during dev for faster compilation
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverActions: {
    allowedOrigins: [
      'localhost:3000',
      '.fly.dev'
    ],
  },
  experimental: {
    // Constraints removed for faster compilation
  }
}

module.exports = nextConfig