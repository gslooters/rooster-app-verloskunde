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
    FORCE_REBUILD_TIMESTAMP: '1735959600000', // DRAAD403B: 2026-01-05T14:00:00Z CACHE BUST
    DRAAD403B_AFL_FIXES_DEPLOYED: 'true', // All 4 fouten fixed: status check, variant ID, invulling, DIO/DIA
  },
  
  // Performance settings
  swcMinify: true,
  compress: true,
  
  // 🔥 Output config voor Railway deployment
  output: 'standalone',
  
  // 🔥 Server configuration for Railway
  serverRuntimeConfig: {
    // Deze worden NIET blootgesteld aan client
  },
  publicRuntimeConfig: {
    // Deze zijn beschikbaar op client EN server
  },
  
  // 🔥 EXPERIMENTAL: Settings for Next.js 14.2.33
  experimental: {
    outputFileTracingRoot: undefined,
  },
  
  // 🔥 Webpack configuratie
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;