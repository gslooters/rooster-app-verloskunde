import { NextResponse } from 'next/server';

/**
 * Health check endpoint voor Railway deployment
 * Deze endpoint wordt gebruikt door Railway om te controleren
 * of de applicatie succesvol is opgestart en requests kan verwerken
 */
export async function GET() {
  return NextResponse.json(
    { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'rooster-app-verloskunde'
    },
    { status: 200 }
  );
}
