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
 * @throws Error if environment variables are not configured
 */
export function getSupabaseServer(): SupabaseClient {
  // Return existing instance if available
  if (supabaseServerInstance) {
    return supabaseServerInstance;
  }

  // Get environment variables (server-side only, without NEXT_PUBLIC_ prefix)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Validate environment variables
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL environment variable is not set');
    throw new Error('SUPABASE_URL environment variable is required for server-side Supabase client');
  }

  if (!supabaseAnonKey) {
    console.error('❌ SUPABASE_ANON_KEY environment variable is not set');
    throw new Error('SUPABASE_ANON_KEY environment variable is required for server-side Supabase client');
  }

  // Log success (redact key for security)
  console.log('✅ Server-side Supabase client initialized');
  console.log('   URL:', supabaseUrl);
  console.log('   Key:', supabaseAnonKey.substring(0, 20) + '...');

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
