/**
 * 🔍 DIAGNOSTIEK FASE 1: Health Check Route
 * Endpoint: GET/POST /api/health/check
 * 
 * Purpose:
 * - Bewijzen dat API routing werkt
 * - Testen of PDF/Excel routes bereikbaar zijn
 * - Diagnostiek voor Next.js route caching issues
 * 
 * CRITICAL: force-dynamic om caching uit te sluiten
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';

// Log initialization
console.log('[HEALTH-ROUTE] ✅ Health check route loaded at:', new Date().toISOString());
console.log('[HEALTH-ROUTE] ✅ GET/POST handlers registered');

/**
 * GET handler - Health check
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[HEALTH-ROUTE] 🔍 Health check request received`);
  console.log(`[HEALTH-ROUTE] 🆔 Request ID: ${requestId}`);
  console.log(`[HEALTH-ROUTE] ⏰ Timestamp: ${timestamp}`);
  console.log(`[HEALTH-ROUTE] 🌍 Environment: ${process.env.NODE_ENV}`);
  
  const responseData = {
    status: 'ok',
    timestamp: timestamp,
    requestId: requestId,
    environment: process.env.NODE_ENV || 'unknown',
    
    diagnostics: {
      health_check_route: {
        path: '/api/health/check',
        status: '✅ OPERATIONAL',
        description: 'This endpoint is working - Next.js routing is functional'
      },
      pdf_export_route: {
        path: '/api/afl/export/pdf',
        method: 'POST',
        required_params: ['afl_run_id (in query or body)'],
        expected_content_type: 'application/pdf',
        test_command: 'POST /api/afl/export/pdf?afl_run_id=<uuid>',
        status: '⏳ UNKNOWN - Call to test'
      },
      excel_export_route: {
        path: '/api/afl/export/excel',
        method: 'POST',
        required_params: ['rosterId (in query or body)'],
        expected_content_type: 'text/csv',
        test_command: 'POST /api/afl/export/excel?rosterId=<uuid>',
        status: '⏳ UNKNOWN - Call to test'
      }
    },
    
    next_steps: [
      '1. Health check is operational (you got this response)',
      '2. If you got this = API routing works',
      '3. If PDF/Excel export still fails = Routes are being cached/optimized away',
      '4. Check Railway logs for [PDF-ROUTE] and [EXCEL-ROUTE] messages',
      '5. If those messages don\'t appear = Middleware phase 2 needed'
    ],
    
    test_instructions: {
      get_health: {
        method: 'GET',
        url: '/api/health/check',
        expected_status: 200,
        expected_response: 'This JSON object'
      },
      test_pdf_export: {
        method: 'POST',
        url: '/api/afl/export/pdf',
        params: 'afl_run_id=065a08a3-3e8a-4ac8-ad1d-e98bb4625d9c',
        expected_status: 200,
        expected_response: 'PDF file (application/pdf)',
        note: 'Replace afl_run_id with a real value from your database'
      },
      test_excel_export: {
        method: 'POST',
        url: '/api/afl/export/excel',
        params: 'rosterId=ae01d559-c1b0-4759-8ff7-bb7066e5c44b',
        expected_status: 200,
        expected_response: 'CSV file (text/csv)',
        note: 'Replace rosterId with a real value from your database'
      }
    }
  };

  console.log('[HEALTH-ROUTE] ✅ Returning diagnostic data');
  console.log(`${'='.repeat(80)}\n`);

  return NextResponse.json(responseData, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

/**
 * POST handler - Also accept POST for health checks
 */
export async function POST(request: NextRequest) {
  console.log('[HEALTH-ROUTE] ℹ️ POST request received - forwarding to GET handler');
  return GET(request);
}

/**
 * HEAD handler - Quick check without response body
 */
export async function HEAD(request: NextRequest) {
  console.log('[HEALTH-ROUTE] ℹ️ HEAD request received - returning 200 OK');
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
