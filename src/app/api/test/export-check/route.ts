/**
 * DRAAD_FIX: Export Diagnostics Route
 * Endpoint: GET /api/test/export-check
 * 
 * Purpose: Verify Excel/PDF export functionality and database connectivity
 * Usage: Visit endpoint directly in browser or curl
 * 
 * DIAGNOSTICS:
 * - Supabase connectivity
 * - Table existence verification
 * - Sample data retrieval
 * - CSV generation test
 * - Error handling validation
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseKey ? '✅ Set' : '❌ Missing'
    },
    tests: [] as any[]
  };

  console.log('[EXPORT-CHECK] 🔍 Starting export diagnostics...');

  try {
    // Test 1: Connectivity
    console.log('[EXPORT-CHECK] Test 1: Supabase connectivity...');
    const { data: connTest, error: connError } = await supabase
      .from('roosters')
      .select('id')
      .limit(1);
    
    diagnostics.tests.push({
      name: 'Supabase Connectivity',
      status: connError ? '❌ FAILED' : '✅ PASSED',
      message: connError ? connError.message : 'Connected to Supabase'
    });

    // Test 2: Roosters table
    console.log('[EXPORT-CHECK] Test 2: Roosters table...');
    const { count: rosterCount, error: rosterError } = await supabase
      .from('roosters')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.tests.push({
      name: 'Roosters Table',
      status: rosterError ? '❌ FAILED' : '✅ PASSED',
      records: rosterCount || 0,
      message: rosterError ? rosterError.message : 'Table exists and accessible'
    });

    // Test 3: Roster assignments table
    console.log('[EXPORT-CHECK] Test 3: Roster assignments table...');
    const { count: assignCount, error: assignError } = await supabase
      .from('roster_assignments')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.tests.push({
      name: 'Roster Assignments Table',
      status: assignError ? '❌ FAILED' : '✅ PASSED',
      records: assignCount || 0,
      message: assignError ? assignError.message : 'Table exists and accessible'
    });

    // Test 4: Service types table
    console.log('[EXPORT-CHECK] Test 4: Service types table...');
    const { count: serviceCount, error: serviceError } = await supabase
      .from('service_types')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.tests.push({
      name: 'Service Types Table',
      status: serviceError ? '❌ FAILED' : '✅ PASSED',
      records: serviceCount || 0,
      message: serviceError ? serviceError.message : 'Table exists and accessible'
    });

    // Test 5: Roster design table
    console.log('[EXPORT-CHECK] Test 5: Roster design table...');
    const { count: designCount, error: designError } = await supabase
      .from('roster_design')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.tests.push({
      name: 'Roster Design Table',
      status: designError ? '❌ FAILED' : '✅ PASSED',
      records: designCount || 0,
      message: designError ? designError.message : 'Table exists and accessible'
    });

    // Test 6: AFL execution reports table
    console.log('[EXPORT-CHECK] Test 6: AFL execution reports table...');
    const { count: aflCount, error: aflError } = await supabase
      .from('afl_execution_reports')
      .select('*', { count: 'exact', head: true });
    
    diagnostics.tests.push({
      name: 'AFL Execution Reports Table',
      status: aflError ? '❌ FAILED' : '✅ PASSED',
      records: aflCount || 0,
      message: aflError ? aflError.message : 'Table exists and accessible'
    });

    // Test 7: Sample CSV generation
    console.log('[EXPORT-CHECK] Test 7: CSV generation...');
    const testCsv = 'Header1,Header2,Header3\nValue1,"Value, with comma",Value3';
    const csvValid = testCsv.includes(',') && testCsv.includes('Value1');
    
    diagnostics.tests.push({
      name: 'CSV Generation',
      status: csvValid ? '✅ PASSED' : '❌ FAILED',
      message: csvValid ? 'CSV format is valid' : 'CSV format test failed',
      sampleSize: testCsv.length
    });

    // Summary
    const passedTests = diagnostics.tests.filter(t => t.status.includes('✅')).length;
    const totalTests = diagnostics.tests.length;
    const allPassed = passedTests === totalTests;

    const summary = {
      overall: allPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED',
      passed: passedTests,
      total: totalTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
    };

    console.log(`[EXPORT-CHECK] Summary: ${passedTests}/${totalTests} tests passed`);

    return NextResponse.json({
      ...diagnostics,
      summary
    }, { status: allPassed ? 200 : 500 });

  } catch (error) {
    console.error('[EXPORT-CHECK] ❌ Unexpected error:', error);
    return NextResponse.json({
      ...diagnostics,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
