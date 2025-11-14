// Fase 2: Employee Assignment Matching Fix - DRAAD27E
// Feature: Vind juiste dienst assignment per rooster cel, inclusief re_ prefix bugfix
import { ServiceTypeWithColor, getServiceTypeOrDefault } from '@/lib/services/service-types-loader';

/**
 * Vind assignment voor een cel (dag/medewerker) met flexibele ID matching
 * Probeert verschillende matching strategieën om koppelingen te maken
 * - Exacte employee_id en date
 * - Fallback: vervang re_ prefix (oude imports)
 * - Fallback: originele employee_id
 *
 * Logt alle matches voor debugging.
 */
export function findAssignmentForCell(assignments, emp, date) {
  // Strategie 1: Exact match
  let assignment = assignments?.find(
    (a) => a.employee_id === emp.id && a.date === date
  );

  if (assignment) {
    console.log(`✅ Exact match: ${emp.id} / ${date} →`, assignment.service_code);
    return assignment;
  }

  // Strategie 2: Fallback re_ prefix verwijderen
  if (emp.id.startsWith('re_')) {
    const altId = emp.id.replace(/^re_/, '');
    assignment = assignments?.find(
      (a) => a.employee_id === altId && a.date === date
    );
    if (assignment) {
      console.log(`⚠️ Prefix fallback match: ${altId} / ${date} →`, assignment.service_code);
      return assignment;
    }
  }

  // Strategie 3: Fallback origineleEmployeeId property
  if (emp.originalEmployeeId) {
    assignment = assignments?.find(
      (a) => a.employee_id === emp.originalEmployeeId && a.date === date
    );
    if (assignment) {
      console.log(`🟡 OriginalEmployeeId match: ${emp.originalEmployeeId} / ${date} →`, assignment.service_code);
      return assignment;
    }
  }

  console.log(`❌ Geen match gevonden: ${emp.id} / ${date}`);
  return null;
}

// Export voor gebruik in rooster grid rendering
export default findAssignmentForCell;
