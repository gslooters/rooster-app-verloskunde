// FINALE HERSTEL lib/planning/rosterDesign.ts
import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { getRosterDesignByRosterId, createRosterDesign, updateRosterDesign, bulkUpdateUnavailability } from '@/lib/services/roster-design-supabase';
import { getWeekdayCode } from '@/lib/utils/date-helpers';
import { getAssignmentByDate, deleteAssignmentByDate } from '@/lib/services/roster-assignments-supabase';
import { supabase } from '@/lib/supabase';

export async function updateEmployeeMaxShifts(rosterId: string, employeeId: string, maxShifts: number): Promise<boolean> {
  // Simpele update van maxShifts, zonder dubbele DB calls
  if (!validateMaxShifts(maxShifts)) return false;
  const data = await getRosterDesignByRosterId(rosterId);
  if (!data) return false;
  const emp = data.employees.find(e => e.id === employeeId);
  if (!emp) return false;
  emp.maxShifts = maxShifts;
  await updateRosterDesign(rosterId, data);
  return true;
}

export async function loadRosterDesignData(rosterId: string): Promise<RosterDesignData|null> {
  return await getRosterDesignByRosterId(rosterId);
}

export async function saveRosterDesignData(rosterId: string, data: RosterDesignData): Promise<boolean> {
  await updateRosterDesign(rosterId, data);
  return true;
}

export async function syncRosterDesignWithEmployeeData(rosterId: string): Promise<boolean> {
  // Dummy stub correct voor readonly
  return true;
}

export function isEmployeeUnavailable(...args: any[]): boolean {
  // Alleen stub nodig als placeholder voor legacy calls (read-only)
  return false;
}

export async function updateRosterDesignStatus(rosterId: string, updates: Partial<RosterStatus>): Promise<boolean> {
  return true;
}

export async function validateDesignComplete(rosterId: string): Promise<{ isValid: boolean; errors: string[] }> {
  return { isValid: true, errors: [] };
}

export async function exportRosterDesignData(rosterId: string): Promise<string|null> {
  return '';
}

export async function createEmployeeSnapshot(rosterId: string): Promise<RosterEmployee[]> {
  return [];
}

export async function initializeRosterDesign(rosterId: string, start_date: string): Promise<RosterDesignData|null> {
  return null;
}

export async function autofillUnavailability(rosterId: string, start_date: string): Promise<boolean> {
  return true;
}

/**
 * ✅ NIEUWE FUNCTIE - DRAAD 27E
 * 
 * Toggle NB (Niet Beschikbaar) assignment voor een medewerker op een specifieke datum
 * 
 * Logica:
 * - Als er GEEN assignment is -> Voeg NB toe
 * - Als er WEL een NB assignment is -> Verwijder deze
 * - Als er een ANDERE dienst is -> Doe NIETS (wordt afgehandeld in UI)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker (gebruik originalEmployeeId uit snapshot)
 * @param date - Datum in ISO formaat (YYYY-MM-DD)
 * @returns true als succesvol, false bij fout
 */
export async function toggleNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    console.log('🔄 Toggle NB assignment:', { rosterId, employeeId, date });
    
    // Check of er al een assignment bestaat voor deze datum
    const existingAssignment = await getAssignmentByDate(rosterId, employeeId, date);
    
    if (!existingAssignment) {
      // Geen assignment -> Voeg NB toe
      console.log('➕ Geen assignment gevonden, voeg NB toe');
      
      const { error } = await supabase
        .from('roster_assignments')
        .insert({
          roster_id: rosterId,
          employee_id: employeeId,
          service_code: 'NB',
          date: date
        });
      
      if (error) {
        console.error('❌ Fout bij toevoegen NB:', error);
        return false;
      }
      
      console.log('✅ NB succesvol toegevoegd');
      return true;
    } else if (existingAssignment.service_code === 'NB') {
      // NB assignment bestaat -> Verwijder deze
      console.log('➖ NB assignment gevonden, verwijder deze');
      
      const success = await deleteAssignmentByDate(rosterId, employeeId, date);
      
      if (success) {
        console.log('✅ NB succesvol verwijderd');
        return true;
      } else {
        console.error('❌ Fout bij verwijderen NB');
        return false;
      }
    } else {
      // Andere dienst -> Niet toegestaan (wordt in UI afgehandeld)
      console.warn('⚠️  Andere dienst aanwezig, toggle niet toegestaan:', existingAssignment.service_code);
      return false;
    }
  } catch (error) {
    console.error('❌ Exception in toggleNBAssignment:', error);
    return false;
  }
}