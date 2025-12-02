// API route: GET all planning constraints
// Next.js App Router route handler
// Returns alle constraints gesorteerd op priority
import { NextResponse } from 'next/server';
import { getAllPlanningConstraints } from '@/lib/db/planningConstraints';

export async function GET() {
  try {
    const constraints = await getAllPlanningConstraints();
    // Voeg expliciet cache-busting headers toe
    const res = NextResponse.json(constraints);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}
