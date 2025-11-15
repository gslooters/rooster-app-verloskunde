/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable build cache to ensure fresh builds on Railway
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  // Disable static page generation optimization to force fresh rendering
  experimental: {
    isrMemoryCacheSize: 0
  }
};

module.exports = nextConfig;
