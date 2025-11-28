// DRAAD001 FIX - lib/planning/rosterDesign.ts
// SCAN2 - UTC-safe migratie autofillUnavailability (DRAAD62 pattern)
// DRAAD68 - Dagdeel-ondersteuning (O/M/A) in unavailability data
// DRAAD68.2 - TypeScript fix: verwijder onnodige type assertions
// DRAAD68.3 - TypeScript fix: includes check met expliciete array typing
// DRAAD74 - Team data in employee snapshot voor team kleuren
import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus, DagdeelAvailability, convertLegacyUnavailability } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType, getFullName, DagblokType } from '@/lib/types/employee';
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
 * ✅ DRAAD001 FIX + DRAAD68 + DRAAD74 - Volledig geïmplementeerde initializeRosterDesign met dagdeel + team data ondersteuning
 * 
 * Deze functie:
 * 1. Creëert employee snapshot van alle actieve medewerkers
 * 2. Initialiseert unavailabilityData met structurele NB per dagdeel (O/M/A)
 * 3. Maakt roster_design record aan in database
 * 
 * DRAAD68 WIJZIGING:
 * - structureel_nbh uit employees wordt per dagdeel overgenomen
 * - unavailabilityData krijgt DagdeelAvailability structuur { O?, M?, A? }
 * - Geen data loss meer - dagdeel informatie blijft behouden
 * 
 * DRAAD68.3 FIX:
 * - Expliciete type casting voor nbDagdelen array
 * - TypeScript includes() check fix
 * 
 * DRAAD74 WIJZIGING:
 * - Employee snapshot bevat nu voornaam/achternaam/team/dienstverband
 * - Team kleuren werken correct in UnavailabilityClient
 * - Debug logging toegevoegd voor verificatie
 * 
 * @param rosterId - UUID van het aangemaakte rooster
 * @param start_date - Start datum van rooster periode (YYYY-MM-DD)
 * @returns RosterDesignData object of null bij fout
 */
