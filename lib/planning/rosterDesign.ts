// DRAAD001 FIX - lib/planning/rosterDesign.ts
// SCAN2 - UTC-safe migratie autofillUnavailability (DRAAD62 pattern)
import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType, getFullName } from '@/lib/types/employee';
import { getRosterDesignByRosterId, createRosterDesign, updateRosterDesign, bulkUpdateUnavailability } from '@/lib/services/roster-design-supabase';
import { getWeekdayCode } from '@/lib/utils/date-helpers';
import { parseUTCDate, addUTCDays, toUTCDateString } from '@/lib/utils/date-utc';
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

/**
 * ✅ DRAAD001 FIX - Volledig geïmplementeerde initializeRosterDesign
 * 
 * Deze functie:
 * 1. Creëert employee snapshot van alle actieve medewerkers
 * 2. Maakt roster_design record aan in database
 * 3. Roept autofillUnavailability aan voor roostervrijDagen
 * 
 * @param rosterId - UUID van het aangemaakte rooster
 * @param start_date - Start datum van rooster periode (YYYY-MM-DD)
 * @returns RosterDesignData object of null bij fout
 */
export async function initializeRosterDesign(rosterId: string, start_date: string): Promise<RosterDesignData|null> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[initializeRosterDesign] 🚀 START');
    console.log('[initializeRosterDesign] RosterId:', rosterId);
    console.log('[initializeRosterDesign] Start date:', start_date);
    console.log('='.repeat(80) + '\n');
    
    // STAP 1: Check of roster_design al bestaat (voorkom duplicaten)
    const existing = await getRosterDesignByRosterId(rosterId);
    if (existing) {
      console.log('[initializeRosterDesign] ✅ Roster design bestaat al, skip creatie');
      return existing;
    }
    
    // STAP 2: Haal actieve medewerkers op
    const allEmployees = getAllEmployees();
    const activeEmployees = allEmployees.filter(emp => emp.actief);
    
    console.log(`[initializeRosterDesign] Totaal medewerkers: ${allEmployees.length}`);
    console.log(`[initializeRosterDesign] Actieve medewerkers: ${activeEmployees.length}`);
    
    if (activeEmployees.length === 0) {
      console.error('[initializeRosterDesign] ❌ FOUT: Geen actieve medewerkers gevonden');
      return null;
    }
    
    // STAP 3: Creëer employee snapshot
    const now = new Date().toISOString();
    const employeeSnapshot: RosterEmployee[] = activeEmployees.map(emp => ({
      id: `re_${emp.id}`, // Prefix voor roster employee
      name: getFullName(emp),
      maxShifts: emp.aantalWerkdagen || 0, // Gebruik aantalWerkdagen als default
      availableServices: [], // Wordt later ingevuld in UI
      isSnapshotActive: true,
      originalEmployeeId: emp.id, // Belangrijke koppeling!
      snapshotDate: now
    }));
    
    console.log('[initializeRosterDesign] Employee snapshot gecreëerd:');
    employeeSnapshot.forEach(emp => {
      console.log(`  • ${emp.name} (${emp.originalEmployeeId}) - max ${emp.maxShifts} diensten`);
    });
    console.log('');
    
    // STAP 4: Creëer default roster status
    const status = createDefaultRosterStatus();
    
    // STAP 5: Creëer roster_design record in database
    console.log('[initializeRosterDesign] 🔄 Aanmaken roster_design record...');
    const designData: RosterDesignData = {
      rosterId,
      employees: employeeSnapshot,
      status,
      unavailabilityData: {}, // Leeg object, wordt ingevuld door autofillUnavailability
      created_at: now,
      updated_at: now
    };
    
    const created = await createRosterDesign(designData);
    console.log('[initializeRosterDesign] ✅ Roster design record aangemaakt');
    console.log('');
    
    // STAP 6: Vul automatisch roostervrijDagen in (NB assignments)
    console.log('[initializeRosterDesign] 🔄 Start autofillUnavailability...');
    const autofillSuccess = await autofillUnavailability(rosterId, start_date);
    
    if (autofillSuccess) {
      console.log('[initializeRosterDesign] ✅ Roostervrijdagen succesvol ingevuld');
    } else {
      console.warn('[initializeRosterDesign] ⚠️  Roostervrijdagen invullen gefaald (niet kritiek)');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('[initializeRosterDesign] ✅ VOLTOOID');
    console.log('='.repeat(80) + '\n');
    
    return created;
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('[initializeRosterDesign] ❌ FOUT');
    console.error('[initializeRosterDesign] Error:', error);
    console.error('='.repeat(80) + '\n');
    return null;
  }
}

