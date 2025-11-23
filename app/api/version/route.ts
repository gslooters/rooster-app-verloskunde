import { NextResponse } from 'next/server';

/**
 * 🔍 DRAAD1E: DEPLOYMENT VERSION VERIFICATIE ENDPOINT
 * 
 * DOEL:
 * - Verifieer welke code versie daadwerkelijk draait op Railway
 * - Toon commit SHA, build tijd, en environment info
 * - Detecteer "stuck deployments" (oude code draait nog)
 * 
 * GEBRUIK:
 * - URL: https://your-app.railway.app/api/version
 * - Vergelijk 'commit' met laatste GitHub commit SHA
 * - Als niet gelijk → deployment stuck of cache probleem!
 * 
 * RESPONSE FORMAT:
 * {
 *   "commit": "abc123...",      // Railway Git SHA
 *   "shortCommit": "abc123",    // Eerste 7 chars
 *   "buildTime": "2025-11-23T...", // ISO timestamp
 *   "environment": "production",
 *   "nodeVersion": "20.x",
 *   "nextVersion": "14.x",
 *   "platform": "railway",
 *   "expectedCommit": "d0a92afb" // Laatste bekende commit
 * }
 */

// Force dynamic rendering (geen cache!)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Build-time constanten
const BUILD_TIME = new Date().toISOString();
const EXPECTED_COMMIT = 'd0a92afb'; // DRAAD1E: Updated naar laatste deployment

export async function GET() {
  try {
    // Haal Railway Git commit SHA op
    const fullCommit = process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
    const shortCommit = fullCommit.substring(0, 8);
    
    // Build deployment info object
    const versionInfo = {
      // Core deployment info
      commit: fullCommit,
      shortCommit: shortCommit,
      buildTime: BUILD_TIME,
      requestTime: new Date().toISOString(),
      
      // Environment info
      environment: process.env.NODE_ENV || 'unknown',
      platform: process.env.RAILWAY_ENVIRONMENT || 'railway',
      
      // Version info
      nodeVersion: process.version,
      nextVersion: '14.2.18', // Next.js version from package.json
      
      // Verification
      expectedCommit: EXPECTED_COMMIT,
      isExpectedVersion: shortCommit.startsWith(EXPECTED_COMMIT),
      
      // Railway specific
      railwayService: process.env.RAILWAY_SERVICE_NAME || 'unknown',
      railwayEnvironment: process.env.RAILWAY_ENVIRONMENT_NAME || 'unknown',
      
      // Supabase connection (niet gevoelig)
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL),
      
      // Cache busting info
      cacheBustTime: Date.now(),
      cacheControl: 'no-store, no-cache, must-revalidate'
    };
    
    // Log voor debugging
    console.log('🔍 DRAAD1E Version Check:', {
      commit: shortCommit,
      expected: EXPECTED_COMMIT,
      match: versionInfo.isExpectedVersion ? '✅ CORRECT' : '❌ VERKEERD',
      buildTime: BUILD_TIME
    });
    
    // Return met anti-cache headers
    return NextResponse.json(versionInfo, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });
    
  } catch (error: any) {
    console.error('❌ DRAAD1E Version endpoint error:', error.message);
    
    return NextResponse.json(
      {
        error: 'Version check failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
