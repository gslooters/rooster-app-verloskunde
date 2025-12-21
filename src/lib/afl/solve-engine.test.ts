/**
 * AFL Phase 2: Solve Engine - Unit Tests
 * 
 * Tests for:
 * - Finding available candidates
 * - Selecting best candidate (tiebreaker logic)
 * - Capacity tracking
 * - DIO/DDO chain preparation
 * - Edge cases (no candidates, etc)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SolveEngine } from './solve-engine';
import {
  WorkbestandOpdracht,
  WorkbestandPlanning,
  WorkbestandCapaciteit,
  WorkbestandServicesMetadata,
} from './types';

// Helper: Create mock task
function mockTask(overrides?: Partial<WorkbestandOpdracht>): WorkbestandOpdracht {
  return {
    id: 'task-1',
    roster_id: 'roster-1',
    date: new Date('2025-11-24'),
    dagdeel: 'O',
    team: 'TOT',
    service_id: 'service-ro',
    service_code: 'RO',
    is_system: false,
    aantal: 1,
    aantal_nog: 1,
    invulling: 0,
    ...overrides,
  };
}

// Helper: Create mock planning slot
function mockPlanning(overrides?: Partial<WorkbestandPlanning>): WorkbestandPlanning {
  return {
    id: 'slot-1',
    roster_id: 'roster-1',
    employee_id: 'emp-anne',
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
    is_modified: false,
    ...overrides,
  };
}

// Helper: Create mock capacity
function mockCapacity(overrides?: Partial<WorkbestandCapaciteit>): WorkbestandCapaciteit {
  return {
    roster_id: 'roster-1',
    employee_id: 'emp-anne',
    service_id: 'service-ro',
    service_code: 'RO',
    aantal: 5,
    actief: true,
    aantal_beschikbaar: 5,
    ...overrides,
  };
}

// Helper: Create mock service metadata
function mockService(overrides?: Partial<WorkbestandServicesMetadata>): WorkbestandServicesMetadata {
  return {
    id: 'service-ro',
    code: 'RO',
    naam: 'Reguliere Ochtend',
    beschrijving: null,
    is_system: false,
    blokkeert_volgdag: false,
    team_groen_regels: null,
    team_oranje_regels: null,
    team_totaal_regels: null,
    actief: true,
    ...overrides,
  };
}

describe('SolveEngine - Phase 2 Tests', () => {
  let engine: SolveEngine;
  let workbestand_opdracht: WorkbestandOpdracht[];
  let workbestand_planning: WorkbestandPlanning[];
  let workbestand_capaciteit: WorkbestandCapaciteit[];
  let workbestand_services_metadata: WorkbestandServicesMetadata[];

  beforeEach(() => {
    // Initialize default data
    workbestand_opdracht = [mockTask()];
    workbestand_planning = [mockPlanning()];
    workbestand_capaciteit = [mockCapacity()];
    workbestand_services_metadata = [mockService()];

    engine = new SolveEngine(
      workbestand_opdracht,
      workbestand_planning,
      workbestand_capaciteit,
      workbestand_services_metadata,
      new Date('2025-11-24'),
      new Date('2025-12-28')
    );
  });

  describe('findCandidates', () => {
    it('should find available candidate with capacity', () => {
      const result = engine.solve();

      // Should assign the service
      expect(result.assigned_count).toBe(1);
      expect(result.open_count).toBe(0);
    });

    it('should NOT find candidate when no available slot', () => {
      // Mark slot as blocked
      workbestand_planning[0].status = 2;

      const result = engine.solve();

      // Task remains open
      expect(result.open_count).toBe(1);
      expect(result.assigned_count).toBe(0);
    });

    it('should NOT find candidate when protected (is_protected=TRUE)', () => {
      // Mark slot as protected
      workbestand_planning[0].is_protected = true;

      const result = engine.solve();

      // Task remains open
      expect(result.open_count).toBe(1);
    });

    it('should NOT find candidate when no capacity', () => {
      // Zero capacity
      workbestand_capaciteit[0].aantal_beschikbaar = 0;

      const result = engine.solve();

      // Task remains open
      expect(result.open_count).toBe(1);
    });

    it('should NOT find candidate when inactive (actief=FALSE)', () => {
      // Mark as inactive
      workbestand_capaciteit[0].actief = false;

      const result = engine.solve();

      // Task remains open
      expect(result.open_count).toBe(1);
    });
  });

  describe('selectBestCandidate', () => {
    it('should select candidate with most capacity remaining', () => {
      // Add second candidate with less capacity
      workbestand_capaciteit.push(
        mockCapacity({
          employee_id: 'emp-bob',
          aantal_beschikbaar: 2, // Less than Anne's 5
        })
      );

      workbestand_planning.push(
        mockPlanning({
          id: 'slot-2',
          employee_id: 'emp-bob',
        })
      );

      const result = engine.solve();

      // Should assign to Anne (more capacity)
      expect(result.assigned_count).toBe(1);
      // Verify the slot assigned belongs to Anne
      const assigned = result.modified_slots.find((s) => s.status === 1 && s.service_id);
      expect(assigned?.employee_id).toBe('emp-anne');
    });

    it('should use alphabetical tiebreaker when capacity equal', () => {
      // Both with equal capacity
      workbestand_capaciteit[0].employee_id = 'emp-bob';
      workbestand_capaciteit[0].aantal_beschikbar = 5;

      workbestand_capaciteit.push(
        mockCapacity({
          employee_id: 'emp-alice',
          aantal_beschikbar: 5, // Same capacity
        })
      );

      // Add planning slots for both
      workbestand_planning[0].employee_id = 'emp-bob';
      workbestand_planning.push(
        mockPlanning({
          id: 'slot-2',
          employee_id: 'emp-alice',
        })
      );

      const result = engine.solve();

      // Should assign to Alice (alphabetically first)
      expect(result.assigned_count).toBe(1);
      const assigned = result.modified_slots.find((s) => s.status === 1);
      expect(assigned?.employee_id).toBe('emp-alice');
    });
  });

  describe('capacity tracking', () => {
    it('should decrement capacity after assignment', () => {
      const capacityBefore = workbestand_capaciteit[0].aantal_beschikbar || 5;

      engine.solve();

      const capacityAfter = workbestand_capaciteit[0].aantal_beschikbar || 0;
      expect(capacityAfter).toBe(capacityBefore - 1);
    });

    it('should never go negative', () => {
      // Set capacity to 1
      workbestand_capaciteit[0].aantal_beschikbar = 1;

      // Try to assign twice
      workbestand_opdracht[0].aantal = 2;
      workbestand_opdracht[0].aantal_nog = 2;

      // Add second slot for retry
      const slot2 = mockPlanning({
        id: 'slot-retry',
        employee_id: 'emp-anne',
      });
      workbestand_planning.push(slot2);

      engine.solve();

      const capacityFinal = workbestand_capaciteit[0].aantal_beschikbar || 0;
      expect(capacityFinal).toBeGreaterThanOrEqual(0);
      expect(capacityFinal).toBeLessThanOrEqual(1);
    });
  });

  describe('DIO/DDO chain preparation', () => {
    it('should block midday when DIO assigned to ochtend', () => {
      // Change task to DIO
      workbestand_opdracht[0].service_code = 'DIO';
      workbestand_opdracht[0].is_system = true;

      // Add midday slot
      const middag_slot = mockPlanning({
        id: 'slot-middag',
        employee_id: 'emp-anne',
        dagdeel: 'M',
        status: 0,
      });
      workbestand_planning.push(middag_slot);

      engine.solve();

      // Midday should be blocked (status=2)
      const middag_after = workbestand_planning.find((p) => p.id === 'slot-middag');
      expect(middag_after?.status).toBe(2);
    });

    it('should assign DIA to avond when DIO assigned to ochtend', () => {
      workbestand_opdracht[0].service_code = 'DIO';
      workbestand_opdracht[0].is_system = true;

      // Add avond slot
      const avond_slot = mockPlanning({
        id: 'slot-avond',
        employee_id: 'emp-anne',
        dagdeel: 'A',
        status: 0,
      });
      workbestand_planning.push(avond_slot);

      // Add DIA service
      const dia_service = mockService({
        id: 'service-dia',
        code: 'DIA',
      });
      workbestand_services_metadata.push(dia_service);

      // Add DIA capacity
      workbestand_capaciteit.push(
        mockCapacity({
          employee_id: 'emp-anne',
          service_id: 'service-dia',
          service_code: 'DIA',
          aantal_beschikbar: 5,
        })
      );

      engine.solve();

      // Avond should be assigned to DIA
      const avond_after = workbestand_planning.find((p) => p.id === 'slot-avond');
      expect(avond_after?.status).toBe(1);
      expect(avond_after?.service_id).toBe('service-dia');
    });

    it('should block next day ochtend+middag after DIO', () => {
      workbestand_opdracht[0].service_code = 'DIO';
      workbestand_opdracht[0].is_system = true;

      // Add next day slots
      const next_date = new Date('2025-11-25');
      const next_ochtend = mockPlanning({
        id: 'slot-next-o',
        employee_id: 'emp-anne',
        date: next_date,
        dagdeel: 'O',
        status: 0,
      });
      const next_middag = mockPlanning({
        id: 'slot-next-m',
        employee_id: 'emp-anne',
        date: next_date,
        dagdeel: 'M',
        status: 0,
      });

      workbestand_planning.push(next_ochtend);
      workbestand_planning.push(next_middag);

      engine.solve();

      // Both should be blocked
      const next_o_after = workbestand_planning.find((p) => p.id === 'slot-next-o');
      const next_m_after = workbestand_planning.find((p) => p.id === 'slot-next-m');

      expect(next_o_after?.status).toBe(2);
      expect(next_m_after?.status).toBe(2);
    });
  });

  describe('solve loop integration', () => {
    it('should handle multiple tasks', () => {
      // Add second task
      const task2 = mockTask({
        id: 'task-2',
        date: new Date('2025-11-25'),
        service_id: 'service-ro',
      });
      workbestand_opdracht.push(task2);

      // Add slot for second day
      const slot2 = mockPlanning({
        id: 'slot-2',
        employee_id: 'emp-anne',
        date: new Date('2025-11-25'),
      });
      workbestand_planning.push(slot2);

      const result = engine.solve();

      // Should assign both
      expect(result.assigned_count).toBe(2);
      expect(result.open_count).toBe(0);
    });

    it('should mark modified slots correctly', () => {
      const result = engine.solve();

      expect(result.modified_slots.length).toBeGreaterThan(0);
      expect(result.modified_slots[0].is_modified).toBe(true);
      expect(result.modified_slots[0].service_id).not.toBeNull();
    });

    it('should measure solve duration', () => {
      const result = engine.solve();

      expect(result.solve_duration_ms).toBeGreaterThan(0);
      expect(result.solve_duration_ms).toBeLessThan(5000); // Should be < 5 seconds
    });
  });

  describe('edge cases', () => {
    it('should handle empty opdracht list', () => {
      workbestand_opdracht = [];
      engine = new SolveEngine(
        workbestand_opdracht,
        workbestand_planning,
        workbestand_capaciteit,
        workbestand_services_metadata,
        new Date('2025-11-24'),
        new Date('2025-12-28')
      );

      const result = engine.solve();

      expect(result.assigned_count).toBe(0);
      expect(result.open_count).toBe(0);
    });

    it('should handle multiple assignments of same task', () => {
      // Task needs 3 assignments
      workbestand_opdracht[0].aantal = 3;
      workbestand_opdracht[0].aantal_nog = 3;

      // Add multiple slots for same employee
      const slot2 = mockPlanning({
        id: 'slot-2',
        employee_id: 'emp-anne',
        date: new Date('2025-11-25'),
      });
      const slot3 = mockPlanning({
        id: 'slot-3',
        employee_id: 'emp-anne',
        date: new Date('2025-11-26'),
      });
      workbestand_planning.push(slot2);
      workbestand_planning.push(slot3);

      // Increase capacity
      workbestand_capaciteit[0].aantal_beschikbar = 5;

      const result = engine.solve();

      // Should assign all 3 (if capacity allows)
      expect(result.open_count).toBeLessThanOrEqual(0);
    });
  });
});
