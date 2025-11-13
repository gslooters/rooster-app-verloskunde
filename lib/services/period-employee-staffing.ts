// lib/services/period-employee-staffing.ts
// Service layer voor period_employee_staffing tabel
// Beheert target shifts (Dst kolom) per medewerker per rooster

import { supabase } from '../supabase';

/**
 * Database tabel interface
 */
interface PeriodEmployeeStaffingRow {
  id: string;
  roster_id: string;
  employee_id: string;
  target_shifts: number;
  created_at: string;
  updated_at: string;
}

/**
 * Insert input type (zonder auto-generated velden)
 */
interface PeriodEmployeeStaffingInsert {
  roster_id: string;
  employee_id: string;
  target_shifts: number;
}

/**
 * FUNCTIE 1: Initialiseer period employee staffing voor nieuw rooster
 * 
 * Wordt aangeroepen vanuit Wizard.tsx na roster creatie.
 * Maakt bulk INSERT voor alle actieve medewerkers.
 * Gebruikt employees.aantalWerkdagen als default waarde voor target_shifts.
 * 
 * @param rosterId - UUID van het rooster (uit database)
 * @param employeeIds - Array van employee IDs (TEXT, niet UUID!)
 * @param defaultShiftsMap - Optional map van employeeId -> aantalWerkdagen
 * @throws Error bij database fouten of validatie problemen
 */
export async function initializePeriodEmployeeStaffing(
  rosterId: string,
  employeeIds: string[],
  defaultShiftsMap?: Map<string, number>
): Promise<void> {
  // Validatie
  if (!rosterId || typeof rosterId !== 'string') {
    throw new Error('Invalid roster ID');
  }
  
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    console.warn('[PeriodEmployeeStaffing] No employees provided for initialization');
    return;
  }

  // Valideer employee IDs (zijn TEXT, geen UUID)
  const invalidEmployeeIds = employeeIds.filter(id => !id || typeof id !== 'string');
  if (invalidEmployeeIds.length > 0) {
    throw new Error(`Invalid employee IDs: ${invalidEmployeeIds.join(', ')}`);
  }

  try {
    // Bulk insert data voorbereiden
    const insertData: PeriodEmployeeStaffingInsert[] = employeeIds.map(employeeId => ({
      roster_id: rosterId,
      employee_id: employeeId,
      target_shifts: defaultShiftsMap?.get(employeeId) || 0
    }));

    // Bulk INSERT via Supabase
    const { error } = await supabase
      .from('period_employee_staffing')
      .insert(insertData);

    if (error) {
      console.error('[PeriodEmployeeStaffing] Insert error:', error);
      throw new Error(`Database insert failed: ${error.message}`);
    }

    console.log(
      `[PeriodEmployeeStaffing] Initialized ${employeeIds.length} employees for roster ${rosterId}`
    );
  } catch (error) {
    console.error('[PeriodEmployeeStaffing] Initialization failed:', error);
    throw error;
  }
}

/**
 * FUNCTIE 2: Ophalen target shifts voor alle medewerkers in een rooster
 * 
 * Gebruikt door client.tsx bij laden van scherm.
 * Geeft Map terug voor snelle lookups.
 * 
 * @param rosterId - UUID van het rooster
 * @returns Map<employeeId, targetShifts> - Lege map als geen data
 */
export async function getPeriodEmployeeStaffingByRosterId(
  rosterId: string
): Promise<Map<string, number>> {
  // Validatie
  if (!rosterId || typeof rosterId !== 'string') {
    throw new Error('Invalid roster ID');
  }

  try {
    const { data, error } = await supabase
      .from('period_employee_staffing')
      .select('employee_id, target_shifts')
      .eq('roster_id', rosterId);

    if (error) {
      console.error('[PeriodEmployeeStaffing] Query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Converteer naar Map voor snelle lookups
    const result = new Map<string, number>();
    
    if (data) {
      data.forEach(row => {
        result.set(row.employee_id, row.target_shifts);
      });
    }

    console.log(
      `[PeriodEmployeeStaffing] Loaded ${result.size} target shifts for roster ${rosterId}`
    );

    return result;
  } catch (error) {
    console.error('[PeriodEmployeeStaffing] Load failed:', error);
    throw error;
  }
}

/**
 * FUNCTIE 3: Update target shifts voor één medewerker (debounced auto-save)
 * 
 * Gebruikt door client.tsx voor auto-save functionaliteit.
 * Valideert 0 <= value <= 35.
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - Employee ID (TEXT, niet UUID!)
 * @param targetShifts - Nieuw aantal shifts (0-35)
 * @throws Error bij validatie fouten of database problemen
 */
export async function updateTargetShifts(
  rosterId: string,
  employeeId: string,
  targetShifts: number
): Promise<void> {
  // Validatie roster ID
  if (!rosterId || typeof rosterId !== 'string') {
    throw new Error('Invalid roster ID');
  }

  // Validatie employee ID (TEXT, geen UUID check!)
  if (!employeeId || typeof employeeId !== 'string') {
    throw new Error('Invalid employee ID');
  }

  // Validatie target shifts range
  if (typeof targetShifts !== 'number' || targetShifts < 0 || targetShifts > 35) {
    throw new Error(`Target shifts must be between 0 and 35, got: ${targetShifts}`);
  }

  try {
    const { error } = await supabase
      .from('period_employee_staffing')
      .update({ 
        target_shifts: targetShifts,
        updated_at: new Date().toISOString()
      })
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('[PeriodEmployeeStaffing] Update error:', error);
      throw new Error(`Database update failed: ${error.message}`);
    }

    console.log(
      `[PeriodEmployeeStaffing] Updated ${employeeId} to ${targetShifts} shifts for roster ${rosterId}`
    );
  } catch (error) {
    console.error('[PeriodEmployeeStaffing] Update failed:', error);
    throw error;
  }
}
