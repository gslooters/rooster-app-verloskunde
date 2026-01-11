/**
 * Cache-Buster Helper
 * Ensures Railway deployment picks up latest code changes
 * 
 * Usage:
 * import { getCacheBuster } from './cache-buster';
 * const buster = getCacheBuster(); // random string
 */

export function getCacheBuster(): string {
  // Date.now() + random = guaranteed unique per deployment
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${timestamp}-${random}`;
}

export const DEPLOYMENT_ID = getCacheBuster();
export const DRAAD411_DEPLOYED = true; // Marker for deployment tracking

console.log(`[CACHE-BUSTER] DRAAD411 Deployment: ${DEPLOYMENT_ID}`);
