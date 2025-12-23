// DRAAD348: PDF/Excel Export Routes - Cache-bust trigger
// Railway deployment trigger: Date.now() + Math.random()
// Updated: 2025-12-23T10:42:00Z
import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = Date.now();
  const random = Math.random();
  const cacheId = `DRAAD348-${timestamp}-${random}`;

  return NextResponse.json({
    draad: 'DRAAD348',
    purpose: 'PDF and Excel export route cache-bust trigger',
    timestamp: new Date().toISOString(),
    cacheId,
    deployed: true,
    railwayTrigger: timestamp + random,
    routes: [
      '/api/afl/export/pdf',
      '/api/afl/export/excel'
    ]
  });
}
