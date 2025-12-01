// API route: GET all planning constraints
// Next.js App Router route handler
// Returns alle constraints gesorteerd op priority
import { NextResponse } from 'next/server';
import { getAllPlanningConstraints } from '@/lib/db/planningConstraints';

export async function GET() {
  try {
    const constraints = await getAllPlanningConstraints();
    return NextResponse.json(constraints);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}
