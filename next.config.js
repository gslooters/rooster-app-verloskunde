/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔥 CRITICAL: Force unique build ID with millisecond precision
  generateBuildId: async () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `build-${timestamp}-${random}`;
  },
  
  // 🔥 CRITICAL: Disable ALL Next.js caching
  env: {
    NEXT_DISABLE_SWC_CACHE: '1',
    NEXT_PRIVATE_DISABLE_CACHE: 'true',
    FORCE_REBUILD_TIMESTAMP: Date.now().toString(),
  },
  
  // Performance settings
  swcMinify: true,
  compress: true,
  
  // 🔥 NEW: Export static HTML (FastAPI will serve)
  output: 'export',
  
  // 🔥 Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // 🔥 Base path (if needed for routing)
  // basePath: '',
  
  // 🔥 Trailing slash for cleaner URLs
  trailingSlash: true,
  
  // 🔥 Webpack configuratie
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
