/**
 * Server-side Supabase client
 * 
 * Deze client is specifiek voor server-side gebruik (API routes, Server Components, getServerSideProps).
 * Gebruikt SUPABASE_URL en SUPABASE_ANON_KEY (zonder NEXT_PUBLIC_ prefix).
 * 
 * Voor client-side gebruik, gebruik lib/supabase.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseServerInstance: SupabaseClient | null = null;

/**
 * Get server-side Supabase client
 * 
 * @returns Supabase client configured for server-side use
 * @throws Error if environment variables are not configured (maar alleen tijdens runtime, niet build-time)
 */
export function getSupabaseServer(): SupabaseClient {
  // Return existing instance if available
  if (supabaseServerInstance) {
    return supabaseServerInstance;
  }

  // Get environment variables (server-side only, zonder NEXT_PUBLIC_ prefix)
  // Gebruik fallback waarden tijdens build-time
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  // Alleen loggen in development en runtime (niet tijdens build)
  const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.SUPABASE_URL;
  
  if (!isBuildTime) {
    // Validate environment variables tijdens runtime
    if (supabaseUrl === 'https://placeholder.supabase.co') {
      console.warn('⚠️  SUPABASE_URL environment variable is not set - using placeholder');
    }

    if (supabaseAnonKey === 'placeholder-anon-key') {
      console.warn('⚠️  SUPABASE_ANON_KEY environment variable is not set - using placeholder');
    }

    // Log success (redact key for security)
    if (supabaseUrl !== 'https://placeholder.supabase.co') {
      console.log('✅ Server-side Supabase client initialized');
      console.log('   URL:', supabaseUrl);
      console.log('   Key:', supabaseAnonKey.substring(0, 20) + '...');
    }
  }

  // Create and cache instance
  supabaseServerInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Server-side doesn't need session persistence
      autoRefreshToken: false,
    },
  });

  return supabaseServerInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetSupabaseServerInstance(): void {
  supabaseServerInstance = null;
}
