// API route: GET roster planning constraints by roosterid
// Next.js App Router route handler
import { NextRequest, NextResponse } from 'next/server';
import { getRosterPlanningConstraintsByRoosterId } from '@/lib/db/rosterPlanningConstraints';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roosterId = searchParams.get('roosterid');

    if (!roosterId) {
      return NextResponse.json(
        { error: 'roosterid parameter is verplicht' },
        { status: 400 }
      );
    }

    const constraints = await getRosterPlanningConstraintsByRoosterId(roosterId);
    return NextResponse.json(constraints);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}
