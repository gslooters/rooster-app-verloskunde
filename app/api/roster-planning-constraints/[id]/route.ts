// API route: PATCH override & DELETE roster planning constraint by id
// Next.js App Router route handler
import { NextRequest, NextResponse } from 'next/server';
import { updateRosterPlanningConstraint, deleteRosterPlanningConstraint } from '@/lib/db/rosterPlanningConstraints';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updated = await updateRosterPlanningConstraint(params.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteRosterPlanningConstraint(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}
