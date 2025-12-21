/**
 * AFL (Autofill) - Phase 5: Report Generator & Export
 * 
 * Generates comprehensive coverage reports with:
 * - Summary metrics (coverage %, rating, color)
 * - Per-service breakdown
 * - Bottleneck detection
 * - Employee capacity remaining
 * - Open slots analysis
 * - Performance metrics
 * - Export functions (PDF/Excel - placeholder for now)
 */

import { createClient } from '@supabase/supabase-js';
import {
  WorkbestandOpdracht,
  WorkbestandPlanning,
  WorkbestandCapaciteit,
  WorkbestandServicesMetadata,
  AflLoadResult,
  AflReport,
} from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Generate comprehensive AFL report
 * Based on load results + all workbenches
 */
export async function generateAflReport(params: {
  rosterId: string;
  afl_run_id: string;
  workbestand_planning: WorkbestandPlanning[];
  workbestand_opdracht: WorkbestandOpdracht[];
  workbestand_capaciteit: WorkbestandCapaciteit[];
  workbestand_services_metadata: WorkbestandServicesMetadata[];
  phase_timings: {
    load_ms: number;
    solve_ms: number;
    dio_chains_ms: number;
    database_write_ms: number;
  };
}): Promise<AflReport> {
  const reportStart = performance.now();

  try {
    // ===== CALCULATE SUMMARY METRICS =====
    const total_required = params.workbestand_opdracht.reduce((sum, t) => sum + t.aantal, 0);
    const total_planned = params.workbestand_planning.filter(
      (p) => p.status === 1 && p.service_id && !p.is_protected
    ).length; // Exclude pre-planning from AFL count
    const total_open = total_required - total_planned;
    const coverage_percent = total_required > 0 ? (total_planned / total_required) * 100 : 0;

    // Determine coverage rating and color
    const { rating, color } = getCoverageRating(coverage_percent);

    // ===== PLANNED BY SERVICE BREAKDOWN =====
    const planned_by_service = calculateServiceBreakdown(
      params.workbestand_opdracht,
      params.workbestand_planning,
      params.workbestand_services_metadata
    );

    // ===== BOTTLENECK DETECTION =====
    const bottleneck_services = detectBottlenecks(planned_by_service);

    // ===== TEAM BREAKDOWN =====
    const by_team = calculateTeamBreakdown(
      params.workbestand_opdracht,
      params.workbestand_planning
    );

    // ===== EMPLOYEE CAPACITY REMAINING =====
    const employee_capacity = calculateEmployeeCapacity(
      params.workbestand_planning,
      params.workbestand_capaciteit,
      params.workbestand_services_metadata
    );

    // ===== OPEN SLOTS ANALYSIS =====
    const open_slots = analyzeOpenSlots(
      params.workbestand_opdracht,
      params.workbestand_planning,
      params.workbestand_services_metadata
    );

    // ===== DAILY SUMMARY =====
    const daily_summary = calculateDailySummary(params.workbestand_planning);

    // ===== PHASE BREAKDOWN =====
    const report_generation_ms = performance.now() - reportStart;
    const phase_breakdown = {
      load_ms: params.phase_timings.load_ms,
      solve_ms: params.phase_timings.solve_ms,
      dio_chains_ms: params.phase_timings.dio_chains_ms,
      database_write_ms: params.phase_timings.database_write_ms,
      report_generation_ms,
    };

    const execution_time_ms = Object.values(phase_breakdown).reduce((a, b) => a + b, 0);

    const report: AflReport = {
      success: true,
      afl_run_id: params.afl_run_id,
      rosterId: params.rosterId,
      execution_time_ms,
      generated_at: new Date().toISOString(),
      summary: {
        total_required,
        total_planned,
        total_open,
        coverage_percent: Math.round(coverage_percent * 10) / 10, // 1 decimal
        coverage_rating: rating,
        coverage_color: color,
      },
      by_service: planned_by_service,
      bottleneck_services,
      by_team,
      employee_capacity,
      open_slots,
      daily_summary,
      phase_breakdown,
      audit: {
        afl_run_id: params.afl_run_id,
        rosterId: params.rosterId,
        generated_at: new Date().toISOString(),
        generated_by_user: 'system',
        duration_seconds: Math.round(execution_time_ms) / 1000,
      },
    };

    // Optionally store in database for audit trail
    await storeReportInDatabase(report);

    return report;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    console.error('[Report Engine] Report generation failed:', error_message);

    throw new Error(`Report generation failed: ${error_message}`);
  }
}

