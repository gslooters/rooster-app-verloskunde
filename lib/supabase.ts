import { createClient } from '@supabase/supabase-js'

// DRAAD186: Supabase initialization with proper error handling
// These variables MUST be provided via Railway environment or build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Error handling for missing environment variables
if (!supabaseUrl) {
  console.error('❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is not defined!')
  console.error('   This must be set in Railway environment variables or .env.local')
  console.error('   Expected format: https://[project-id].supabase.co')
}

if (!supabaseAnonKey) {
  console.error('❌ CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined!')
  console.error('   This must be set in Railway environment variables or .env.local')
}

// Create client with validated URLs
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// Log environment status (dev only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Supabase] Initialization status:')
  console.log('  - URL configured:', !!supabaseUrl)
  console.log('  - Key configured:', !!supabaseAnonKey)
}
