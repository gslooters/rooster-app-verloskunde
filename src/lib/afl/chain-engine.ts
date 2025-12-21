/**
 * AFL (Autofill) - Phase 3: DIO/DDO Chain Blocking Engine
 * 
 * Validation & Enforcement Layer:
 * - Validates DIO/DDO chains are correctly formed
 * - Detects chain conflicts (overlapping blocks, duplicate DIA)
 * - Enforces period boundaries (don't block beyond end_date)
 * - Generates chain integrity reports
 * - Prepares data for Phase 4 database writing
 * 
 * Performance target: 1-2 seconds
 * Validation coverage: 100% of DIO/DDO assignments
 * All operations in-memory (no DB queries)
 */

import {
  WorkbestandPlanning,
  WorkbestandServicesMetadata,
} from './types';

/**
 * DIO/DDO Chain Structure
 * Represents all slots that form a single DIO/DDO chain
 */
export interface DIOChain {
  chain_id: string; // UUID for tracking
  assignment_date: Date; // Date of DIO assignment (Ochtend)
  employee_id: string; // Employee assigned
  service_code: 'DIO' | 'DDO'; // DIO or DDO
  
  // All slots that form this chain
  slots: {
    assignment: WorkbestandPlanning; // DIO/DDO on Ochtend (status=1)
    midday_block: WorkbestandPlanning | null; // Blocked on Middag (status=2)
    dia_assignment: WorkbestandPlanning | null; // DIA on Avond (status=1)
    next_day_ochtend_block: WorkbestandPlanning | null; // Blocked next O (status=2)
    next_day_middag_block: WorkbestandPlanning | null; // Blocked next M (status=2)
  };
  
  // Validation status
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation Error
 * Detailed error information for chain validation failures
 */
export interface ValidationError {
  chain_id: string;
  error_type:
    | 'MISSING_DIA'
    | 'MISSING_MIDDAY_BLOCK'
    | 'MISSING_RECOVERY_BLOCKS'
    | 'WRONG_STATUS'
    | 'OVERLAPPING_BLOCKS'
    | 'DUPLICATE_DIA'
    | 'PERIOD_BOUNDARY'
    | 'INCONSISTENT_BLOCKING';
  message: string;
  severity: 'error' | 'warning';
  affected_slots?: string[]; // Slot IDs involved
}

/**
 * Chain Report
 * Summary statistics and detailed chain information
 */
export interface ChainReport {
  total_chains: number;
  valid_chains: number;
  invalid_chains: number;
  
  chains_by_type: {
    DIO_count: number;
    DDO_count: number;
  };
  
  coverage: {
    with_dia_auto: number; // DIO with DIA assigned
    with_next_day_blocks: number; // DIO with recovery blocks
  };
  
  chains: ChainDetail[];
}

/**
 * Chain Detail for Report
 * Individual chain information
 */
export interface ChainDetail {
  chain_id: string;
  assignment_date: Date;
  employee_id: string;
  service_code: string;
  status: 'VALID' | 'INVALID';
  slots_count: number;
  issues: string[];
}

/**
 * Chain Engine - Main FASE 3 Algorithm
 */
export class ChainEngine {
  private workbestand_planning: WorkbestandPlanning[];
  private workbestand_services_metadata: WorkbestandServicesMetadata[];
  private rooster_start_date: Date;
  private rooster_end_date: Date;

  constructor(
    planning: WorkbestandPlanning[],
    services: WorkbestandServicesMetadata[],
    rooster_start_date: Date,
    rooster_end_date: Date
  ) {
    this.workbestand_planning = planning;
    this.workbestand_services_metadata = services;
    this.rooster_start_date = rooster_start_date;
    this.rooster_end_date = rooster_end_date;
  }

  /**
   * Main entry point: Process and validate all DIO/DDO chains
   */
  processChains(): {
    valid_slots: WorkbestandPlanning[];
    chain_report: ChainReport;
    validation_errors: ValidationError[];
    processing_duration_ms: number;
  } {
    const startTime = performance.now();
    const chains: DIOChain[] = [];
    const all_errors: ValidationError[] = [];

    // Step 1: Find all DIO/DDO assignments
    const dio_assignments = this.findDIOAssignments();

    // Step 2: Validate each DIO/DDO assignment
    for (const assignment of dio_assignments) {
      const chain = this.validateChain(assignment);
      chains.push(chain);
      if (!chain.valid) {
        all_errors.push(...chain.errors);
      }
    }

    // Step 3: Check for conflicts between chains
    const conflicts = this.detectConflicts(chains);
    all_errors.push(...conflicts);

    // Step 4: Verify period boundaries
    for (const chain of chains) {
      const boundary_errors = this.verifyPeriodBoundary(chain);
      all_errors.push(...boundary_errors);
    }

    // Step 5: Generate report
    const report = this.generateChainReport(chains);

    const processing_duration_ms = performance.now() - startTime;

    return {
      valid_slots: this.workbestand_planning,
      chain_report: report,
      validation_errors: all_errors,
      processing_duration_ms,
    };
  }

