/**
 * Report Engine Tests (Phase 5)
 * 
 * Tests for:
 * - Report generation
 * - Coverage calculations
 * - Bottleneck detection
 * - Employee capacity tracking
 * - Open slots analysis
 */

import { describe, test, expect } from 'vitest';
import { generateAflReport } from './report-engine';
import {
  WorkbestandOpdracht,
  WorkbestandPlanning,
  WorkbestandCapaciteit,
  WorkbestandServicesMetadata,
} from './types';

/**
 * Test 1: Basic Report Generation
 */
test('PHASE 5.1: Report generation - basic metrics calculation', async () => {
  const rosterId = 'test-roster-123';
  const afl_run_id = 'test-run-456';

  // Mock data: 10 tasks required, 8 planned, 2 open
  const workbestand_opdracht: WorkbestandOpdracht[] = [
    {
      id: 'task-1',
      roster_id: rosterId,
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      team: 'GRO',
      service_id: 'dio-uuid',
      service_code: 'DIO',
      is_system: true,
      aantal: 2,
      aantal_nog: 2,
      invulling: 0,
    },
    {
      id: 'task-2',
      roster_id: rosterId,
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      team: 'ORA',
      service_id: 'ro-uuid',
      service_code: 'RO',
      is_system: false,
      aantal: 8,
      aantal_nog: 8,
      invulling: 0,
    },
  ];

  // Mock data: 8 assignments planned
  const workbestand_planning: WorkbestandPlanning[] = [
    {
      id: 'slot-1',
      roster_id: rosterId,
      employee_id: 'anne',
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      status: 1, // assigned
      service_id: 'dio-uuid',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'slot-2',
      roster_id: rosterId,
      employee_id: 'bob',
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      status: 1, // assigned
      service_id: 'dio-uuid',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  // Add 6 more RO assignments
  for (let i = 0; i < 6; i++) {
    workbestand_planning.push({
      id: `slot-ro-${i}`,
      roster_id: rosterId,
      employee_id: ['anne', 'bob', 'charlie', 'diana', 'emma', 'frank'][i % 6],
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      status: 1,
      service_id: 'ro-uuid',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const workbestand_capaciteit: WorkbestandCapaciteit[] = [
    {
      roster_id: rosterId,
      employee_id: 'anne',
      service_id: 'dio-uuid',
      service_code: 'DIO',
      aantal: 5,
      actief: true,
      aantal_beschikbaar: 4,
    },
  ];

  const workbestand_services_metadata: WorkbestandServicesMetadata[] = [
    {
      id: 'dio-uuid',
      code: 'DIO',
      naam: 'Dienst Ochtend Interne',
      beschrijving: null,
      is_system: true,
      blokkeert_volgdag: true,
      team_groen_regels: null,
      team_oranje_regels: null,
      team_totaal_regels: null,
      actief: true,
    },
    {
      id: 'ro-uuid',
      code: 'RO',
      naam: 'Reguliere Oproep',
      beschrijving: null,
      is_system: false,
      blokkeert_volgdag: false,
      team_groen_regels: null,
      team_oranje_regels: null,
      team_totaal_regels: null,
      actief: true,
    },
  ];

  const report = await generateAflReport({
    rosterId,
    afl_run_id,
    workbestand_planning,
    workbestand_opdracht,
    workbestand_capaciteit,
    workbestand_services_metadata,
    phase_timings: {
      load_ms: 450,
      solve_ms: 3800,
      dio_chains_ms: 1200,
      database_write_ms: 650,
    },
  });

  // Assertions
  expect(report.success).toBe(true);
  expect(report.afl_run_id).toBe(afl_run_id);
  expect(report.rosterId).toBe(rosterId);
  expect(report.summary.total_required).toBe(10);
  expect(report.summary.total_planned).toBe(8);
  expect(report.summary.total_open).toBe(2);
  expect(report.summary.coverage_percent).toBe(80); // 8/10 * 100
  expect(report.summary.coverage_rating).toBe('fair'); // 80% = fair
  expect(report.audit.afl_run_id).toBe(afl_run_id);
});

/**
 * Test 2: Coverage Rating System
 */
test('PHASE 5.2: Coverage rating system - rating based on percentage', async () => {
  // Test excellent (>=95%)
  let report = await generateAflReport({
    rosterId: 'test',
    afl_run_id: 'run',
    workbestand_opdracht: [
      {
        id: '1',
        roster_id: 'test',
        date: new Date(),
        dagdeel: 'O',
        team: 'GRO',
        service_id: 'svc',
        service_code: 'RO',
        is_system: false,
        aantal: 100,
        aantal_nog: 100,
        invulling: 0,
      },
    ],
    workbestand_planning: Array.from({ length: 95 }, (_, i) => ({
      id: `slot-${i}`,
      roster_id: 'test',
      employee_id: 'emp',
      date: new Date(),
      dagdeel: 'O',
      status: 1,
      service_id: 'svc',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    })),
    workbestand_capaciteit: [],
    workbestand_services_metadata: [],
    phase_timings: { load_ms: 1, solve_ms: 1, dio_chains_ms: 1, database_write_ms: 1 },
  });

  expect(report.summary.coverage_rating).toBe('excellent');
  expect(report.summary.coverage_color).toBe('#00AA00');
});

/**
 * Test 3: Bottleneck Detection
 */
test('PHASE 5.3: Bottleneck detection - identifies services >10% open', async () => {
  const workbestand_opdracht: WorkbestandOpdracht[] = [
    {
      id: 'task-ro',
      roster_id: 'test',
      date: new Date(),
      dagdeel: 'O',
      team: 'GRO',
      service_id: 'ro-uuid',
      service_code: 'RO',
      is_system: false,
      aantal: 80, // 80 required
      aantal_nog: 80,
      invulling: 0,
    },
  ];

  // Only 70 assigned (12.5% open - should be bottleneck)
  const workbestand_planning: WorkbestandPlanning[] = Array.from({ length: 70 }, (_, i) => ({
    id: `slot-${i}`,
    roster_id: 'test',
    employee_id: 'emp',
    date: new Date(),
    dagdeel: 'O',
    status: 1,
    service_id: 'ro-uuid',
    is_protected: false,
    source: 'autofill',
    blocked_by_date: null,
    blocked_by_dagdeel: null,
    blocked_by_service_id: null,
    constraint_reason: null,
    ort_confidence: null,
    ort_run_id: null,
    previous_service_id: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  const report = await generateAflReport({
    rosterId: 'test',
    afl_run_id: 'run',
    workbestand_planning,
    workbestand_opdracht,
    workbestand_capaciteit: [],
    workbestand_services_metadata: [
      {
        id: 'ro-uuid',
        code: 'RO',
        naam: 'Reguliere Oproep',
        beschrijving: null,
        is_system: false,
        blokkeert_volgdag: false,
        team_groen_regels: null,
        team_oranje_regels: null,
        team_totaal_regels: null,
        actief: true,
      },
    ],
    phase_timings: { load_ms: 1, solve_ms: 1, dio_chains_ms: 1, database_write_ms: 1 },
  });

  expect(report.bottleneck_services.length).toBeGreaterThan(0);
  expect(report.bottleneck_services[0].service_code).toBe('RO');
  expect(report.bottleneck_services[0].open).toBe(10);
  expect(report.bottleneck_services[0].open_percent).toBe(12.5);
});

/**
 * Test 4: Daily Summary
 */
test('PHASE 5.4: Daily summary - aggregates coverage per day', async () => {
  const workbestand_planning: WorkbestandPlanning[] = [
    {
      id: 'day1-slot1',
      roster_id: 'test',
      employee_id: 'emp1',
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      status: 1,
      service_id: 'svc',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'day1-slot2',
      roster_id: 'test',
      employee_id: 'emp2',
      date: new Date('2025-11-24'),
      dagdeel: 'O',
      status: 1,
      service_id: 'svc',
      is_protected: false,
      source: 'autofill',
      blocked_by_date: null,
      blocked_by_dagdeel: null,
      blocked_by_service_id: null,
      constraint_reason: null,
      ort_confidence: null,
      ort_run_id: null,
      previous_service_id: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const report = await generateAflReport({
    rosterId: 'test',
    afl_run_id: 'run',
    workbestand_planning,
    workbestand_opdracht: [
      {
        id: 'task',
        roster_id: 'test',
        date: new Date('2025-11-24'),
        dagdeel: 'O',
        team: 'GRO',
        service_id: 'svc',
        service_code: 'RO',
        is_system: false,
        aantal: 2,
        aantal_nog: 2,
        invulling: 0,
      },
    ],
    workbestand_capaciteit: [],
    workbestand_services_metadata: [],
    phase_timings: { load_ms: 1, solve_ms: 1, dio_chains_ms: 1, database_write_ms: 1 },
  });

  expect(report.daily_summary.length).toBeGreaterThan(0);
  const daySummary = report.daily_summary.find((d) => d.date === '2025-11-24');
  expect(daySummary).toBeDefined();
  expect(daySummary?.filled_slots).toBe(2);
});

/**
 * Test 5: Phase Breakdown Timing
 */
test('PHASE 5.5: Phase breakdown - includes all phase timings', async () => {
  const report = await generateAflReport({
    rosterId: 'test',
    afl_run_id: 'run',
    workbestand_planning: [],
    workbestand_opdracht: [],
    workbestand_capaciteit: [],
    workbestand_services_metadata: [],
    phase_timings: {
      load_ms: 450,
      solve_ms: 3800,
      dio_chains_ms: 1200,
      database_write_ms: 650,
    },
  });

  expect(report.phase_breakdown.load_ms).toBe(450);
  expect(report.phase_breakdown.solve_ms).toBe(3800);
  expect(report.phase_breakdown.dio_chains_ms).toBe(1200);
  expect(report.phase_breakdown.database_write_ms).toBe(650);
  expect(report.phase_breakdown.report_generation_ms).toBeGreaterThan(0);
});
