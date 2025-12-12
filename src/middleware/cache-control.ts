/**
 * ============================================================================
 * DRAAD 162A: Next.js Middleware for Cache Control
 * Purpose: Enforce cache invalidation headers on all API responses
 * Deploy Date: 2025-12-12
 * Version: DRAAD162A-v1
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // LAG 3: API HEADERS
  // Zet cache control headers op API endpoints
  const isApiRoute = pathname.startsWith('/api');
  const isStaffingData = 
    pathname.includes('planning') ||
    pathname.includes('dagdeel') ||
    pathname.includes('staffing') ||
    pathname.includes('roster');
  
  const response = NextResponse.next();
  
  if (isApiRoute && isStaffingData) {
    console.log(`🎯 [DRAAD162A-MIDDLEWARE] Setting cache headers for ${pathname}`);
    
    // Set cache control headers
    response.headers.set(
      'Cache-Control',
      'public, max-age=30, s-maxage=30, must-revalidate'
    );
    
    response.headers.set(
      'X-Cache-Buster',
      `draad162a-${Date.now()}`
    );
    
    response.headers.set(
      'X-Deploy-Version',
      'DRAAD162A-v1'
    );
    
    response.headers.set(
      'Pragma',
      'no-cache'
    );
    
    response.headers.set(
      'Expires',
      '0'
    );
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
