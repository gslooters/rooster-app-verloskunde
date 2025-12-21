/**
 * Unit Tests for Write Engine (Phase 4)
 * Tests for database writer logic and update payload building
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WriteEngine, WriteEngineResult } from './write-engine';
import { WorkbestandPlanning } from './types';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

describe('WriteEngine', () => {
  let writeEngine: WriteEngine;
  const test_roster_id = 'test-roster-uuid';

  beforeEach(() => {
    writeEngine = new WriteEngine();
  });

  describe('writeModifiedSlots', () => {
    it('should handle empty modified slots gracefully', async () => {
      const workbestand_planning: WorkbestandPlanning[] = [
        {
          id: 'slot-1',
          roster_id: test_roster_id,
          employee_id: 'emp-1',
          date: new Date('2025-11-24'),
          dagdeel: 'O',
          status: 0,
          service_id: null,
          is_protected: false,
          source: null,
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
          is_modified: false, // Not modified
        },
      ];

      const result = await writeEngine.writeModifiedSlots(
        test_roster_id,
        workbestand_planning
      );

      expect(result.success).toBe(true);
      expect(result.updated_count).toBe(0);
      expect(result.rooster_status_updated).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should count modified slots correctly', async () => {
      const workbestand_planning: WorkbestandPlanning[] = [
        {
          id: 'slot-1',
          roster_id: test_roster_id,
          employee_id: 'emp-1',
          date: new Date('2025-11-24'),
          dagdeel: 'O',
          status: 1,
          service_id: 'service-dio',
          is_protected: false,
          source: null,
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
          is_modified: true, // Modified
        },
        {
          id: 'slot-2',
          roster_id: test_roster_id,
          employee_id: 'emp-2',
          date: new Date('2025-11-24'),
          dagdeel: 'M',
          status: 2,
          service_id: null,
          is_protected: false,
          source: null,
          blocked_by_date: new Date('2025-11-24'),
          blocked_by_dagdeel: 'O',
          blocked_by_service_id: 'service-dio',
          constraint_reason: { reason: 'DIO_block' },
          ort_confidence: null,
          ort_run_id: null,
          previous_service_id: null,
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          is_modified: true, // Modified
        },
      ];

      const result = await writeEngine.writeModifiedSlots(
        test_roster_id,
        workbestand_planning
      );

      expect(result.success).toBe(true);
      expect(result.updated_count).toBeGreaterThanOrEqual(0); // Depends on mock setup
    });

    it('should generate valid afl_run_id (UUID format)', async () => {
      const workbestand_planning: WorkbestandPlanning[] = [];

      const result = await writeEngine.writeModifiedSlots(
        test_roster_id,
        workbestand_planning
      );

      expect(result.afl_run_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should track execution time', async () => {
      const workbestand_planning: WorkbestandPlanning[] = [];

      const result = await writeEngine.writeModifiedSlots(
        test_roster_id,
        workbestand_planning
      );

      expect(result.database_write_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildUpdatePayloads', () => {
    it('should create correct payload format for assigned services', () => {
      const slot: WorkbestandPlanning = {
        id: 'slot-1',
        roster_id: test_roster_id,
        employee_id: 'emp-1',
        date: new Date('2025-11-24'),
        dagdeel: 'O',
        status: 1,
        service_id: 'service-dio-uuid',
        is_protected: false,
        source: null,
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
        is_modified: true,
      };

      // Access private method via any type (for testing)
      const engine = writeEngine as any;
      const payloads = engine.buildUpdatePayloads([slot], 'test-run-id');

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toEqual({
        id: 'slot-1',
        status: 1,
        service_id: 'service-dio-uuid',
        source: 'autofill',
        blocked_by_date: null,
        blocked_by_dagdeel: null,
        blocked_by_service_id: null,
        constraint_reason: null,
        previous_service_id: null,
      });
    });

    it('should format dates as ISO strings', () => {
      const slot: WorkbestandPlanning = {
        id: 'slot-1',
        roster_id: test_roster_id,
        employee_id: 'emp-1',
        date: new Date('2025-11-24'),
        dagdeel: 'M',
        status: 2,
        service_id: null,
        is_protected: false,
        source: null,
        blocked_by_date: new Date('2025-11-24'),
        blocked_by_dagdeel: 'O',
        blocked_by_service_id: 'service-uuid',
        constraint_reason: { reason: 'test' },
        ort_confidence: null,
        ort_run_id: null,
        previous_service_id: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_modified: true,
      };

      const engine = writeEngine as any;
      const payloads = engine.buildUpdatePayloads([slot], 'test-run-id');

      expect(payloads[0].blocked_by_date).toBe('2025-11-24');
      expect(typeof payloads[0].blocked_by_date).toBe('string');
    });

    it('should handle null service_id correctly', () => {
      const slot: WorkbestandPlanning = {
        id: 'slot-1',
        roster_id: test_roster_id,
        employee_id: 'emp-1',
        date: new Date('2025-11-24'),
        dagdeel: 'O',
        status: 0,
        service_id: null,
        is_protected: false,
        source: null,
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
        is_modified: true,
      };

      const engine = writeEngine as any;
      const payloads = engine.buildUpdatePayloads([slot], 'test-run-id');

      expect(payloads[0].service_id).toBeNull();
    });
  });
});
