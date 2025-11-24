// CACHE-BUSTING CONFIGURATION
// Auto-generated at: 2025-11-24T18:34:30.000Z
// Deployment: DRAAD59C - TSCONFIG PATH MAPPING FIX

/**
 * Build-time cache versioning
 * This file is updated on each deployment to force cache invalidation
 */

// Unique build identifier based on timestamp
export const BUILD_ID = `build-${Date.now()}`;

// Cache version for CDN and browser cache invalidation
export const CACHE_VERSION = `v${Date.now()}`;

// Railway deployment trigger (random number forces rebuild)
export const DEPLOYMENT_TRIGGER = Math.random().toString(36).substring(2, 15);

// Deployment metadata
export const DEPLOYMENT_INFO = {
  timestamp: new Date().toISOString(),
  buildId: BUILD_ID,
  cacheVersion: CACHE_VERSION,
  trigger: DEPLOYMENT_TRIGGER,
  environment: process.env.NODE_ENV || 'production',
  railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
  deploymentName: 'DRAAD59C'
};

/**
 * Get cache-busted URL for assets
 * @param url - Original asset URL
 * @returns URL with cache-busting query parameter
 */
export function getCacheBustedUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${CACHE_VERSION}`;
}

/**
 * Check if deployment is fresh (less than 5 minutes old)
 */
export function isDeploymentFresh(): boolean {
  const buildTime = parseInt(BUILD_ID.split('-')[1]);
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return (currentTime - buildTime) < fiveMinutes;
}
