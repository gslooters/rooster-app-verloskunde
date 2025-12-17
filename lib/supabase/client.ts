'use client'; // Next.js client-side directive

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * DRAAD-206: Browser-side Supabase client
 * 
 * Used by Frontend React components (useGreedyRealtimeMonitor, etc.)
 * Must use NEXT_PUBLIC environment variables (visible in browser)
 * Provides realtime subscriptions and data access via RLS policies
 * 
 * Different from server.ts which uses SERVICE_ROLE_KEY (admin access)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SUPABASE-CLIENT] Missing environment variables:\n' +
    `NEXT_PUBLIC_SUPABASE_URL: ${!!supabaseUrl}\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${!!supabaseAnonKey}`
  );
}

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase client for browser/React components
 * 
 * DRAAD-205: Frontend integration with realtime monitoring
 * Used by useGreedyRealtimeMonitor and other client components
 * 
 * Features:
 * - Uses ANON_KEY (public key, safe for browser)
 * - Realtime subscriptions enabled
 * - Session persistence
 * - Auto-refresh tokens
 * - Detects session in URL
 * 
 * Security:
 * - Row-Level Security (RLS) policies enforce data access
 * - Service-key operations blocked (use backend for admin tasks)
 * - ANON_KEY has limited permissions
 * 
 * Usage:
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * 
 * // In React component:
 * const supabase = createClient();
 * const { data } = await supabase.from('table').select();
 * ```
 */
export function createClient(): SupabaseClient {
  // Return cached instance if already initialized
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  // Create new client instance
  supabaseClientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true, // Save session to localStorage
      autoRefreshToken: true, // Automatically refresh tokens
      detectSessionInUrl: true // Detect session in URL (for OAuth callbacks)
    },
    global: {
      headers: {
        'x-application': 'rooster-app-verloskunde',
        'x-client-type': 'browser'
      }
    },
    realtime: {
      params: {
        eventsPerSecond: 10 // Limit realtime events for performance
      }
    }
  });

  console.log('[SUPABASE-CLIENT] ✅ Client initialized for browser usage');

  return supabaseClientInstance;
}

/**
 * Singleton instance for direct usage
 * 
 * Usage:
 * ```typescript
 * import { supabase } from '@/lib/supabase/client';
 * const { data } = await supabase.from('table').select();
 * ```
 */
export const supabase = createClient();
