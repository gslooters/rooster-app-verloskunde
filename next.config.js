/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Disable ALL caching mechanisms
  generateBuildId: async () => {
    // Unique build ID every time to force Railway fresh build
    return `build-force-${Date.now()}-${Math.random().toString(36).substring(7)}`
  },
  // Force dynamic rendering - no static optimization
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR cache
  },
  // Disable static page generation
  output: 'standalone',
  // Force fresh data fetching
  env: {
    NEXT_DISABLE_SWC_CACHE: '1',
    FORCE_REBUILD_TIMESTAMP: Date.now().toString()
  }
};

module.exports = nextConfig;
