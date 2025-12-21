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
 * - Export functions (PDF/Excel)
 */

import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
 * Export report to PDF using jsPDF
 */
export async function exportReportToPdf(
  report: AflReport,
  _options?: { filename?: string; include_charts?: boolean }
): Promise<Buffer> {
  // Use jsPDF for server-side PDF generation
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'A4',
  });

  // Set font and colors
  doc.setFont('Helvetica');

  // Title
  doc.setFontSize(18);
  doc.setTextColor(33, 128, 141); // Teal color
  doc.text('AFL Execution Report', 20, 20);

  // Meta information
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  let yPosition = 35;

  const metaInfo = [
    { label: 'Rooster ID:', value: report.rosterId },
    { label: 'AFL Run ID:', value: report.afl_run_id },
    { label: 'Generated:', value: new Date(report.generated_at).toLocaleString('nl-NL') },
    { label: 'Execution Time:', value: `${Math.round(report.execution_time_ms)}ms` },
  ];

  for (const meta of metaInfo) {
    doc.text(`${meta.label} ${meta.value}`, 20, yPosition);
    yPosition += 6;
  }

  // Summary Section
  yPosition += 5;
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.text('Summary', 20, yPosition);
  
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');

  const summaryData = [
    ['Metric', 'Value'],
    ['Total Required', String(report.summary.total_required)],
    ['Total Planned', String(report.summary.total_planned)],
    ['Total Open', String(report.summary.total_open)],
    ['Coverage %', `${report.summary.coverage_percent}%`],
    ['Rating', report.summary.coverage_rating],
  ];

  autoTable(doc, {
    head: [summaryData[0]],
    body: summaryData.slice(1),
    startY: yPosition,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [33, 128, 141],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    bodyStyles: {
      fillColor: [252, 252, 249],
      textColor: [31, 33, 33],
    },
  });

  // Services Section
  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.text('Services Breakdown', 20, yPosition);

  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');

  const servicesData = [
    ['Service', 'Required', 'Planned', 'Open', 'Completion %'],
    ...report.by_service.map((s) => [
      s.service_code,
      String(s.required),
      String(s.planned),
      String(s.open),
      `${s.completion_percent}%`,
    ]),
  ];

  autoTable(doc, {
    head: [servicesData[0]],
    body: servicesData.slice(1),
    startY: yPosition,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [33, 128, 141],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    bodyStyles: {
      fillColor: [252, 252, 249],
      textColor: [31, 33, 33],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  // Return as Buffer
  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Export report to Excel using XLSX
 */
export async function exportReportToExcel(
  report: AflReport,
  _options?: { filename?: string }
): Promise<Buffer> {
  // Use XLSX to create Excel workbook with multiple sheets
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    { Metric: 'Rooster ID', Value: report.rosterId },
    { Metric: 'AFL Run ID', Value: report.afl_run_id },
    { Metric: 'Generated', Value: new Date(report.generated_at).toLocaleString('nl-NL') },
    { Metric: 'Execution Time (ms)', Value: Math.round(report.execution_time_ms) },
    {},
    { Metric: 'Total Required', Value: report.summary.total_required },
    { Metric: 'Total Planned', Value: report.summary.total_planned },
    { Metric: 'Total Open', Value: report.summary.total_open },
    { Metric: 'Coverage %', Value: report.summary.coverage_percent },
    { Metric: 'Coverage Rating', Value: report.summary.coverage_rating },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Services Breakdown
  const servicesData = report.by_service.map((service) => ({
    'Service Code': service.service_code,
    'Service Name': service.service_name,
    'Required': service.required,
    'Planned': service.planned,
    'Open': service.open,
    'Completion %': service.completion_percent,
    'Status': service.status,
  }));

  const servicesSheet = XLSX.utils.json_to_sheet(servicesData);
  servicesSheet['!cols'] = [
    { wch: 15 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, servicesSheet, 'Services');

  // Sheet 3: Daily Summary
  const dailyData = report.daily_summary.map((day) => ({
    'Date': day.date,
    'Week Number': day.week_number,
    'Total Slots': day.total_slots,
    'Filled Slots': day.filled_slots,
    'Open Slots': day.open_slots,
    'Coverage %': day.coverage_percent,
  }));

  if (dailyData.length > 0) {
    const dailySheet = XLSX.utils.json_to_sheet(dailyData);
    dailySheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Summary');
  }

  // Sheet 4: Open Slots
  const openSlotsData = report.open_slots.map((slot) => ({
    'Date': slot.date,
    'Dagdeel': slot.dagdeel,
    'Team': slot.team,
    'Service': slot.service_code,
    'Required': slot.required,
    'Open': slot.open,
    'Reason': slot.reason,
  }));

  if (openSlotsData.length > 0) {
    const openSlotsSheet = XLSX.utils.json_to_sheet(openSlotsData);
    openSlotsSheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, openSlotsSheet, 'Open Slots');
  }

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return excelBuffer as Buffer;
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