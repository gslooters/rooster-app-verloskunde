import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 🔒 Next.js Middleware voor Supabase Authentication
 * 
 * ⚠️ DEMO MODE: Authenticatie is OPTIONEEL
 * - Refresh tokens indien sessie bestaat
 * - GEEN redirects naar login (demo modus)
 * - Alle routes zijn publiek toegankelijk
 * 
 * Functionaliteit:
 * 1. Refresh expired auth tokens automatisch (indien session bestaat)
 * 2. Synchroniseer auth state tussen client/server
 * 3. Set correct cookies voor session management
 */

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  try {
    // Maak Supabase client met middleware helpers
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session indien nodig (kritiek voor long-running sessions)
    // Dit is optioneel - als er geen sessie is, gaat de app gewoon door
    await supabase.auth.getSession()
    
    // ✅ In DEMO modus: geen auth redirects
    // Gebruikers kunnen direct naar dashboard zonder in te loggen
    
    return res
    
  } catch (error) {
    // Log error maar laat request doorgaan (fail-open voor demo)
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