/**
 * Get coverage rating and color based on percentage
 */
function getCoverageRating(
  coverage_percent: number
): { rating: 'excellent' | 'good' | 'fair' | 'poor'; color: string } {
  if (coverage_percent >= 95) {
    return { rating: 'excellent', color: '#00AA00' };
  } else if (coverage_percent >= 85) {
    return { rating: 'good', color: '#00CC00' };
  } else if (coverage_percent >= 75) {
    return { rating: 'fair', color: '#FFA500' };
  } else {
    return { rating: 'poor', color: '#FF0000' };
  }
}

/**
 * Calculate breakdown by service
 */
function calculateServiceBreakdown(
  tasks: WorkbestandOpdracht[],
  planning: WorkbestandPlanning[],
  services: WorkbestandServicesMetadata[]
) {
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const breakdown = new Map<string, any>();

  // For each task, count planned assignments
  for (const task of tasks) {
    const key = task.service_code;
    const service = serviceMap.get(task.service_id);

    if (!breakdown.has(key)) {
      breakdown.set(key, {
        service_code: task.service_code,
        service_name: service?.naam || task.service_code,
        required: 0,
        planned: 0,
        open: 0,
        completion_percent: 0,
        status: 'unknown',
      });
    }

    const entry = breakdown.get(key);
    entry.required += task.aantal;
  }

  // Count planned assignments per service
  for (const slot of planning) {
    if (slot.status === 1 && slot.service_id) {
      const service = serviceMap.get(slot.service_id);
      if (service) {
        const entry = breakdown.get(service.code);
        if (entry) {
          entry.planned += 1;
        }
      }
    }
  }

  // Calculate remaining and status
  for (const entry of breakdown.values()) {
    entry.open = Math.max(0, entry.required - entry.planned);
    entry.completion_percent =
      entry.required > 0 ? Math.round((entry.planned / entry.required) * 100 * 10) / 10 : 0;

    if (entry.open === 0) {
      entry.status = 'complete';
    } else if ((entry.open / entry.required) * 100 > 10) {
      entry.status = 'bottleneck';
    } else if ((entry.open / entry.required) * 100 > 5) {
      entry.status = 'fair';
    } else {
      entry.status = 'good';
    }
  }

  return Array.from(breakdown.values());
}

/**
 * Detect bottleneck services (>10% open)
 */
function detectBottlenecks(
  serviceBreakdown: any[]
) {
  return serviceBreakdown
    .filter(
      (s) =>
        s.open > 0 && (s.open / s.required) * 100 > 10 && s.open >= 2
    )
    .map((s) => ({
      service_code: s.service_code,
      required: s.required,
      planned: s.planned,
      open: s.open,
      open_percent: Math.round(((s.open / s.required) * 100) * 10) / 10,
      reason: `Insufficient ${s.service_code}-trained staff available`,
      affected_teams: [], // Could be enhanced
    }));
}

/**
 * Calculate breakdown by team
 */
