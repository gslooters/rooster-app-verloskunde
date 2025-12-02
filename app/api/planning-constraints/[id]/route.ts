// API route: PATCH update & DELETE planning constraint by id
// Next.js App Router route handler
import { NextRequest, NextResponse } from 'next/server';
import {
  updatePlanningConstraint,
  deletePlanningConstraint,
  revalidatePlanningRulesCache
} from '@/lib/db/planningConstraints';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updated = await updatePlanningConstraint(params.id, body);
    await revalidatePlanningRulesCache(); // Forceer cache refresh
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
    await deletePlanningConstraint(params.id);
    await revalidatePlanningRulesCache(); // Forceer cache refresh
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    );
  }
}