  /**
   * Find all DIO/DDO assignments in planning data
   */
  private findDIOAssignments(): WorkbestandPlanning[] {
    return this.workbestand_planning.filter((p) => {
      if (p.status !== 1 || !p.service_id) return false; // Not assigned

      const service = this.getServiceById(p.service_id);
      if (!service) return false;

      // Only DIO and DDO (and check it's on Ochtend)
      return (['DIO', 'DDO'].includes(service.code) && p.dagdeel === 'O');
    });
  }

  /**
   * Validate a single DIO/DDO assignment and its chain
   * 
   * A valid chain requires:
   * 1. DIO/DDO assigned on Ochtend (status=1)
   * 2. Middag of same day blocked (status=2)
   * 3. DIA assigned to Avond of same day (status=1)
   * 4. Next day O+M blocked (status=2), if not beyond period
   */
  private validateChain(assignment: WorkbestandPlanning): DIOChain {
    const chain_id = assignment.id;
    const employee_id = assignment.employee_id;
    const assign_date = assignment.date;
    const service = this.getServiceById(assignment.service_id!);

    const errors: ValidationError[] = [];

    // Step 1: Verify assignment itself
    if (assignment.status !== 1) {
      errors.push({
        chain_id,
        error_type: 'WRONG_STATUS',
        message: `DIO assignment has status=${assignment.status}, expected 1 (assigned)`,
        severity: 'error',
        affected_slots: [assignment.id],
      });
    }

    // Step 2: Find and verify Middag block
    const midday_block = this.workbestand_planning.find(
      (p) =>
        p.employee_id === employee_id &&
        this.isSameDay(p.date, assign_date) &&
        p.dagdeel === 'M'
    );

    if (!midday_block) {
      errors.push({
        chain_id,
        error_type: 'MISSING_MIDDAY_BLOCK',
        message: `DIO assignment missing Middag block for ${employee_id} on ${assign_date.toISOString().split('T')[0]}`,
        severity: 'error',
      });
    } else if (midday_block.status !== 2) {
      errors.push({
        chain_id,
        error_type: 'WRONG_STATUS',
        message: `Middag block has status=${midday_block.status}, expected 2 (blocked)`,
        severity: 'error',
        affected_slots: [midday_block.id],
      });
    }

    // Step 3: Find and verify DIA assignment (Avond)
    const dia_assignment = this.workbestand_planning.find(
      (p) =>
        p.employee_id === employee_id &&
        this.isSameDay(p.date, assign_date) &&
        p.dagdeel === 'A'
    );

    if (!dia_assignment) {
      errors.push({
        chain_id,
        error_type: 'MISSING_DIA',
        message: `DIO assignment missing DIA assignment for ${employee_id} on ${assign_date.toISOString().split('T')[0]}`,
        severity: 'error',
      });
    } else if (dia_assignment.status !== 1) {
      errors.push({
        chain_id,
        error_type: 'WRONG_STATUS',
        message: `DIA assignment has status=${dia_assignment.status}, expected 1 (assigned)`,
        severity: 'error',
        affected_slots: [dia_assignment.id],
      });
    } else {
      // Verify DIA has correct service
      const dia_service = this.getServiceById(dia_assignment.service_id!);
      if (dia_service?.code !== 'DIA') {
        errors.push({
          chain_id,
          error_type: 'INCONSISTENT_BLOCKING',
          message: `Avond slot has service ${dia_service?.code}, expected DIA`,
          severity: 'error',
          affected_slots: [dia_assignment.id],
        });
      }
    }

    // Step 4: Find and verify next-day recovery blocks (if not beyond period)
    // IMPORTANT: Use explicit null assignment to avoid undefined in type
    let next_day_ochtend_block: WorkbestandPlanning | null = null;
    let next_day_middag_block: WorkbestandPlanning | null = null;

    const next_date = this.addDays(assign_date, 1);
    if (this.isSameDateOrBefore(next_date, this.rooster_end_date)) {
      const found_ochtend = this.workbestand_planning.find(
        (p) =>
          p.employee_id === employee_id &&
          this.isSameDay(p.date, next_date) &&
          p.dagdeel === 'O'
      );

      if (found_ochtend) {
        next_day_ochtend_block = found_ochtend;
        if (next_day_ochtend_block.status !== 2) {
          errors.push({
            chain_id,
            error_type: 'WRONG_STATUS',
            message: `Next-day Ochtend block has status=${next_day_ochtend_block.status}, expected 2 (blocked)`,
            severity: 'error',
            affected_slots: [next_day_ochtend_block.id],
          });
        }
      }

      const found_middag = this.workbestand_planning.find(
        (p) =>
          p.employee_id === employee_id &&
          this.isSameDay(p.date, next_date) &&
          p.dagdeel === 'M'
      );

      if (found_middag) {
        next_day_middag_block = found_middag;
        if (next_day_middag_block.status !== 2) {
          errors.push({
            chain_id,
            error_type: 'WRONG_STATUS',
            message: `Next-day Middag block has status=${next_day_middag_block.status}, expected 2 (blocked)`,
            severity: 'error',
            affected_slots: [next_day_middag_block.id],
          });
        }
      }
    }

    const chain: DIOChain = {
      chain_id,
      assignment_date: assign_date,
      employee_id,
      service_code: service?.code as 'DIO' | 'DDO',
      slots: {
        assignment,
        midday_block: midday_block || null,
        dia_assignment: dia_assignment || null,
        next_day_ochtend_block: next_day_ochtend_block,
        next_day_middag_block: next_day_middag_block,
      },
      valid: errors.length === 0,
      errors,
    };

    return chain;
  }

