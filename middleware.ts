import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 🔒 CRITICAL: Next.js Middleware voor Supabase Authentication
 * 
 * Deze middleware is VERPLICHT voor Supabase Auth Helpers in Next.js 13+ App Router
 * 
 * Functionaliteit:
 * 1. Refresh expired auth tokens automatisch
 * 2. Synchroniseer auth state tussen client/server
 * 3. Protect routes die authenticatie vereisen
 * 4. Set correct cookies voor session management
 * 
 * ZONDER deze middleware:
 * - Auth tokens verlopen zonder refresh
 * - Session inconsistenties tussen requests
 * - "Failed to fetch" errors in production
 * - 401/403 errors op protected routes
 */

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  try {
    // Maak Supabase client met middleware helpers
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session indien nodig (kritiek voor long-running sessions)
    const { data: { session } } = await supabase.auth.getSession()
    
    // Public routes die GEEN auth vereisen
    const publicRoutes = ['/login', '/api/health']
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))
    
    // Als geen session EN niet op public route -> redirect naar login
    if (!session && !isPublicRoute && req.nextUrl.pathname !== '/') {
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Als WEL session EN op login page -> redirect naar dashboard
    if (session && req.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    
    return res
    
  } catch (error) {
    // Log error maar laat request doorgaan (fail-open voor development)
    console.error('❌ Middleware error:', error)
    return res
  }
}

/**
 * Configureer welke routes middleware moet runnen
 * 
 * MATCH:
 * - Alle app routes behalve _next/static, _next/image, favicon.ico
 * - API routes voor session refresh
 * 
 * SKIP:
 * - Static assets (performance)
 * - Next.js internals
 * - Public files
 */
export const config = {
  matcher: [
    /*
     * Match alle routes BEHALVE:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