function calculateTeamBreakdown(
  tasks: WorkbestandOpdracht[],
  planning: WorkbestandPlanning[]
) {
  const teamMap = new Map<string, any>();

  // Initialize teams from tasks
  for (const task of tasks) {
    if (!teamMap.has(task.team)) {
      teamMap.set(task.team, {
        team_code: task.team,
        team_name: getTeamName(task.team),
        required: 0,
        planned: 0,
        open: 0,
        completion_percent: 0,
      });
    }
  }

  // Count required per team (would need employee team mapping)
  // For now, simplified calculation
  for (const task of tasks) {
    const entry = teamMap.get(task.team);
    if (entry) {
      entry.required += task.aantal;
    }
  }

  // Count planned (simplified - all assignments)
  const plannedCount = planning.filter((p) => p.status === 1 && p.service_id).length;
  const avgPerTeam = Math.floor(plannedCount / Math.max(1, teamMap.size));

  for (const entry of teamMap.values()) {
    entry.planned = avgPerTeam; // Simplified
    entry.open = Math.max(0, entry.required - entry.planned);
    entry.completion_percent =
      entry.required > 0 ? Math.round((entry.planned / entry.required) * 100 * 10) / 10 : 0;
  }

  return Array.from(teamMap.values());
}

/**
 * Get team display name
 */
function getTeamName(team_code: string): string {
  const names: Record<string, string> = {
    GRO: 'Team Groen',
    ORA: 'Team Oranje',
    TOT: 'Totaal Praktijk',
  };
  return names[team_code] || team_code;
}

/**
 * Calculate remaining employee capacity
 */
function calculateEmployeeCapacity(
  planning: WorkbestandPlanning[],
  capacity: WorkbestandCapaciteit[],
  services: WorkbestandServicesMetadata[]
) {
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const employeeMap = new Map<string, any>();

  // Build employee capacity map
  for (const cap of capacity) {
    const key = cap.employee_id;
    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        employee_id: cap.employee_id,
        employee_name: getEmployeeName(cap.employee_id), // Could fetch from DB
        team: 'Unknown',
        total_assignments: 0,
        by_service: [],
      });
    }

    const entry = employeeMap.get(key);
    entry.by_service.push({
      service_code: cap.service_code,
      initial_capacity: cap.aantal,
      assigned: 0,
      remaining: cap.aantal,
    });
  }

  // Count assignments per employee/service
  for (const slot of planning) {
    if (slot.status === 1 && slot.service_id && !slot.is_protected) {
      const emp = employeeMap.get(slot.employee_id);
      if (emp) {
        emp.total_assignments += 1;
        const service = serviceMap.get(slot.service_id);
        if (service) {
          const srvEntry = emp.by_service.find((s: any) => s.service_code === service.code);
          if (srvEntry) {
            srvEntry.assigned += 1;
            srvEntry.remaining = Math.max(0, srvEntry.initial_capacity - srvEntry.assigned);
          }
        }
      }
    }
  }

  return Array.from(employeeMap.values()).slice(0, 20); // Top 20 for readability
}

/**
 * Get employee name (simplified - would fetch from DB in production)
 */
function getEmployeeName(employee_id: string): string {
  // In production, this would query the employees table
  return employee_id;
}

/**
 * Analyze open slots and their reasons
 */
function analyzeOpenSlots(
  tasks: WorkbestandOpdracht[],
  planning: WorkbestandPlanning[],
  services: WorkbestandServicesMetadata[]
) {
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const openSlots: any[] = [];

  // For each task, find unfilled assignments
  for (const task of tasks) {
    const filledCount = planning.filter(
      (p) =>
        p.date.getTime() === task.date.getTime() &&
        p.dagdeel === task.dagdeel &&
        p.status === 1 &&
        p.service_id === task.service_id
    ).length;

    const remaining = task.aantal - filledCount;
    if (remaining > 0) {
      openSlots.push({
        date: task.date.toISOString().split('T')[0],
        dagdeel: task.dagdeel,
        team: task.team,
        service_code: task.service_code,
        service_name: serviceMap.get(task.service_id)?.naam || task.service_code,
        required: task.aantal,
        open: remaining,
        reason: `No ${task.service_code}-trained ${task.team} staff available`,
      });
    }
  }

  return openSlots.slice(0, 50); // Top 50 open slots
}

