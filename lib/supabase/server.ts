/**
 * Server-side Supabase client
 * 
 * Deze module biedt server-side Supabase client voor gebruik in:
 * - API Routes (app/api/**/route.ts)
 * - Server Components
 * - Server Actions
 * 
 * BELANGRIJK: Dit bestand MOET async createClient() exporteren
 * voor compatibiliteit met Next.js 14 App Router patterns.
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create server-side Supabase client (async functie voor Next.js 14)
 * 
 * Deze functie maakt een Supabase client aan met server-side credentials.
 * Het gebruikt cookies voor auth indien beschikbaar.
 * 
 * @returns Promise<SupabaseClient> - Configured Supabase client
 */
export async function createClient(): Promise<SupabaseClient> {
  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Validatie (alleen runtime, niet build-time)
  if (!supabaseUrl && process.env.NODE_ENV !== 'production') {
    console.warn('[Supabase] SUPABASE_URL not set');
  }

  if (!supabaseAnonKey && process.env.NODE_ENV !== 'production') {
    console.warn('[Supabase] SUPABASE_ANON_KEY not set');
  }

  // Probeer auth cookie te lezen (alleen runtime, niet build-time)
  let authHeader: Record<string, string> = {};
  
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('sb-access-token')?.value;
    
    if (authCookie) {
      authHeader = {
        Authorization: `Bearer ${authCookie}`
      };
    }
  } catch (error) {
    // Cookies niet beschikbaar (build-time of statische export)
    // Dit is normaal tijdens build, negeer
  }

  // Create Supabase client with resolved headers
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Server-side doesn't persist sessions
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: authHeader // Synchronous headers object
    }
  });
}

/**
 * Legacy export voor backwards compatibility
 * 
 * @deprecated Gebruik createClient() in plaats van getSupabaseServer()
 */
export function getSupabaseServer(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
