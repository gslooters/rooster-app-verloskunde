/**
 * 🔍 DIAGNOSTIEK FASE 1B: Export Routes Verification
 * Endpoint: GET/POST /api/health/verify-exports
 * 
 * Purpose:
 * - Verifieer of PDF/Excel export routes bereikbaar zijn
 * - Test route connectivity zonder data
 * - Diagnostiek voor route registration in Next.js build
 * 
 * CRITICAL: force-dynamic om caching uit te sluiten
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';

// ==================== TYPE DEFINITIONS ====================

/**
 * Type for individual route test result
 */
interface RouteTestResult {
  path: string;
  status_code: number;
  reachable: boolean;
  response_type?: string;
  response_time_ms: number;
  timestamp: string;
  error?: string;
}

/**
 * Type for verification results summary
 */
interface VerificationSummary {
  total: number;
  reachable: number;
  unreachable: number;
  status: string;
}

/**
 * Type for interpretation guidance
 */
interface InterpretationGuidance {
  [key: string]: {
    meaning: string;
    next_step: string;
  };
}

/**
 * Type for complete response payload
 */
interface VerificationResponse {
  timestamp: string;
  routes_checked: RouteTestResult[];
  summary: VerificationSummary;
  interpretation: InterpretationGuidance;
  diagnostic_hints: string[];
}

// Log initialization
console.log('[EXPORT-VERIFY] ✅ Export verification route loaded at:', new Date().toISOString());

/**
 * GET handler - Verify export routes
 */
export async function GET(request: NextRequest): Promise<NextResponse<VerificationResponse>> {
  const timestamp = new Date().toISOString();
  const results: VerificationResponse = {
    timestamp: timestamp,
    routes_checked: [],
    summary: {
      total: 0,
      reachable: 0,
      unreachable: 0,
      status: 'UNKNOWN'
    },
    interpretation: {},
    diagnostic_hints: []
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[EXPORT-VERIFY] 🔍 Starting export routes verification`);
  console.log(`[EXPORT-VERIFY] 📊 Timestamp: ${timestamp}`);

  // Test PDF export route
  console.log(`[EXPORT-VERIFY] 🧪 Testing PDF export route...`);
  const pdfTest = await testRoute('/api/afl/export/pdf');
  results.routes_checked.push(pdfTest);
  results.summary.total++;
  if (pdfTest.reachable) results.summary.reachable++;
  else results.summary.unreachable++;

  // Test Excel export route
  console.log(`[EXPORT-VERIFY] 🧪 Testing Excel export route...`);
  const excelTest = await testRoute('/api/afl/export/excel');
  results.routes_checked.push(excelTest);
  results.summary.total++;
  if (excelTest.reachable) results.summary.reachable++;
  else results.summary.unreachable++;

  // Determine status
  if (results.summary.reachable === results.summary.total) {
    results.summary.status = '✅ ALL ROUTES REACHABLE';
    console.log(`[EXPORT-VERIFY] ✅ All routes reachable!`);
  } else if (results.summary.reachable === 0) {
    results.summary.status = '❌ NO ROUTES REACHABLE';
    console.log(`[EXPORT-VERIFY] ❌ No routes reachable - ROOT CAUSE LIKELY: Route caching/optimization`);
  } else {
    results.summary.status = '⚠️ PARTIAL - Some routes missing';
    console.log(`[EXPORT-VERIFY] ⚠️ Partial failure - mixed results`);
  }

  // Add interpretation
  results.interpretation = {
    all_reachable: {
      meaning: 'Both export routes are registered and accessible',
      next_step: 'Issue is elsewhere - check database, Supabase credentials, etc.'
    },
    none_reachable: {
      meaning: 'Routes are being cached/optimized away by Next.js build',
      next_step: 'MIDDLEWARE PHASE 2 REQUIRED - Cannot use route.ts pattern'
    },
    partial: {
      meaning: 'One route works, one doesnt - indicates build inconsistency',
      next_step: 'Investigate why one route registered and other didnt'
    }
  };

  // Add diagnostic hints
  results.diagnostic_hints = [
    '⚠️  If BOTH routes unreachable: Check Railway logs for [PDF-ROUTE] and [EXCEL-ROUTE] messages',
    '⚠️  Missing messages = Routes not registered in build = Middleware needed',
    '✅  If BOTH routes reachable: Export function logic is the issue, not routing',
    '✅  Check Supabase credentials, database access, response formatting'
  ];

  console.log(`[EXPORT-VERIFY] 📊 Summary: ${results.summary.status}`);
  console.log(`${'='.repeat(80)}\n`);

  return NextResponse.json(results, {
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
 * Test if a route is reachable
 * @param path - API route path to test
 * @returns Promise<RouteTestResult> - Test result with status and timing
 */
async function testRoute(path: string): Promise<RouteTestResult> {
  const startTime = Date.now();
  const fullUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}${path}?_test=1&_t=${Date.now()}`;

  console.log(`[EXPORT-VERIFY]   Testing ${path}...`);
  console.log(`[EXPORT-VERIFY]   URL: ${fullUrl}`);

  try {
    // Send a HEAD request (no body) to test if route exists
    const response = await fetch(fullUrl, {
      method: 'HEAD',
      timeout: 5000,
      // Don't follow redirects to 404
      redirect: 'manual'
    }).catch(err => {
      console.log(`[EXPORT-VERIFY]   Fetch error (trying GET): ${(err as Error).message}`);
      // Try GET instead
      return fetch(fullUrl, {
        method: 'GET',
        timeout: 5000,
        redirect: 'manual'
      });
    });

    const elapsed = Date.now() - startTime;
    const reachable = response.status !== 404 && response.status < 500;
    const responseType = response.headers.get('content-type') || 'unknown';

    const result: RouteTestResult = {
      path: path,
      status_code: response.status,
      reachable: reachable,
      response_type: responseType,
      response_time_ms: elapsed,
      timestamp: new Date().toISOString()
    };

    if (reachable) {
      console.log(`[EXPORT-VERIFY]   ✅ ${path} is reachable (${response.status})`);
    } else {
      console.log(`[EXPORT-VERIFY]   ❌ ${path} returned ${response.status} - NOT REACHABLE`);
    }

    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(`[EXPORT-VERIFY]   ❌ ${path} failed: ${errorMessage}`);

    return {
      path: path,
      status_code: 0,
      reachable: false,
      error: errorMessage,
      response_time_ms: elapsed,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * POST handler
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerificationResponse>> {
  console.log('[EXPORT-VERIFY] ℹ️ POST request received - forwarding to GET');
  return GET(request);
}