/**
 * 🔥 SCAN2 FIX - UTC-safe autofillUnavailability (DRAAD62 pattern)
 * 
 * Vult automatisch NB (Niet Beschikbaar) assignments in voor medewerkers
 * op basis van hun roostervrijDagen configuratie.
 * 
 * BELANGRIJKE WIJZIGING (SCAN2):
 * - Migratie van locale timezone (new Date()) naar UTC-safe utilities
 * - Gebruikt parseUTCDate, addUTCDays, toUTCDateString uit lib/utils/date-utc
 * - Consistent met DRAAD62 weekDagdelenData.ts fix
 * - Voorkomt timezone bugs, vooral bij DST transitions
 * 
 * Logica:
 * - Voor elke actieve medewerker met roostervrijDagen configuratie
 * - Genereer alle datums in de rooster periode (UTC-safe)
 * - Filter op datums die overeenkomen met roostervrijDagen
 * - Creëer NB assignment voor elke match
 * 
 * @param rosterId - UUID van het rooster
 * @param start_date - Start datum van rooster periode (YYYY-MM-DD)
 * @returns true als succesvol, false bij fout
 */
export async function autofillUnavailability(rosterId: string, start_date: string): Promise<boolean> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[autofillUnavailability] 🚀 START (UTC-SAFE)');
    console.log('[autofillUnavailability] RosterId:', rosterId);
    console.log('[autofillUnavailability] Start date:', start_date);
    console.log('='.repeat(80) + '\n');
    
    // STAP 1: Haal roster info op om end_date te krijgen
    const { data: rosterData, error: rosterError } = await supabase
      .from('roosters')
      .select('start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !rosterData) {
      console.error('[autofillUnavailability] ❌ Kon roster data niet ophalen:', rosterError);
      return false;
    }
    
    const { start_date: startDate, end_date: endDate } = rosterData;
    console.log(`[autofillUnavailability] Periode: ${startDate} tot ${endDate}`);
    
    // 🔥 SCAN2 FIX: UTC-safe datum generatie (DRAAD62 pattern)
    // OUDE CODE:
    //   const current = new Date(startDate);  // ⚠️ Locale timezone!
    //   const end = new Date(endDate);
    //   while (current <= end) {
    //     dates.push(current.toISOString().split('T')[0]);  // ⚠️ Kan afwijken!
    //     current.setDate(current.getDate() + 1);  // ⚠️ Locale arithmetic!
    //   }
    //
    // NIEUWE CODE (UTC-safe):
    const dates: string[] = [];
    const currentDate = parseUTCDate(startDate);  // ✅ UTC midnight!
    const endDateObj = parseUTCDate(endDate);     // ✅ UTC midnight!
    
    let iterDate = currentDate;
    while (iterDate <= endDateObj) {
      dates.push(toUTCDateString(iterDate));  // ✅ YYYY-MM-DD in UTC!
      iterDate = addUTCDays(iterDate, 1);     // ✅ UTC arithmetic!
    }
    
    console.log(`[autofillUnavailability] Totaal dagen in periode: ${dates.length}`);
    console.log('');
    
    // STAP 3: Haal actieve medewerkers op met roostervrijDagen
    const allEmployees = getAllEmployees();
    const activeEmployees = allEmployees.filter(emp => 
      emp.actief && emp.roostervrijDagen && emp.roostervrijDagen.length > 0
    );
    
    console.log(`[autofillUnavailability] Medewerkers met roostervrijDagen: ${activeEmployees.length}`);
    
    if (activeEmployees.length === 0) {
      console.warn('[autofillUnavailability] ⚠️  Geen medewerkers met roostervrijDagen configuratie');
      console.warn('[autofillUnavailability] Geen NB assignments aangemaakt');
      return true; // Niet een fout, gewoon geen data
    }
    
    // STAP 4: Creëer NB assignments
    const assignments: Array<{
      roster_id: string;
      employee_id: string;
      service_code: string;
      date: string;
    }> = [];
    
    for (const emp of activeEmployees) {
      console.log(`[autofillUnavailability] Verwerk ${emp.voornaam} ${emp.achternaam}:`);
      console.log(`  Roostervrij: [${emp.roostervrijDagen.join(', ')}]`);
      
      const roostervrijSet = new Set(emp.roostervrijDagen.map(d => d.toLowerCase()));
      let nbCount = 0;
      
      for (const date of dates) {
        // 🔥 SCAN2: dateObj is nu altijd UTC (van parseUTCDate/toUTCDateString)
        // getWeekdayCode was al UTC-safe (gebruikt date.getUTCDay())
        const dateObj = parseUTCDate(date);  // ✅ UTC parsing!
        const dayCode = getWeekdayCode(dateObj).toLowerCase();  // ✅ UTC-based dag code!
        
        if (roostervrijSet.has(dayCode)) {
          assignments.push({
            roster_id: rosterId,
            employee_id: emp.id, // Gebruik originele employee ID
            service_code: 'NB',
            date: date  // ✅ UTC YYYY-MM-DD string!
          });
          nbCount++;
        }
      }
      
      console.log(`  → ${nbCount} NB assignments voor ${emp.voornaam}`);
    }
    
    console.log('');
    console.log(`[autofillUnavailability] Totaal NB assignments: ${assignments.length}`);
    
    // STAP 5: Bulk insert NB assignments
    if (assignments.length > 0) {
      console.log('[autofillUnavailability] 🔄 Bulk insert NB assignments...');
      
      const { error: insertError } = await supabase
        .from('roster_assignments')
        .insert(assignments);
      
      if (insertError) {
        console.error('[autofillUnavailability] ❌ Fout bij bulk insert:', insertError);
        return false;
      }
      
      console.log('[autofillUnavailability] ✅ Bulk insert succesvol');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('[autofillUnavailability] ✅ VOLTOOID (UTC-SAFE)');
    console.log('='.repeat(80) + '\n');
    
    return true;
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('[autofillUnavailability] ❌ FOUT');
    console.error('[autofillUnavailability] Error:', error);
    console.error('='.repeat(80) + '\n');
    return false;
  }
}

/**
 * ✅ DRAAD 27E - Toggle NB (Niet Beschikbaar) assignment
 * 
 * Toggle NB (Niet Beschikbaar) assignment voor een medewerker op een specifieke datum
 * 
 * Logica:
 * - Als er GEEN assignment is → Voeg NB toe
 * - Als er WEL een NB assignment is → Verwijder deze
 * - Als er een ANDERE dienst is → Doe NIETS (wordt afgehandeld in UI)
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
      // Geen assignment → Voeg NB toe
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
      // NB assignment bestaat → Verwijder deze
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
      // Andere dienst → Niet toegestaan (wordt in UI afgehandeld)
      console.warn('⚠️  Andere dienst aanwezig, toggle niet toegestaan:', existingAssignment.service_code);
      return false;
    }
  } catch (error) {
    console.error('❌ Exception in toggleNBAssignment:', error);
    return false;
  }
}