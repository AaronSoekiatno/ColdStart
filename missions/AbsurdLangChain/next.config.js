const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for running behind code-server proxy
  assetPrefix: '/proxy/3000',
}

module.exports = withBundleAnalyzer(nextConfig)