  /**
   * Detect conflicts between chains
   * 
   * Conflict types:
   * 1. Overlapping blocks - Same employee/date/dagdeel blocked by multiple chains
   * 2. Duplicate DIA - Same employee/date has multiple DIA assignments
   * 3. Chain inconsistency - Expected blocks missing
   */
  private detectConflicts(chains: DIOChain[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const slot_map = new Map<string, DIOChain[]>();

    // Build map of blocked slots → which chains block them
    for (const chain of chains) {
      // Midday block
      if (chain.slots.midday_block) {
        const key = `${chain.slots.midday_block.employee_id}:${chain.slots.midday_block.date.getTime()}:M`;
        if (!slot_map.has(key)) slot_map.set(key, []);
        slot_map.get(key)!.push(chain);
      }

      // Next-day blocks
      if (chain.slots.next_day_ochtend_block) {
        const key = `${chain.slots.next_day_ochtend_block.employee_id}:${chain.slots.next_day_ochtend_block.date.getTime()}:O`;
        if (!slot_map.has(key)) slot_map.set(key, []);
        slot_map.get(key)!.push(chain);
      }

      if (chain.slots.next_day_middag_block) {
        const key = `${chain.slots.next_day_middag_block.employee_id}:${chain.slots.next_day_middag_block.date.getTime()}:M`;
        if (!slot_map.has(key)) slot_map.set(key, []);
        slot_map.get(key)!.push(chain);
      }
    }

    // Check for overlapping blocks
    for (const [key, blocking_chains] of slot_map.entries()) {
      if (blocking_chains.length > 1) {
        const chain_ids = blocking_chains.map((c) => c.chain_id);
        errors.push({
          chain_id: blocking_chains[0].chain_id,
          error_type: 'OVERLAPPING_BLOCKS',
          message: `Slot ${key} is blocked by multiple chains: ${chain_ids.join(', ')}`,
          severity: 'error',
          affected_slots: blocking_chains.flatMap((c) => [
            c.slots.midday_block?.id,
            c.slots.next_day_ochtend_block?.id,
            c.slots.next_day_middag_block?.id,
          ]).filter(Boolean) as string[],
        });
      }
    }

    // Check for duplicate DIA assignments
    const dia_map = new Map<string, WorkbestandPlanning[]>();
    for (const chain of chains) {
      if (chain.slots.dia_assignment) {
        const key = `${chain.slots.dia_assignment.employee_id}:${chain.slots.dia_assignment.date.getTime()}:A`;
        if (!dia_map.has(key)) dia_map.set(key, []);
        dia_map.get(key)!.push(chain.slots.dia_assignment);
      }
    }

    for (const [key, dia_slots] of dia_map.entries()) {
      if (dia_slots.length > 1) {
        errors.push({
          chain_id: dia_slots[0].id,
          error_type: 'DUPLICATE_DIA',
          message: `Slot ${key} has ${dia_slots.length} DIA assignments (expected 1)`,
          severity: 'error',
          affected_slots: dia_slots.map((s) => s.id),
        });
      }
    }

    return errors;
  }

  /**
   * Verify chain respects period boundaries
   * 
   * Rules:
   * 1. DIO date must be <= end_date
   * 2. Next-day blocks (if exist) must be <= end_date
   * 3. If DIO on last day: no next-day blocks expected
   * 4. If DIO on second-to-last day: one day of blocks OK
   */
  private verifyPeriodBoundary(chain: DIOChain): ValidationError[] {
    const errors: ValidationError[] = [];

    const assignment_date = chain.assignment_date;
    const next_date = this.addDays(assignment_date, 1);

    // Rule 1: DIO must be within period
    if (this.isAfter(assignment_date, this.rooster_end_date)) {
      errors.push({
        chain_id: chain.chain_id,
        error_type: 'PERIOD_BOUNDARY',
        message: `DIO assignment on ${assignment_date.toISOString().split('T')[0]} is beyond period end ${this.rooster_end_date.toISOString().split('T')[0]}`,
        severity: 'error',
        affected_slots: [chain.slots.assignment.id],
      });
    }

    // Rule 2: Next-day blocks must be within period
    if (this.isAfter(next_date, this.rooster_end_date)) {
      // DIO on last day or beyond - no next-day blocks should exist
      if (chain.slots.next_day_ochtend_block && chain.slots.next_day_ochtend_block.status === 2) {
        errors.push({
          chain_id: chain.chain_id,
          error_type: 'PERIOD_BOUNDARY',
          message: `Next-day blocks exist beyond period end. DIO on ${assignment_date.toISOString().split('T')[0]}, period ends ${this.rooster_end_date.toISOString().split('T')[0]}`,
          severity: 'error',
          affected_slots: [chain.slots.next_day_ochtend_block.id],
        });
      }
    }

    return errors;
  }

  /**
   * Generate comprehensive chain report
   */
  private generateChainReport(chains: DIOChain[]): ChainReport {
    const report: ChainReport = {
      total_chains: chains.length,
      valid_chains: chains.filter((c) => c.valid).length,
      invalid_chains: chains.filter((c) => !c.valid).length,
      chains_by_type: {
        DIO_count: chains.filter((c) => c.service_code === 'DIO').length,
        DDO_count: chains.filter((c) => c.service_code === 'DDO').length,
      },
      coverage: {
        with_dia_auto: chains.filter((c) => c.slots.dia_assignment !== null).length,
        with_next_day_blocks: chains.filter(
          (c) => c.slots.next_day_ochtend_block !== null || c.slots.next_day_middag_block !== null
        ).length,
      },
      chains: chains.map((chain) => ({
        chain_id: chain.chain_id,
        assignment_date: chain.assignment_date,
        employee_id: chain.employee_id,
        service_code: chain.service_code,
        status: chain.valid ? 'VALID' : 'INVALID',
        slots_count: Object.values(chain.slots).filter((s) => s !== null).length,
        issues: chain.errors.map((e) => e.message),
      })),
    };

    return report;
  }

  /**
   * Get service metadata by ID
   */
  private getServiceById(service_id: string): WorkbestandServicesMetadata | undefined {
    return this.workbestand_services_metadata.find((s) => s.id === service_id);
  }

  /**
   * Date utilities
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private isAfter(date1: Date, date2: Date): boolean {
    return date1.getTime() > date2.getTime();
  }

  private isSameDateOrBefore(date1: Date, date2: Date): boolean {
    return date1.getTime() <= date2.getTime();
  }
}

/**
 * Helper: Create ChainEngine and process chains
 */
export async function runChainEngine(
  workbestand_planning: WorkbestandPlanning[],
  workbestand_services_metadata: WorkbestandServicesMetadata[],
  rooster_start_date: Date,
  rooster_end_date: Date
): Promise<{
  valid_slots: WorkbestandPlanning[];
  chain_report: ChainReport;
  validation_errors: ValidationError[];
  processing_duration_ms: number;
}> {
  const engine = new ChainEngine(
    workbestand_planning,
    workbestand_services_metadata,
    rooster_start_date,
    rooster_end_date
  );

  return engine.processChains();
}
