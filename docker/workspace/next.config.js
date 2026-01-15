const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for running behind code-server proxy
  assetPrefix: '/proxy/3000',

  // Optimize for constrained environments (1 vCPU)
  webpack: (config, { dev, isServer }) => {
    // Reduce parallel processing to prevent CPU contention
    config.parallelism = 1;

    // Disable source maps in dev to save memory
    if (dev && !isServer) {
      config.devtool = false;
    }

    return config;
  },

  // Reduce concurrent compilation
  experimental: {
    workerThreads: false,
    cpus: 1
  }
}

module.exports = withBundleAnalyzer(nextConfig)