import { NextResponse } from 'next/server';

/**
 * Diagnostic API Endpoint - Test Environment Variables
 * 
 * URL: /api/test-env
 * 
 * Purpose: Verify server-side environment variables are correctly configured.
 * This endpoint helps diagnose "Geen Data" errors by checking if SUPABASE_URL
 * and SUPABASE_ANON_KEY are accessible from server-side code.
 * 
 * SECURITY NOTE: This endpoint masks sensitive values for production safety.
 */
export async function GET() {
  try {
    // Check client-side variables (NEXT_PUBLIC_*)
    const clientSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clientSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Check server-side variables (without NEXT_PUBLIC_ prefix)
    const serverSupabaseUrl = process.env.SUPABASE_URL;
    const serverSupabaseKey = process.env.SUPABASE_ANON_KEY;
    
    // Helper function to mask sensitive values
    const maskValue = (value: string | undefined): string => {
      if (!value) return '❌ NOT SET';
      if (value.length < 20) return value.substring(0, 10) + '...';
      return value.substring(0, 20) + '...' + ` (${value.length} chars)`;
    };
    
    // Build diagnostic report
    const report = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      clientSide: {
        NEXT_PUBLIC_SUPABASE_URL: {
          set: !!clientSupabaseUrl,
          value: maskValue(clientSupabaseUrl),
        },
        NEXT_PUBLIC_SUPABASE_ANON_KEY: {
          set: !!clientSupabaseKey,
          value: maskValue(clientSupabaseKey),
        },
      },
      serverSide: {
        SUPABASE_URL: {
          set: !!serverSupabaseUrl,
          value: maskValue(serverSupabaseUrl),
          critical: true,
        },
        SUPABASE_ANON_KEY: {
          set: !!serverSupabaseKey,
          value: maskValue(serverSupabaseKey),
          critical: true,
        },
      },
      diagnosis: {
        clientOk: !!clientSupabaseUrl && !!clientSupabaseKey,
        serverOk: !!serverSupabaseUrl && !!serverSupabaseKey,
        valuesMatch: clientSupabaseUrl === serverSupabaseUrl,
      },
      recommendations: [],
    };
    
    // Add recommendations based on diagnosis
    if (!report.diagnosis.serverOk) {
      report.recommendations.push(
        '❌ CRITICAL: Server-side environment variables not set!',
        'Add SUPABASE_URL and SUPABASE_ANON_KEY to Railway (without NEXT_PUBLIC_ prefix)',
        'See docs/RAILWAY_ENV_SETUP.md for instructions'
      );
    }
    
    if (!report.diagnosis.clientOk) {
      report.recommendations.push(
        '⚠️ WARNING: Client-side environment variables not set!',
        'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Railway'
      );
    }
    
    if (report.diagnosis.serverOk && report.diagnosis.clientOk && !report.diagnosis.valuesMatch) {
      report.recommendations.push(
        '⚠️ WARNING: Server and client URLs do not match!',
        'Ensure SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL have the same value'
      );
    }
    
    if (report.diagnosis.serverOk && report.diagnosis.clientOk && report.diagnosis.valuesMatch) {
      report.recommendations.push(
        '✅ All environment variables are correctly configured!',
        'If you still see "Geen Data" errors, check Railway deployment logs'
      );
    }
    
    // Return diagnostic report
    return NextResponse.json(report, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('❌ Error in test-env endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to check environment variables',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
