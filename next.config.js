/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force unique build ID for Railway fresh deploys
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(7)}`
  },
  // Disable SWC cache
  env: {
    NEXT_DISABLE_SWC_CACHE: '1',
    FORCE_REBUILD_TIMESTAMP: Date.now().toString()
  },
  // Optimale performance settings
  swcMinify: true,
  compress: true,
  
  // CRITICAL: Disable static optimization voor pagina's met database calls
  // Dit voorkomt pre-rendering tijdens build waar Supabase env vars nodig zijn
  experimental: {
    // Force dynamic rendering
    isrMemoryCacheSize: 0,
  },
  
  // Output config voor deployment
  output: 'standalone'
};

module.exports = nextConfig;
