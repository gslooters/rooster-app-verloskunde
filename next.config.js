/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔥 CRITICAL: Force unique build ID with millisecond precision
  // Dit zorgt ervoor dat Railway/Next.js ALTIJD een nieuwe build maakt
  generateBuildId: async () => {
    // Gebruik milliseconds + random voor GEGARANDEERDE uniekheid
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `build-${timestamp}-${random}`;
  },
  
  // 🔥 CRITICAL: Disable ALL Next.js caching
  // Dit voorkomt dat Next.js "slimme" optimalisaties doet die className changes skippen
  env: {
    // Disable SWC compiler cache (voorkomt cached transforms)
    NEXT_DISABLE_SWC_CACHE: '1',
    
    // 🔥 NEW: Disable Next.js private cache systeem volledig
    NEXT_PRIVATE_DISABLE_CACHE: 'true',
    
    // Force rebuild timestamp (verandert bij elke build)
    FORCE_REBUILD_TIMESTAMP: Date.now().toString(),
  },
  
  // Performance settings (behouden)
  swcMinify: true,
  compress: true,
  
  // Output config voor Railway deployment met standalone
  output: 'standalone',
  
  // 🔥 EXPERIMENTAL: Only settings supported in Next.js 14.2.33
  experimental: {
    // Output file tracing (behouden voor standalone)
    outputFileTracingRoot: undefined,
  },
  
  // 🔥 Webpack configuratie voor cache control
  webpack: (config, { dev, isServer }) => {
    // Disable webpack persistent caching in production
    if (!dev) {
      config.cache = false;
    }
    
    return config;
  },
};

module.exports = nextConfig;