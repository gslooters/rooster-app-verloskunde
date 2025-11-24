// PDF API cache-bust DRAAD48-B fix - Next.js 14 App Router
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    now: Date.now(),
    trigger: Math.random(),
    deployed: new Date().toISOString()
  });
}
