// HEALTH CHECK ENDPOINT - Deployment Verification
import { NextResponse } from 'next/server';
import { CACHE_VERSION, BUILD_ID, DEPLOYMENT_TRIGGER } from '@/lib/cache-bust';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Rooster App Verloskunde',
    timestamp: new Date().toISOString(),
    deployment: {
      buildId: BUILD_ID,
      cacheVersion: CACHE_VERSION,
      trigger: DEPLOYMENT_TRIGGER,
      railwayDeployment: process.env.RAILWAY_DEPLOYMENT_ID || 'local',
      environment: process.env.NODE_ENV || 'development'
    },
    database: {
      supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL
    },
    version: '1.0.0-draad48'
  });
}
