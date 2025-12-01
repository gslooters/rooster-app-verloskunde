// API route: GET roster planning constraints by roosterid & POST ad-hoc constraints
// Next.js App Router route handler
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie

import { NextRequest, NextResponse } from 'next/server';
import { getRosterPlanningConstraintsByRoosterId, createAdHocRosterPlanningConstraint } from '@/lib/db/rosterPlanningConstraints';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roosterId, ...constraintData } = body;

    if (!roosterId) {
      return NextResponse.json(
        { error: 'roosterId is verplicht' },
        { status: 400 }
      );
    }

    if (!constraintData.naam || !constraintData.type) {
      return NextResponse.json(
        { error: 'naam en type zijn verplicht' },
        { status: 400 }
      );
    }

    const newConstraint = await createAdHocRosterPlanningConstraint(roosterId, constraintData);
    return NextResponse.json(newConstraint, { status: 201 });
  } catch (error) {
    console.error('API Error bij aanmaken ad-hoc constraint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
