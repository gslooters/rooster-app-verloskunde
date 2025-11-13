/**
 * SERVICE LAYER: Period Employee Staffing
 * DRAAD27 - Diensten per Medewerker per Periode
 * 
 * Database tabel: period_employee_staffing
 * Opslag: Target shifts (Dst) per medewerker per rooster
 * 
 * Functionaliteit:
 * - initializePeriodEmployeeStaffing: Auto-fill bij rooster aanmaken
 * - getPeriodEmployeeStaffingByRosterId: Ophalen alle Dst waarden
 * - updateTargetShifts: Update één medewerker (debounced auto-save)
 */

import { supabase } from '@/lib/supabase';
import { getActiveEmployees } from './employees-storage';

/**
 * FASE 1 FUNCTIE 1: Initialiseer period employee staffing bij rooster aanmaken
 * 
 * Wordt aangeroepen vanuit Wizard na createRooster en initializeRosterDesign
 * Bulk INSERT van alle actieve medewerkers met default target_shifts
 * 
 * @param rosterId - UUID van nieuw aangemaakt rooster
 * @param employeeIds - Array van employee IDs (TEXT, niet UUID!)
 * @throws Error bij database fout
 */
export async function initializePeriodEmployeeStaffing(
  rosterId: string,
  employeeIds: string[]
): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[DRAAD27] FASE 1.1: Initialize Period Employee Staffing');
    console.log('='.repeat(80));
    console.log('[DRAAD27] RosterId:', rosterId);
    console.log('[DRAAD27] Aantal medewerkers:', employeeIds.length);
    console.log('[DRAAD27] Employee IDs:', employeeIds.join(', '));
    console.log('');
    
    // Validatie input
    if (!rosterId || typeof rosterId !== 'string') {
      throw new Error('Invalid rosterId: must be non-empty string');
    }
    
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      console.warn('[DRAAD27] ⚠️  Geen actieve medewerkers - skip initialisatie');
      return;
    }
    
    // Haal employee details op voor default target_shifts
    const employees = getActiveEmployees();
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    
    // Bereid bulk insert records voor
    const records = employeeIds
      .filter(empId => employeeMap.has(empId)) // Alleen bekende medewerkers
      .map(empId => {
        const employee = employeeMap.get(empId)!;
        const targetShifts = employee.aantalWerkdagen || 0;
        
        console.log(`[DRAAD27]   • ${employee.voornaam} ${employee.achternaam}: ${targetShifts} shifts (default)`);
        
        return {
          roster_id: rosterId,
          employee_id: empId,
          target_shifts: targetShifts
        };
      });
    
    if (records.length === 0) {
      console.warn('[DRAAD27] ⚠️  Geen valide records - skip database insert');
      return;
    }
    
    console.log('');
    console.log(`[DRAAD27] 🔄 Bulk INSERT ${records.length} records...`);
    
    // Bulk INSERT naar Supabase
    const { data, error } = await supabase
      .from('period_employee_staffing')
      .insert(records)
      .select();
    
    if (error) {
      console.error('\n' + '='.repeat(80));
      console.error('[DRAAD27] ❌ DATABASE ERROR');
      console.error('='.repeat(80));
      console.error('[DRAAD27] Error code:', error.code);
      console.error('[DRAAD27] Error message:', error.message);
      console.error('[DRAAD27] Error details:', error.details);
      console.error('='.repeat(80) + '\n');
      throw error;
    }
    
    console.log(`[DRAAD27] ✅ Succesvol ${data?.length || 0} records aangemaakt`);
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('[DRAAD27] ❌ EXCEPTION in initializePeriodEmployeeStaffing');
    console.error('='.repeat(80));
    console.error('[DRAAD27] Error:', error);
    console.error('[DRAAD27] Stack:', (error as Error).stack);
    console.error('='.repeat(80) + '\n');
    throw error;
  }
}

/**
 * FASE 1 FUNCTIE 2: Haal alle target shifts op voor een rooster
 * 
 * Gebruikt voor scherm laden - ophalen Dst kolom waarden
 * Retourneert Map voor O(1) lookup per medewerker
 * 
 * @param rosterId - UUID van rooster
 * @returns Map<employeeId, targetShifts>
 */
export async function getPeriodEmployeeStaffingByRosterId(
  rosterId: string
): Promise<Map<string, number>> {
  try {
    console.log('[DRAAD27] 🔍 Get period employee staffing:', rosterId);
    
    // Validatie input
    if (!rosterId || typeof rosterId !== 'string') {
      throw new Error('Invalid rosterId: must be non-empty string');
    }
    
    const { data, error } = await supabase
      .from('period_employee_staffing')
      .select('employee_id, target_shifts')
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('[DRAAD27] ❌ Database error:', error);
      throw error;
    }
    
    // Converteer naar Map voor snelle lookups
    const targetShiftsMap = new Map<string, number>();
    (data || []).forEach(row => {
      targetShiftsMap.set(row.employee_id, row.target_shifts);
    });
    
    console.log(`[DRAAD27] ✅ Loaded ${targetShiftsMap.size} target shifts`);
    
    return targetShiftsMap;
    
  } catch (error) {
    console.error('[DRAAD27] ❌ Exception in getPeriodEmployeeStaffingByRosterId:', error);
    throw error;
  }
}

/**
 * FASE 1 FUNCTIE 3: Update target shifts voor één medewerker
 * 
 * Gebruikt voor debounced auto-save vanuit scherm
 * Update SINGLE record (geen bulk)
 * 
 * @param rosterId - UUID van rooster
 * @param employeeId - TEXT ID van medewerker
 * @param targetShifts - Nieuw aantal shifts (0-35)
 * @throws Error bij validatie fout of database fout
 */
export async function updateTargetShifts(
  rosterId: string,
  employeeId: string,
  targetShifts: number
): Promise<void> {
  try {
    console.log('[DRAAD27] 🔄 Update target shifts:', {
      rosterId,
      employeeId,
      targetShifts
    });
    
    // Validatie input
    if (!rosterId || typeof rosterId !== 'string') {
      throw new Error('Invalid rosterId: must be non-empty string');
    }
    
    if (!employeeId || typeof employeeId !== 'string') {
      throw new Error('Invalid employeeId: must be non-empty string');
    }
    
    if (typeof targetShifts !== 'number' || targetShifts < 0 || targetShifts > 35) {
      throw new Error('Invalid targetShifts: must be number between 0 and 35');
    }
    
    // Update in Supabase
    const { error } = await supabase
      .from('period_employee_staffing')
      .update({ target_shifts: targetShifts })
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId);
    
    if (error) {
      console.error('[DRAAD27] ❌ Database error:', error);
      throw error;
    }
    
    console.log('[DRAAD27] ✅ Target shifts updated successfully');
    
  } catch (error) {
    console.error('[DRAAD27] ❌ Exception in updateTargetShifts:', error);
    throw error;
  }
}