/**
 * Calculate daily summary
 */
function calculateDailySummary(planning: WorkbestandPlanning[]) {
  const dailyMap = new Map<string, any>();

  for (const slot of planning) {
    const dateKey = slot.date.toISOString().split('T')[0];

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        week_number: getWeekNumber(slot.date),
        total_slots: 0,
        filled_slots: 0,
        open_slots: 0,
        coverage_percent: 0,
      });
    }

    const entry = dailyMap.get(dateKey);
    entry.total_slots += 1;

    if (slot.status === 1 && slot.service_id) {
      entry.filled_slots += 1;
    } else if (slot.status === 0) {
      entry.open_slots += 1;
    }
  }

  // Calculate coverage percent
  for (const entry of dailyMap.values()) {
    entry.coverage_percent =
      entry.total_slots > 0
        ? Math.round((entry.filled_slots / entry.total_slots) * 100 * 10) / 10
        : 0;
  }

  return Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Store report in database for audit trail (optional)
 */
async function storeReportInDatabase(report: AflReport): Promise<void> {
  try {
    // Check if afl_execution_reports table exists
    // If it does, store the report for audit trail
    const { error } = await supabase.from('afl_execution_reports').insert([
      {
        roster_id: report.rosterId,
        afl_run_id: report.afl_run_id,
        report_data: report,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist, which is OK for MVP
      console.warn('[Report Engine] Could not store report in database:', error.message);
    }
  } catch (error) {
    // Silently fail - reporting is bonus, shouldn't break pipeline
    console.warn('[Report Engine] Report storage failed (non-critical):', error);
  }
}

/**
 * Export report to PDF (placeholder - would use jsPDF in production)
 */
export async function exportReportToPdf(
  report: AflReport,
  _options?: { filename?: string; include_charts?: boolean }
): Promise<Buffer> {
  // In production, use jsPDF + html2canvas
  // For now, return JSON stringified as text for immediate functionality
  const json = JSON.stringify(report, null, 2);
  return Buffer.from(json, 'utf-8');
}

/**
 * Export report to Excel (placeholder - would use xlsx in production)
 */
export async function exportReportToExcel(
  report: AflReport,
  _options?: { filename?: string }
): Promise<Buffer> {
  // In production, use xlsx library
  // For now, return CSV format
  const csv = convertReportToCsv(report);
  return Buffer.from(csv, 'utf-8');
}

/**
 * Convert report to CSV format (helper for placeholder Excel export)
 */
function convertReportToCsv(report: AflReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('AFL Execution Report');
  lines.push('');
  
  // Summary
  lines.push('SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total Required,${report.summary.total_required}`);
  lines.push(`Total Planned,${report.summary.total_planned}`);
  lines.push(`Total Open,${report.summary.total_open}`);
  lines.push(`Coverage %,${report.summary.coverage_percent}`);
  lines.push(`Rating,${report.summary.coverage_rating}`);
  lines.push('');
  
  // Services
  lines.push('SERVICES');
  lines.push('Service Code,Service Name,Required,Planned,Open,Completion %,Status');
  for (const service of report.by_service) {
    lines.push(`${service.service_code},${service.service_name},${service.required},${service.planned},${service.open},${service.completion_percent}%,${service.status}`);
  }
  
  return lines.join('\n');
}

/**
 * Send report via email (optional feature)
 */
export async function sendReportEmail(
  report: AflReport,
  email_address: string,
  format: 'json' | 'pdf' | 'excel' = 'pdf'
): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, would use nodemailer or similar
    // For now, just log
    console.log(`[Report Engine] Would send ${format} report to ${email_address}`);

    // Placeholder: Always succeeds in MVP
    return { success: true };
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    return { success: false, error: error_message };
  }
}
