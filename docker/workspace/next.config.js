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
  experimental: {
    // Allow mapped fly.dev URLs to prevent cross-origin warnings
    allowedDevOrigins: [
      'localhost:3000',
      '.fly.dev'
    ],
  }
}

module.exports = nextConfig