/**
 * AFL (Autofill) - Phase 3: Chain Engine Unit Tests
 * 
 * Test coverage:
 * - Chain validation
 * - Conflict detection
 * - Period boundary enforcement
 * - Edge cases
 * - Report generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChainEngine,
  DIOChain,
  ValidationError,
  ChainReport,
} from './chain-engine';
import {
  WorkbestandPlanning,
  WorkbestandServicesMetadata,
} from './types';

describe('ChainEngine - Phase 3 DIO/DDO Chain Validation', () => {
  let engine: ChainEngine;
  let planning_data: WorkbestandPlanning[];
  let services_metadata: WorkbestandServicesMetadata[];
  const start_date = new Date('2025-11-24'); // Monday
  const end_date = new Date('2025-12-28'); // Sunday, 35 days

  beforeEach(() => {
    // Setup service metadata
    services_metadata = [
      {
        id: 'dio-service-id',
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
        id: 'dia-service-id',
        code: 'DIA',
        naam: 'Dienst Interne Avond',
        beschrijving: null,
        is_system: true,
        blokkeert_volgdag: false,
        team_groen_regels: null,
        team_oranje_regels: null,
        team_totaal_regels: null,
        actief: true,
      },
      {
        id: 'ddo-service-id',
        code: 'DDO',
        naam: 'Dienst Duo Ochtend',
        beschrijving: null,
        is_system: true,
        blokkeert_volgdag: true,
        team_groen_regels: null,
        team_oranje_regels: null,
        team_totaal_regels: null,
        actief: true,
      },
      {
        id: 'dda-service-id',
        code: 'DDA',
        naam: 'Dienst Duo Avond',
        beschrijving: null,
        is_system: true,
        blokkeert_volgdag: false,
        team_groen_regels: null,
        team_oranje_regels: null,
        team_totaal_regels: null,
        actief: true,
      },
    ];

    // Initialize empty planning data
    planning_data = [];

    // Create engine
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);
  });

  /**
   * Test 1: Valid DIO chain with all required slots
   */
  it('should validate a complete and correct DIO chain', () => {
    const assign_date = new Date('2025-11-24'); // Monday
    const next_date = new Date('2025-11-25'); // Tuesday

    // DIO on Monday Ochtend
    const dio_slot = createSlot('slot-1', 'Anne', assign_date, 'O', 1, 'dio-service-id');
    // Block Monday Middag
    const midday_block = createSlot('slot-2', 'Anne', assign_date, 'M', 2, null, {
      blocked_by_date: assign_date,
      blocked_by_dagdeel: 'O',
      blocked_by_service_id: 'dio-service-id',
    });
    // DIA on Monday Avond
    const dia_slot = createSlot('slot-3', 'Anne', assign_date, 'A', 1, 'dia-service-id');
    // Block Tuesday Ochtend
    const next_o_block = createSlot('slot-4', 'Anne', next_date, 'O', 2, null, {
      blocked_by_date: assign_date,
      blocked_by_dagdeel: 'O',
      blocked_by_service_id: 'dio-service-id',
    });
    // Block Tuesday Middag
    const next_m_block = createSlot('slot-5', 'Anne', next_date, 'M', 2, null, {
      blocked_by_date: assign_date,
      blocked_by_dagdeel: 'O',
      blocked_by_service_id: 'dio-service-id',
    });

    planning_data = [dio_slot, midday_block, dia_slot, next_o_block, next_m_block];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.chain_report.total_chains).toBe(1);
    expect(result.chain_report.valid_chains).toBe(1);
    expect(result.chain_report.invalid_chains).toBe(0);
    expect(result.validation_errors).toHaveLength(0);
    expect(result.chain_report.chains[0].status).toBe('VALID');
  });

  /**
   * Test 2: Invalid DIO chain - missing DIA
   */
  it('should detect missing DIA assignment', () => {
    const assign_date = new Date('2025-11-24');

    // DIO on Monday Ochtend
    const dio_slot = createSlot('slot-1', 'Bob', assign_date, 'O', 1, 'dio-service-id');
    // Block Monday Middag
    const midday_block = createSlot('slot-2', 'Bob', assign_date, 'M', 2, null);
    // ❌ NO DIA assignment

    planning_data = [dio_slot, midday_block];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.chain_report.invalid_chains).toBe(1);
    expect(result.validation_errors.length).toBeGreaterThan(0);
    expect(result.validation_errors[0].error_type).toBe('MISSING_DIA');
  });

  /**
   * Test 3: Invalid DIO chain - missing midday block
   */
  it('should detect missing midday block', () => {
    const assign_date = new Date('2025-11-24');

    // DIO on Monday Ochtend
    const dio_slot = createSlot('slot-1', 'Charlie', assign_date, 'O', 1, 'dio-service-id');
    // ❌ NO Middag block
    // DIA on Monday Avond
    const dia_slot = createSlot('slot-3', 'Charlie', assign_date, 'A', 1, 'dia-service-id');

    planning_data = [dio_slot, dia_slot];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.chain_report.invalid_chains).toBe(1);
    expect(result.validation_errors.length).toBeGreaterThan(0);
    expect(result.validation_errors[0].error_type).toBe('MISSING_MIDDAY_BLOCK');
  });

  /**
   * Test 4: Conflict detection - overlapping blocks
   */
  it('should detect overlapping blocks from multiple chains', () => {
    const date1 = new Date('2025-11-24');
    const date2 = new Date('2025-11-25');

    // Chain 1: Anne's DIO on Monday
    const dio1 = createSlot('slot-1', 'Anne', date1, 'O', 1, 'dio-service-id');
    const block1_m = createSlot('slot-2', 'Anne', date1, 'M', 2, null);
    const dia1 = createSlot('slot-3', 'Anne', date1, 'A', 1, 'dia-service-id');
    const block1_next_o = createSlot('slot-4', 'Anne', date2, 'O', 2, null, {
      blocked_by_date: date1,
    });
    const block1_next_m = createSlot('slot-5', 'Anne', date2, 'M', 2, null, {
      blocked_by_date: date1,
    });

    // Chain 2: Anne's DIO on Tuesday (CONFLICT: Tue O already blocked)
    const dio2 = createSlot('slot-6', 'Anne', date2, 'O', 1, 'dio-service-id'); // WRONG - should be blocked
    const block2_m = createSlot('slot-7', 'Anne', date2, 'M', 2, null);
    const dia2 = createSlot('slot-8', 'Anne', date2, 'A', 1, 'dia-service-id');

    planning_data = [
      dio1,
      block1_m,
      dia1,
      block1_next_o,
      block1_next_m,
      dio2,
      block2_m,
      dia2,
    ];

    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);
    const result = engine.processChains();

    // Should detect conflict in overlapping Tuesday Ochtend block
    expect(result.validation_errors.length).toBeGreaterThan(0);
  });

  /**
   * Test 5: Period boundary - DIO on last day
   */
  it('should allow DIO on last day of period with no next-day blocks', () => {
    const last_date = new Date('2025-12-28'); // Last day (Sunday)
    const beyond_date = new Date('2025-12-29'); // Beyond period

    // DIO on last day
    const dio_slot = createSlot('slot-1', 'David', last_date, 'O', 1, 'dio-service-id');
    const midday_block = createSlot('slot-2', 'David', last_date, 'M', 2, null);
    const dia_slot = createSlot('slot-3', 'David', last_date, 'A', 1, 'dia-service-id');
    // ✅ No next-day blocks (period ends)

    planning_data = [dio_slot, midday_block, dia_slot];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    // Should be valid (no next-day blocks expected on last day)
    expect(result.chain_report.chains[0].status).toBe('VALID');
  });

  /**
   * Test 6: Period boundary - DIO beyond period
   */
  it('should reject DIO assignment beyond period end', () => {
    const beyond_date = new Date('2025-12-29'); // Beyond period

    // DIO on day after period ends
    const dio_slot = createSlot('slot-1', 'Eve', beyond_date, 'O', 1, 'dio-service-id');
    const midday_block = createSlot('slot-2', 'Eve', beyond_date, 'M', 2, null);
    const dia_slot = createSlot('slot-3', 'Eve', beyond_date, 'A', 1, 'dia-service-id');

    planning_data = [dio_slot, midday_block, dia_slot];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.validation_errors.length).toBeGreaterThan(0);
    expect(result.validation_errors[0].error_type).toBe('PERIOD_BOUNDARY');
  });

  /**
   * Test 7: Multiple valid DIO chains (different employees)
   */
  it('should validate multiple independent DIO chains', () => {
    const date1 = new Date('2025-11-24');
    const date2 = new Date('2025-11-25');

    // Anne's DIO on Monday
    const anne_dio = createSlot('slot-1', 'Anne', date1, 'O', 1, 'dio-service-id');
    const anne_block_m = createSlot('slot-2', 'Anne', date1, 'M', 2, null);
    const anne_dia = createSlot('slot-3', 'Anne', date1, 'A', 1, 'dia-service-id');
    const anne_block_o = createSlot('slot-4', 'Anne', date2, 'O', 2, null);
    const anne_block_m2 = createSlot('slot-5', 'Anne', date2, 'M', 2, null);

    // Bob's DIO on Tuesday
    const bob_dio = createSlot('slot-6', 'Bob', date2, 'O', 1, 'dio-service-id');
    const bob_block_m = createSlot('slot-7', 'Bob', date2, 'M', 2, null);
    const bob_dia = createSlot('slot-8', 'Bob', date2, 'A', 1, 'dia-service-id');
    const date3 = new Date('2025-11-26');
    const bob_block_o = createSlot('slot-9', 'Bob', date3, 'O', 2, null);
    const bob_block_m2 = createSlot('slot-10', 'Bob', date3, 'M', 2, null);

    planning_data = [
      anne_dio,
      anne_block_m,
      anne_dia,
      anne_block_o,
      anne_block_m2,
      bob_dio,
      bob_block_m,
      bob_dia,
      bob_block_o,
      bob_block_m2,
    ];

    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);
    const result = engine.processChains();

    expect(result.chain_report.total_chains).toBe(2);
    expect(result.chain_report.valid_chains).toBe(2);
    expect(result.chain_report.invalid_chains).toBe(0);
    expect(result.validation_errors).toHaveLength(0);
  });

  /**
   * Test 8: Chain report statistics
   */
  it('should generate accurate chain report', () => {
    const date = new Date('2025-11-24');
    const next_date = new Date('2025-11-25');

    // Valid DIO chain
    const dio = createSlot('slot-1', 'Anne', date, 'O', 1, 'dio-service-id');
    const block_m = createSlot('slot-2', 'Anne', date, 'M', 2, null);
    const dia = createSlot('slot-3', 'Anne', date, 'A', 1, 'dia-service-id');
    const block_o = createSlot('slot-4', 'Anne', next_date, 'O', 2, null);
    const block_m2 = createSlot('slot-5', 'Anne', next_date, 'M', 2, null);

    planning_data = [dio, block_m, dia, block_o, block_m2];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();
    const report = result.chain_report;

    expect(report.total_chains).toBe(1);
    expect(report.valid_chains).toBe(1);
    expect(report.invalid_chains).toBe(0);
    expect(report.chains_by_type.DIO_count).toBe(1);
    expect(report.chains_by_type.DDO_count).toBe(0);
    expect(report.coverage.with_dia_auto).toBe(1);
    expect(report.coverage.with_next_day_blocks).toBe(1);
  });

  /**
   * Test 9: Empty planning data (no DIO assignments)
   */
  it('should handle empty planning data gracefully', () => {
    planning_data = [];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.chain_report.total_chains).toBe(0);
    expect(result.validation_errors).toHaveLength(0);
    expect(result.processing_duration_ms).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test 10: Wrong status on blocked slots
   */
  it('should detect wrong status on blocked slots', () => {
    const date = new Date('2025-11-24');

    // DIO on Monday Ochtend
    const dio_slot = createSlot('slot-1', 'Frank', date, 'O', 1, 'dio-service-id');
    // ❌ Midday block with wrong status (1 instead of 2)
    const midday_block = createSlot('slot-2', 'Frank', date, 'M', 1, 'dio-service-id'); // WRONG
    const dia_slot = createSlot('slot-3', 'Frank', date, 'A', 1, 'dia-service-id');

    planning_data = [dio_slot, midday_block, dia_slot];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.validation_errors.length).toBeGreaterThan(0);
    expect(result.validation_errors[0].error_type).toBe('WRONG_STATUS');
  });

  /**
   * Test 11: DDO chain (same logic as DIO)
   */
  it('should validate DDO chains with same logic as DIO', () => {
    const date = new Date('2025-11-24');
    const next_date = new Date('2025-11-25');

    // DDO on Monday Ochtend
    const ddo_slot = createSlot('slot-1', 'Grace', date, 'O', 1, 'ddo-service-id');
    // Block Monday Middag
    const midday_block = createSlot('slot-2', 'Grace', date, 'M', 2, null);
    // DDA on Monday Avond
    const dda_slot = createSlot('slot-3', 'Grace', date, 'A', 1, 'dda-service-id');
    // Block Tuesday Ochtend
    const next_o_block = createSlot('slot-4', 'Grace', next_date, 'O', 2, null);
    // Block Tuesday Middag
    const next_m_block = createSlot('slot-5', 'Grace', next_date, 'M', 2, null);

    planning_data = [ddo_slot, midday_block, dda_slot, next_o_block, next_m_block];
    engine = new ChainEngine(planning_data, services_metadata, start_date, end_date);

    const result = engine.processChains();

    expect(result.chain_report.chains_by_type.DDO_count).toBe(1);
    expect(result.chain_report.valid_chains).toBe(1);
  });
});

/**
 * Helper function: Create a WorkbestandPlanning slot
 */
function createSlot(
  id: string,
  employee_id: string,
  date: Date,
  dagdeel: 'O' | 'M' | 'A',
  status: 0 | 1 | 2 | 3,
  service_id: string | null,
  extras?: Partial<WorkbestandPlanning>
): WorkbestandPlanning {
  return {
    id,
    roster_id: 'test-roster',
    employee_id,
    date,
    dagdeel,
    status,
    service_id,
    is_protected: false,
    source: 'autofill',
    blocked_by_date: extras?.blocked_by_date || null,
    blocked_by_dagdeel: extras?.blocked_by_dagdeel || null,
    blocked_by_service_id: extras?.blocked_by_service_id || null,
    constraint_reason: extras?.constraint_reason || null,
    ort_confidence: null,
    ort_run_id: null,
    previous_service_id: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}
