/**
 * DRAAD172: Roster Solve API Endpoint
 * Status: Sequential solver integration
 * Date: 2025-12-13
 * 
 * Endpoint: POST /api/roster/solve
 * Body: { rosterPeriodId: string }
 * 
 * Returns: { assignments: [...], unfulfilled: {...}, report: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import os from 'os';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const { rosterPeriodId } = await request.json();

    if (!rosterPeriodId) {
      return NextResponse.json(
        { error: 'rosterPeriodId required' },
        { status: 400 }
      );
    }

    console.log(`[SOLVER] Starting solve for roster ${rosterPeriodId}`);

    // Create temporary Python script to run solver
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `solver_${Date.now()}.py`);
    const outputPath = path.join(tempDir, `solver_output_${Date.now()}.json`);

    // Python solver script
    const solverScript = `
import sys
import os
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, '${path.join(process.cwd(), 'src')}')

from solver.requirement_queue import RequirementQueue
from solver.employee_availability import EmployeeAvailabilityTracker
from solver.sequential_solver import SequentialSolver
from solver.assignment_report import AssignmentReport

# Mock database for demo
class MockDB:
    def execute(self, sql, params=None):
        # In real implementation, connect to actual DB
        return MockCursor()

class MockCursor:
    def fetchall(self):
        return []
    def fetchone(self):
        return {'id': '1', 'code': 'TEST', 'name': 'Test', 'is_system': False}

# Execute solver
try:
    db = MockDB()
    roster_id = '${rosterPeriodId}'
    
    solver = SequentialSolver(db)
    assignments, unfulfilled = solver.solve(roster_id)
    
    # Generate report
    report = AssignmentReport(roster_id, 'Roster')
    report.add_assignments(assignments, db)
    report.add_unfulfilled(unfulfilled, db)
    
    # Output
    result = {
        'success': True,
        'assignments': [{
            'employee_id': a.employee_id,
            'service_id': a.service_id,
            'date': a.assignment_date.isoformat(),
            'dagdeel': a.dagdeel
        } for a in assignments],
        'unfulfilled': unfulfilled,
        'report': report.to_dict()
    }
    
    with open('${outputPath}', 'w') as f:
        json.dump(result, f)
    
except Exception as e:
    result = {'success': False, 'error': str(e)}
    with open('${outputPath}', 'w') as f:
        json.dump(result, f)
`;

    fs.writeFileSync(scriptPath, solverScript);

    // Execute solver
    try {
      execSync(`python3 ${scriptPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (execError: any) {
      console.error('[SOLVER] Execution error:', execError.message);
      return NextResponse.json(
        { error: 'Solver execution failed', details: execError.message },
        { status: 500 }
      );
    }

    // Read results
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json(
        { error: 'Solver did not produce output' },
        { status: 500 }
      );
    }

    const output = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

    // Clean up
    fs.unlinkSync(scriptPath);
    fs.unlinkSync(outputPath);

    if (!output.success) {
      return NextResponse.json(
        { error: output.error || 'Unknown solver error' },
        { status: 500 }
      );
    }

    // Insert assignments into database
    console.log(`[SOLVER] Inserting ${output.assignments.length} assignments`);

    for (const assignment of output.assignments) {
      const { error } = await supabase
        .from('roster_assignments')
        .insert({
          employee_id: assignment.employee_id,
          service_id: assignment.service_id,
          date: assignment.date,
          dagdeel: assignment.dagdeel,
          status: 0, // Open (will be filled by solver)
          roster_period_id: rosterPeriodId
        });

      if (error) {
        console.error('[SOLVER] Insert error:', error);
        // Continue on insert errors to not block entire operation
      }
    }

    // Save report
    console.log('[SOLVER] Saving report');
    const { error: reportError } = await supabase
      .from('solver_reports')
      .insert({
        roster_period_id: rosterPeriodId,
        report_data: output.report,
        unfulfilled_count: Object.values(output.unfulfilled).reduce(
          (sum: number, val: any) => sum + (val.unfulfilled_count || 0), 0
        ),
        created_at: new Date().toISOString()
      });

    if (reportError) {
      console.warn('[SOLVER] Report save error:', reportError);
    }

    return NextResponse.json({
      success: true,
      assignments: output.assignments,
      unfulfilled: output.unfulfilled,
      summary: output.report.summary
    });

  } catch (error: any) {
    console.error('[SOLVER] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
