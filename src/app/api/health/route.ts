// Health check endpoint voor Railway deployment
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '3.0.0-railway',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
}