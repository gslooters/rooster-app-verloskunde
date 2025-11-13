import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { getRosterDesignByRosterId, createRosterDesign, updateRosterDesign, bulkUpdateUnavailability } from '@/lib/services/roster-design-supabase';
import { getWeekdayCode } from '@/lib/utils/date-helpers';
import { 
  isEmployeeUnavailableOnDate,
  upsertNBAssignment,
  deleteAssignmentByDate
} from '@/lib/services/roster-assignments-supabase';

function normalizeDienstverband(value: any): DienstverbandType {
  if (!value) return DienstverbandType.LOONDIENST;
  const str = String(value).toLowerCase().trim();
  if (str === 'maat') return DienstverbandType.MAAT;
  if (str === 'loondienst') return DienstverbandType.LOONDIENST;
  if (str === 'zzp') return DienstverbandType.ZZP;
  return DienstverbandType.LOONDIENST;
}
function normalizeTeam(value: any): TeamType {
  if (!value) return TeamType.OVERIG;
  const str = String(value).toLowerCase().trim();
  if (str === 'groen') return TeamType.GROEN;
  if (str === 'oranje') return TeamType.ORANJE;
  return TeamType.OVERIG;
}
function sortEmployeesForRoster(list: any[]) {
  const teamOrder = [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG];
  const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
  return [...list]
    .filter(e => e.actief || e.active)
    .sort((a, b) => {
      const teamA = normalizeTeam(a.team);
      const teamB = normalizeTeam(b.team);
      const dienstA = normalizeDienstverband(a.dienstverband);
      const dienstB = normalizeDienstverband(a.dienstverband);
      const t = teamOrder.indexOf(teamA) - teamOrder.indexOf(teamB);
      if (t !== 0) return t;
      const d = dienstOrder.indexOf(dienstA) - dienstOrder.indexOf(dienstB);
      if (d !== 0) return d;
      const firstName = (a.voornaam || a.name?.split(' ')[0] || '');
      const firstNameB = (b.voornaam || b.name?.split(' ')[0] || '');
      return firstName.localeCompare(firstNameB, 'nl');
    });
}

export async function createEmployeeSnapshot(rosterId: string): Promise<RosterEmployee[]> {
  const employees = sortEmployeesForRoster(getAllEmployees());
  return employees.map(emp => {
    const rosterEmployee = createDefaultRosterEmployee({
      id: emp.id,
      name: emp.name || `${emp.voornaam} ${emp.achternaam}`,
      actief: emp.actief || emp.active || true
    });
    rosterEmployee.maxShifts = emp.aantalWerkdagen || 24;
    rosterEmployee.availableServices = ['dagdienst', 'nachtdienst', 'bereikbaarheidsdienst'];
    (rosterEmployee as any).team = emp.team;
    (rosterEmployee as any).dienstverband = emp.dienstverband;
    (rosterEmployee as any).voornaam = emp.voornaam || emp.name?.split(' ')[0] || '';
    (rosterEmployee as any).roostervrijDagen = emp.roostervrijDagen || [];
    return rosterEmployee;
  });
}

export async function loadRosterDesignData(rosterId: string): Promise<RosterDesignData | null> {
  try {
    return await getRosterDesignByRosterId(rosterId);
  } catch (error) {
    console.error('Fout bij laden roster ontwerp data:', error);
    return null;
  }
}
export async function saveRosterDesignData(data: RosterDesignData): Promise<boolean> {
  try {
    await updateRosterDesign(data.rosterId, data);
    return true;
  } catch (error) {
    console.error('Fout bij opslaan roster ontwerp data:', error);
    return false;
  }
}
export async function initializeRosterDesign(rosterId: string, start_date: string): Promise<RosterDesignData> {
  const employees = await createEmployeeSnapshot(rosterId);
  const status = createDefaultRosterStatus();
  const designData: RosterDesignData = {
    rosterId,
    employees,
    status,
    unavailabilityData: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    start_date
  } as RosterDesignData & { start_date: string };
  await createRosterDesign(designData);
  await autofillUnavailability(rosterId, start_date);
  return (await loadRosterDesignData(rosterId))!;
}
export async function updateEmployeeMaxShifts(rosterId: string, employeeId: string, maxShifts: number): Promise<boolean> {
  if (!validateMaxShifts(maxShifts)) { console.error(`Ongeldig aantal diensten: ${maxShifts}.`); return false; }
  const designData = await loadRosterDesignData(rosterId); if (!designData) return false;
  const employee = designData.employees.find(emp => emp.id === employeeId); if (!employee) return false;
  employee.maxShifts = maxShifts;
  return await saveRosterDesignData(designData);
}

export async function toggleUnavailability(rosterId: string, employeeId: string, date: string): Promise<boolean> {
  const designData = await loadRosterDesignData(rosterId); if (!designData) return false;
  if (!designData.unavailabilityData[employeeId]) { designData.unavailabilityData[employeeId] = {}; }
  const current = designData.unavailabilityData[employeeId][date] || false;
  designData.unavailabilityData[employeeId][date] = !current;
  return await saveRosterDesignData(designData);
}

