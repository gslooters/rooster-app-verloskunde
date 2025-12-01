// API route: POST reset roster planning constraint override naar origineel
// Next.js App Router route handler
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie

import { NextRequest, NextResponse } from 'next/server';
import { resetRosterPlanningConstraintToOriginal } from '@/lib/db/rosterPlanningConstraints';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reset = await resetRosterPlanningConstraintToOriginal(params.id);
    return NextResponse.json(reset);
  } catch (error) {
    console.error('API Error bij reset:', error);
    const errorMessage = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
