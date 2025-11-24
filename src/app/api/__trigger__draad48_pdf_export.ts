// PDF API cache-bust DRAAD48-B fix - Next.js 14 App Router
// Railway deployment trigger: 0.8743621
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    now: Date.now(),
    trigger: Math.random(),
    deployed: new Date().toISOString(),
    railwayTrigger: 0.8743621
  });
}