export async function toggleNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    if (!rosterId || !employeeId || !date || typeof rosterId !== 'string' || typeof employeeId !== 'string' || typeof date !== 'string') {
      console.error("🛑 toggleNBAssignment: ongeldige input", { rosterId, employeeId, date });
      throw new Error("NB toggle: ongeldige input");
    }
    // Check huidige status
    const isCurrentlyNB = await isEmployeeUnavailableOnDate(
      rosterId, 
      employeeId, 
      date
    );
    console.log("🔍 NB toggle params", { rosterId, employeeId, date, isCurrentlyNB });
    if (isCurrentlyNB) {
      await deleteAssignmentByDate(rosterId, employeeId, date);
      console.log('✅ NB verwijderd - medewerker beschikbaar gemaakt:', { employeeId, date });
      return true;
    } else {
      const result = await upsertNBAssignment(rosterId, employeeId, date);
      if (!result || !result.id) {
        console.error('🛑 NB upsert faalt: geen resultaat', { rosterId, employeeId, date, result });
        throw new Error('NB opslag is mislukt');
      }
      console.log('✅ NB toegevoegd - medewerker niet-beschikbaar gemaakt:', { employeeId, date, newId: result.id });
      return true;
    }
  } catch (error) {
    console.error('❌ Fout bij toggle NB assignment:', error);
    return false;
  }
}

/**
 * GEFIXTE VERSIE MET UITGEBREIDE LOGGING
 * 
 * Vult automatisch NB (Niet Beschikbaar) diensten in voor medewerkers
 * op basis van hun roostervrijDagen configuratie.
 * 
 * @param rosterId - UUID van het rooster
 * @param start_date - Start datum in ISO formaat (YYYY-MM-DD)
 * @returns true als succesvol, false bij fout
 */
export async function autofillUnavailability(rosterId: string, start_date: string): Promise<boolean> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 START: autofillUnavailability');
  console.log('='.repeat(80));
  console.log('📋 Parameters:', { rosterId, start_date });
  
  try {
    // Laad rooster design data
    const designData = await loadRosterDesignData(rosterId);
    if (!designData) { 
      console.error('❌ FOUT: Geen designData gevonden voor rosterId:', rosterId);
      return false; 
    }
    
    console.log('✅ DesignData geladen:', {
      rosterId: designData.rosterId,
      aantalMedewerkers: designData.employees.length
    });
    
    const startDate = new Date(start_date + 'T00:00:00');
    console.log('📅 Periode:', {
      start: start_date,
      dagen: 35,
      eind: new Date(startDate.getTime() + 34 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    
    // Analyseer roostervrijDagen data
    const medewerkersMetRoostervrijDagen = designData.employees.filter(
      emp => (emp as any).roostervrijDagen && (emp as any).roostervrijDagen.length > 0
    );
    
    console.log('\n📊 Roostervrij dagen analyse:');
    console.log('   Totaal medewerkers:', designData.employees.length);
    console.log('   Met roostervrijDagen:', medewerkersMetRoostervrijDagen.length);
    
    if (medewerkersMetRoostervrijDagen.length === 0) {
      console.warn('⚠️  WAARSCHUWING: Geen enkele medewerker heeft roostervrijDagen ingesteld!');
      console.warn('   → Geen NB records zullen worden aangemaakt');
      console.warn('   → Check medewerkers configuratie in de app');
      return true; // Niet een fout, gewoon geen data
    }
    
    // Log detail per medewerker
    medewerkersMetRoostervrijDagen.forEach(emp => {
      console.log(`   • ${(emp as any).voornaam}: ${(emp as any).roostervrijDagen.join(', ')}`);
    });
    
    // Counter voor statistics
    let totalNBCreated = 0;
    let totalErrors = 0;
    
    console.log('\n🔄 Start NB bulk insert...');
    console.log('-'.repeat(80));
    
    // Loop door alle medewerkers
    for (const emp of designData.employees) {
      const roostervrijDagen: string[] = (emp as any).roostervrijDagen || [];
      
      if (!roostervrijDagen.length) {
        // Skip medewerkers zonder roostervrijDagen
        continue;
      }
      
      if (!designData.unavailabilityData[emp.id]) { 
        designData.unavailabilityData[emp.id] = {}; 
      }
      
      console.log(`\n👤 Medewerker: ${(emp as any).voornaam} (${emp.id})`);
      console.log(`   Roostervrij dagen: ${roostervrijDagen.join(', ')}`);
      
      let nbCountForEmployee = 0;
      
      // Loop door 35 dagen
      for (let i = 0; i < 35; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dagCode = getWeekdayCode(currentDate);
        const dateISO = currentDate.toISOString().split('T')[0];
        
        const isRoostervrijDag = roostervrijDagen.includes(dagCode);
        
        if (isRoostervrijDag) {
          // 🔍 LOG VOOR ELKE NB INSERT
          console.log(`   📍 NB insert: ${dateISO} (${dagCode})`);
          
          try {
            // ✅ Vul NB in database
            const result = await upsertNBAssignment(rosterId, emp.id, dateISO);
            
            if (result && result.id) {
              console.log(`      ✅ Success - ID: ${result.id}`);
              nbCountForEmployee++;
              totalNBCreated++;
              
              // Ook in JSON voor backwards compatibility
              if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
                designData.unavailabilityData[emp.id][dateISO] = true;
              }
            } else {
              console.error(`      ❌ FOUT: Geen resultaat van upsertNBAssignment`);
              totalErrors++;
            }
          } catch (error) {
            console.error(`      ❌ EXCEPTION bij NB insert:`, error);
            totalErrors++;
          }
        } else {
          // Niet een roostervrijdag - zet op false in JSON
          if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
            designData.unavailabilityData[emp.id][dateISO] = false;
          }
        }
      }
      
      console.log(`   📊 Totaal NB voor deze medewerker: ${nbCountForEmployee}`);
    }
    
    // Sla JSON data op (backwards compatibility)
    const jsonSaved = await saveRosterDesignData(designData);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ EIND: autofillUnavailability');
    console.log('='.repeat(80));
    console.log('📊 STATISTIEKEN:');
    console.log(`   Totaal NB records aangemaakt: ${totalNBCreated}`);
    console.log(`   Totaal errors: ${totalErrors}`);
    console.log(`   JSON data opgeslagen: ${jsonSaved ? 'Ja' : 'Nee'}`);
    console.log('='.repeat(80) + '\n');
    
    if (totalErrors > 0) {
      console.error(`⚠️  WAARSCHUWING: ${totalErrors} errors tijdens NB initialisatie!`);
      console.error('   Check Supabase logs en database permissions');
    }
    
    if (totalNBCreated === 0 && medewerkersMetRoostervrijDagen.length > 0) {
      console.error('❌ KRITIEK: Geen NB records aangemaakt terwijl medewerkers roostervrijDagen hebben!');
      console.error('   Dit wijst op een database probleem');
    }
    
    return jsonSaved;
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ FATALE FOUT in autofillUnavailability');
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('='.repeat(80) + '\n');
    throw error; // Re-throw zodat caller het ziet
  }
}

