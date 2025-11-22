import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 🏥 DRAAD1C: ROBUUSTE HEALTH CHECK ENDPOINT
 * 
 * DOEL:
 * - Verifieer dat Next.js server draait ✅
 * - Test Supabase database connectie ✅
 * - Geef Railway accurate health status ✅
 * 
 * RAILWAY CONFIG:
 * - Path: /api/health (in railway.toml)
 * - Timeout: 100 seconden
 * - Verwacht: 200 status bij success
 * 
 * RETURN CODES:
 * - 200: Alles OK (server + database)
 * - 503: Database problemen (service unavailable)
 * - 500: Onverwachte fout
 */

// Force dynamic rendering (geen cache!)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('🏥 Health check gestart...');
    
    // STAP 1: Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Health check FAILED: Supabase env vars missing');
      return NextResponse.json(
        { 
          status: 'unhealthy',
          error: 'Missing Supabase configuration',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }
    
    console.log('✅ Environment variables OK');
    
    // STAP 2: Test database connectie (lightweight query)
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🔍 Testing database connection...');
    
    // Quick test: count roosters (timeout na 5 sec)
    const { data, error, status: dbStatus } = await Promise.race([
      supabase
        .from('roosters')
        .select('id', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      )
    ]) as any;
    
    if (error) {
      console.error('❌ Database check FAILED:', {
        error: error.message,
        code: error.code,
        status: dbStatus
      });
      
      return NextResponse.json(
        { 
          status: 'degraded',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString(),
          responseTime: `${Date.now() - startTime}ms`
        },
        { status: 503 }
      );
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Health check PASSED (${responseTime}ms)`);
    
    // STAP 3: Return success
    return NextResponse.json(
      { 
        status: 'healthy',
        database: 'connected',
        server: 'online',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        environment: process.env.NODE_ENV || 'unknown'
      },
      { status: 200 }
    );
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Health check EXCEPTION:', {
      error: error.message,
      stack: error.stack,
      responseTime: `${responseTime}ms`
    });
    
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      },
      { status: 500 }
    );
  }
}