export async function initializeRosterDesign(rosterId: string, start_date: string): Promise<RosterDesignData|null> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[initializeRosterDesign] 🚀 START (DRAAD74 - Team data in snapshot)');
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
    
    // STAP 3: Creëer employee snapshot met team data (DRAAD74)
    const now = new Date().toISOString();
    const employeeSnapshot: RosterEmployee[] = activeEmployees.map(emp => ({
      id: `re_${emp.id}`, // Prefix voor roster employee
      name: getFullName(emp),
      voornaam: emp.voornaam || '', // DRAAD74: Voornaam voor UI
      achternaam: emp.achternaam || '', // DRAAD74: Achternaam voor volledigheid
      team: emp.team || 'Overig', // DRAAD74: Team voor kleuren (Groen/Oranje/Overig)
      dienstverband: emp.dienstverband || 'Loondienst', // DRAAD74: Dienstverband voor sortering
      maxShifts: emp.aantalWerkdagen || 0, // Gebruik aantalWerkdagen als default
      availableServices: [], // Wordt later ingevuld in UI
      isSnapshotActive: true,
      originalEmployeeId: emp.id, // Belangrijke koppeling!
      snapshotDate: now
    }));
    
    // DRAAD74: Debug logging voor team data verificatie
    console.log('[DRAAD74] Employee snapshot gecreëerd met team data:');
    employeeSnapshot.forEach(emp => {
      console.log(`  - ${emp.voornaam} ${emp.achternaam} - Team: ${emp.team} (${emp.dienstverband}) - max ${emp.maxShifts} diensten`);
    });
    console.log('');
    
    // STAP 4: Creëer default roster status
    const status = createDefaultRosterStatus();
    
    // STAP 4a: Initialiseer unavailability_data met structurele NB per dagdeel (DRAAD68)
    console.log('[initializeRosterDesign] 🔄 Initialiseer structurele NB per dagdeel...');
    const unavailabilityData: {
      [employeeId: string]: {
        [date: string]: DagdeelAvailability;
      }
    } = {};
    
    // Genereer alle datums in rooster periode (35 dagen)
    const dates: string[] = [];
    const currentDate = parseUTCDate(start_date);
    for (let i = 0; i < 35; i++) {
      const date = addUTCDays(currentDate, i);
      dates.push(toUTCDateString(date));
    }
    
    // Voor elke actieve medewerker met structureel_nbh
    for (const emp of activeEmployees) {
      if (!emp.structureel_nbh || Object.keys(emp.structureel_nbh).length === 0) {
        continue; // Skip medewerkers zonder structurele NB
      }
      
      console.log(`  - ${getFullName(emp)}: structureel NB gevonden`);
      unavailabilityData[emp.id] = {};
      
      // Voor elke datum in rooster periode
      for (const dateStr of dates) {
        const dateObj = parseUTCDate(dateStr);
        const dayCode = getWeekdayCode(dateObj).toLowerCase(); // 'ma', 'di', etc.
        
        // Check of deze dag structurele NB heeft
        const nbDagdelen = emp.structureel_nbh[dayCode] as DagblokType[];
        
        if (nbDagdelen && nbDagdelen.length > 0) {
          // Converteer array van dagdelen naar DagdeelAvailability object
          const dagdeelData: DagdeelAvailability = {};
          
          // DRAAD68.3 FIX: Gebruik type-safe includes checks
          if (nbDagdelen.includes(DagblokType.OCHTEND)) dagdeelData.O = true;
          if (nbDagdelen.includes(DagblokType.MIDDAG)) dagdeelData.M = true;
          if (nbDagdelen.includes(DagblokType.AVOND_NACHT)) dagdeelData.A = true;
          
          unavailabilityData[emp.id][dateStr] = dagdeelData;
          
          console.log(`    ${dateStr} (${dayCode}): ${nbDagdelen.join(', ')}`);
        }
      }
    }
    
    console.log('[initializeRosterDesign] ✅ Structurele NB per dagdeel geïnitialiseerd');
    console.log('');
    
    // STAP 5: Creëer roster_design record in database
    console.log('[initializeRosterDesign] 🔄 Aanmaken roster_design record...');
    const designData: RosterDesignData = {
      rosterId,
      employees: employeeSnapshot,
      status,
      unavailabilityData: unavailabilityData, // Nu met dagdeel ondersteuning
      created_at: now,
      updated_at: now
    };
    
    const created = await createRosterDesign(designData);
    console.log('[initializeRosterDesign] ✅ Roster design record aangemaakt');
    console.log('');
    
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
 * 🔥 DRAAD68 - Toggle NB (Niet Beschikbaar) assignment per dagdeel
 * 
 * BREAKING CHANGE: Functie accepteert nu dagdeel parameter
 * 
 * Toggle NB voor een medewerker op specifieke datum en dagdeel:
 * - Als dagdeel niet NB is → Zet op NB (true)
 * - Als dagdeel wel NB is → Verwijder NB (delete property)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker (gebruik originalEmployeeId uit snapshot)
 * @param date - Datum in ISO formaat (YYYY-MM-DD)
 * @param dagdeel - Dagdeel om te togglen: 'O' (ochtend), 'M' (middag), of 'A' (avond/nacht)
 * @returns true als succesvol, false bij fout
 */
export async function toggleNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: 'O' | 'M' | 'A'
): Promise<boolean> {
  try {
    console.log('🔄 Toggle NB assignment:', { rosterId, employeeId, date, dagdeel });
    
    // Haal huidige unavailability data op
    const designData = await getRosterDesignByRosterId(rosterId);
    if (!designData) {
      console.error('❌ Roster design niet gevonden');
      return false;
    }
    
    // Initialiseer nested objects indien nodig
    if (!designData.unavailabilityData[employeeId]) {
      designData.unavailabilityData[employeeId] = {};
    }
    
    if (!designData.unavailabilityData[employeeId][date]) {
      designData.unavailabilityData[employeeId][date] = {};
    }
    
    const currentData = designData.unavailabilityData[employeeId][date];
    
    // Converteer legacy boolean naar DagdeelAvailability indien nodig
    let dagdeelData: DagdeelAvailability;
    if (typeof currentData === 'boolean') {
      dagdeelData = convertLegacyUnavailability(currentData);
    } else {
      dagdeelData = currentData as DagdeelAvailability;
    }
    
    // Toggle het specifieke dagdeel
    if (dagdeelData[dagdeel]) {
      // NB is gezet → verwijder
      delete dagdeelData[dagdeel];
      console.log(`➖ NB verwijderd voor ${dagdeel}`);
    } else {
      // NB is niet gezet → voeg toe
      dagdeelData[dagdeel] = true;
      console.log(`➕ NB toegevoegd voor ${dagdeel}`);
    }
    
    // Update unavailability data
    designData.unavailabilityData[employeeId][date] = dagdeelData;
    
    // Sla op in database
    await updateRosterDesign(rosterId, designData);
    
    console.log('✅ Toggle NB succesvol');
    return true;
  } catch (error) {
    console.error('❌ Exception in toggleNBAssignment:', error);
    return false;
  }
}