export async function syncRosterDesignWithEmployeeData(rosterId: string): Promise<boolean> {
  const designData = await loadRosterDesignData(rosterId); if (!designData) return false;
  const currentEmployees = getAllEmployees();
  const employeeMap = new Map(currentEmployees.map(emp => [emp.id, emp]));
  let updated = false;
  for (const rosterEmp of designData.employees) {
    const currentEmp = employeeMap.get(rosterEmp.id);
    if (currentEmp) {
      if ((rosterEmp as any).team !== currentEmp.team) {
        (rosterEmp as any).team = currentEmp.team; updated = true;
      }
      (rosterEmp as any).dienstverband = currentEmp.dienstverband;
      (rosterEmp as any).voornaam = currentEmp.voornaam;
      (rosterEmp as any).roostervrijDagen = currentEmp.roostervrijDagen;
    }
  }
  return updated ? await saveRosterDesignData(designData) : true;
}
export async function isEmployeeUnavailable(rosterId: string, employeeId: string, date: string): Promise<boolean> {
  const designData = await loadRosterDesignData(rosterId); if (!designData) return false;
  return !!designData.unavailabilityData?.[employeeId]?.[date];
}
export async function updateRosterDesignStatus(rosterId: string, updates: Partial<RosterStatus>): Promise<boolean> {
  const designData = await loadRosterDesignData(rosterId); if (!designData) return false; designData.status = { ...designData.status, ...updates }; return await saveRosterDesignData(designData);
}
export async function validateDesignComplete(rosterId: string): Promise<{ isValid: boolean; errors: string[] }> {
  const designData = await loadRosterDesignData(rosterId); if (!designData) { return { isValid: false, errors: ['Roster ontwerp data niet gevonden'] }; }
  const errors: string[] = []; const employeesWithoutShifts = designData.employees.filter(emp => emp.maxShifts === 0); if (employeesWithoutShifts.length > 0) { errors.push(`Volgende medewerkers hebben geen aantal diensten ingevuld: ${employeesWithoutShifts.map(e => e.name).join(', ')}`); }
  if (designData.status.servicesStatus !== 'vastgesteld') { errors.push('Diensten per dag moeten worden vastgesteld voordat AI kan worden gebruikt'); }
  return { isValid: errors.length === 0, errors };
}
export async function exportRosterDesignData(rosterId: string): Promise<string | null> { const designData = await loadRosterDesignData(rosterId); if (!designData) return null; return JSON.stringify(designData, null, 2); }
