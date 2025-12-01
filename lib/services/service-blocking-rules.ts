/**
 * Service Blocking Rules Module
 * Beheert automatische blokkering van dagdelen op basis van dienst eigenschappen
 * 
 * DRAAD 89: blokkeer_volgdag implementatie
 * 
 * REGELS:
 * 1. Nachtdienst doorloop (eindtijd="09:00" + blokkeer_volgdag=true)
 *    → Blokkeert O+M van volgende dag
 * 
 * 2. Dagdienst doorloop (begintijd="09:00" + blokkeer_volgdag=true)
 *    → Blokkeert M van zelfde dag
 * 
 * 3. Reverse blocking (Clean Slate strategie)
 *    → Bij wijziging/verwijdering: eerst ALLE oude blokkeringen wissen
 *    → Dan nieuwe blokkeringen toepassen (indien van toepassing)
 */

import { supabase } from '@/lib/supabase';
import { Dagdeel, AssignmentStatus } from './roster-assignments-supabase';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Service eigenschappen relevant voor blokkering
 */
export interface ServiceBlockingProperties {
  id: string;
  blokkeerVolgdag: boolean;
  begintijd: string | null;
  eindtijd: string | null;
}

/**
 * Een enkele blokkeer-actie die uitgevoerd wordt
 */
export interface BlockingAction {
  date: string;
  dagdeel: Dagdeel;
  reason: string; // Voor logging/debugging
}

/**
 * Resultaat van blokkerings-operaties
 */
export interface BlockingResult {
  blocksApplied: BlockingAction[];
  warnings: string[];
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Pas blokkerings-regels toe voor een dienst-toewijzing
 * 
 * REGEL 1: eindtijd="09:00" + blokkeer_volgdag=true → blokker O+M volgende dag
 * REGEL 2: begintijd="09:00" + blokkeer_volgdag=true → blokker M zelfde dag
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param assignmentDate - Datum van de dienst (YYYY-MM-DD)
 * @param assignmentDagdeel - Dagdeel van de dienst (O/M/A)
 * @param serviceId - UUID van de dienst
 * @param rosterStartDate - Startdatum van rooster (voor periode check)
 * @returns Object met toegepaste blokkeringen en eventuele warnings
 */
export async function applyServiceBlockingRules(
  rosterId: string,
  employeeId: string,
  assignmentDate: string,
  assignmentDagdeel: Dagdeel,
  serviceId: string,
  rosterStartDate: string
): Promise<BlockingResult> {
  console.log('🔒 Applying blocking rules:', {
    rosterId,
    employeeId,
    date: assignmentDate,
    dagdeel: assignmentDagdeel,
    serviceId
  });

  const result: BlockingResult = {
    blocksApplied: [],
    warnings: []
  };

  try {
    // Haal service eigenschappen op
    const serviceProps = await getServiceBlockingProperties(serviceId);
    
    if (!serviceProps) {
      console.log('ℹ️  Service not found or no blocking properties');
      return result;
    }

    // Check of blokkeer_volgdag actief is
    if (!serviceProps.blokkeerVolgdag) {
      console.log('ℹ️  No blocking (blokkeer_volgdag=false)');
      return result;
    }

    // REGEL 1: Nachtdienst doorloop (eindtijd="09:00")
    // Dienst eindigt om 09:00 → blokkeert O+M van volgende dag
    // 🔒 EXTRA CHECK: begintijd mag NIET 09:00 zijn (dat is dagdienst)
    if (serviceProps.eindtijd === '09:00' && assignmentDagdeel === 'A' && serviceProps.begintijd !== '09:00') {
      console.log('🌙 Regel 1: Nachtdienst eindigt 09:00, blokkeert O+M volgende dag');
      
      const nextDay = getNextDay(assignmentDate);
      
      // Check of volgende dag binnen roosterperiode valt
      if (!isDateWithinRosterPeriod(rosterStartDate, nextDay)) {
        const warning = `Waarschuwing: Dienst blokkeert dagdelen buiten roosterperiode (${formatDate(nextDay)})`;
        result.warnings.push(warning);
        console.log(`⚠️  ${warning}`);
        return result; // Niet blokkeren buiten periode
      }

      // Blokker Ochtend (O) volgende dag
      const blockedO = await blockAssignment(rosterId, employeeId, nextDay, 'O');
      if (blockedO) {
        result.blocksApplied.push({
          date: nextDay,
          dagdeel: 'O',
          reason: 'Nachtdienst eindigt 09:00'
        });
        console.log(`✅ Blocked ${nextDay} O`);
      }

      // Blokker Middag (M) volgende dag
      const blockedM = await blockAssignment(rosterId, employeeId, nextDay, 'M');
      if (blockedM) {
        result.blocksApplied.push({
          date: nextDay,
          dagdeel: 'M',
          reason: 'Nachtdienst eindigt 09:00'
        });
        console.log(`✅ Blocked ${nextDay} M`);
      }
    }

    // REGEL 2: Dagdienst doorloop (begintijd="09:00")
    // Dienst start om 09:00 in O-dagdeel → blokkeert M van zelfde dag
    if (serviceProps.begintijd === '09:00' && assignmentDagdeel === 'O') {
      console.log('☀️  Regel 2: Dagdienst start 09:00, blokkeert M zelfde dag');
      
      // Blokker Middag (M) zelfde dag
      const blocked = await blockAssignment(rosterId, employeeId, assignmentDate, 'M');
      if (blocked) {
        result.blocksApplied.push({
          date: assignmentDate,
          dagdeel: 'M',
          reason: 'Dagdienst start 09:00'
        });
        console.log(`✅ Blocked ${assignmentDate} M`);
      }
    }

    // Log samenvatting
    console.log('📊 Blocking summary:', {
      applied: result.blocksApplied.length,
      warnings: result.warnings.length
    });

    return result;
  } catch (error) {
    console.error('❌ Error in applyServiceBlockingRules:', error);
    return result;
  }
}

/**
 * Verwijder blokkerings-regels van een eerdere dienst-toewijzing
 * 
 * CLEAN SLATE STRATEGIE:
 * - Wordt ALTIJD aangeroepen voor wijziging/verwijdering
 * - Zet alle geblokkeerde cellen terug naar status 0
 * - Daarna wordt (indien van toepassing) applyServiceBlockingRules aangeroepen
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param assignmentDate - Datum van de dienst (YYYY-MM-DD)
 * @param assignmentDagdeel - Dagdeel van de dienst (O/M/A)
 * @param serviceId - UUID van de dienst die verwijderd/gewijzigd wordt
 * @returns Aantal gedeblokkeerde assignments
 */
export async function removeServiceBlockingRules(
  rosterId: string,
  employeeId: string,
  assignmentDate: string,
  assignmentDagdeel: Dagdeel,
  serviceId: string
): Promise<number> {
  console.log('🔓 Removing blocking rules:', {
    rosterId,
    employeeId,
    date: assignmentDate,
    dagdeel: assignmentDagdeel,
    serviceId
  });

  let unblockedCount = 0;

  try {
    // Haal service eigenschappen op
    const serviceProps = await getServiceBlockingProperties(serviceId);
    
    if (!serviceProps || !serviceProps.blokkeerVolgdag) {
      console.log('ℹ️  No blocking to remove (blokkeer_volgdag=false or service not found)');
      return 0;
    }

    // REGEL 1 REVERSE: Nachtdienst doorloop (eindtijd="09:00")
    // Deblokkeer O+M van volgende dag
    // 🔒 EXTRA CHECK: begintijd mag NIET 09:00 zijn (dat is dagdienst)
    if (serviceProps.eindtijd === '09:00' && assignmentDagdeel === 'A' && serviceProps.begintijd !== '09:00') {
      console.log('🌙 Reverse Regel 1: Deblokker O+M volgende dag');
      
      const nextDay = getNextDay(assignmentDate);
      
      // Deblokkeer Ochtend (O)
      const unblockedO = await unblockAssignment(rosterId, employeeId, nextDay, 'O');
      if (unblockedO) {
        unblockedCount++;
        console.log(`🔓 Unblocked ${nextDay} O`);
      }

      // Deblokkeer Middag (M)
      const unblockedM = await unblockAssignment(rosterId, employeeId, nextDay, 'M');
      if (unblockedM) {
        unblockedCount++;
        console.log(`🔓 Unblocked ${nextDay} M`);
      }
    }

    // REGEL 2 REVERSE: Dagdienst doorloop (begintijd="09:00")
    // Deblokkeer M van zelfde dag
    if (serviceProps.begintijd === '09:00' && assignmentDagdeel === 'O') {
      console.log('☀️  Reverse Regel 2: Deblokker M zelfde dag');
      
      const unblocked = await unblockAssignment(rosterId, employeeId, assignmentDate, 'M');
      if (unblocked) {
        unblockedCount++;
        console.log(`🔓 Unblocked ${assignmentDate} M`);
      }
    }

    console.log(`📊 Unblocking summary: ${unblockedCount} assignments unblocked`);
    return unblockedCount;
  } catch (error) {
    console.error('❌ Error in removeServiceBlockingRules:', error);
    return unblockedCount;
  }
}

/**
 * Haal blokkeer-eigenschappen van een dienst op
 * 
 * @param serviceId - UUID van de dienst
 * @returns Service eigenschappen of null
 */
export async function getServiceBlockingProperties(
  serviceId: string
): Promise<ServiceBlockingProperties | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, blokkeert_volgdag, begintijd, eindtijd')
      .eq('id', serviceId)
      .single();

    if (error) {
      console.error('❌ Error fetching service properties:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      blokkeerVolgdag: data.blokkeert_volgdag || false,
      begintijd: data.begintijd,
      eindtijd: data.eindtijd
    };
  } catch (error) {
    console.error('❌ Exception in getServiceBlockingProperties:', error);
    return null;
  }
}

/**
 * Check of datum binnen roosterperiode (35 dagen) valt
 * 
 * @param rosterStartDate - Startdatum van rooster (YYYY-MM-DD)
 * @param checkDate - Te checken datum (YYYY-MM-DD)
 * @returns true als binnen periode, false als buiten
 */
export function isDateWithinRosterPeriod(
  rosterStartDate: string,
  checkDate: string
): boolean {
  const startDate = new Date(rosterStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 34); // 35 dagen totaal (0-34)

  const check = new Date(checkDate);

  return check >= startDate && check <= endDate;
}

/**
 * Bereken de volgende dag (voor regel 1: eindtijd 09:00)
 * 
 * @param date - Datum in YYYY-MM-DD formaat
 * @returns Volgende dag in YYYY-MM-DD formaat
 */
export function getNextDay(date: string): string {
  const currentDate = new Date(date);
  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + 1);
  
  return nextDate.toISOString().split('T')[0];
}

/**
 * Formatteer datum voor weergave (DD-MM formaat)
 * 
 * @param date - Datum in YYYY-MM-DD formaat
 * @returns Datum in DD-MM formaat
 */
function formatDate(date: string): string {
  const parts = date.split('-');
  return `${parts[2]}-${parts[1]}`;
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Update assignment status naar geblokkeerd
 * Alleen als huidige status = 0 (beschikbaar)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @returns true als geblokkeerd, false als niet mogelijk
 */
async function blockAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<boolean> {
  try {
    // Update alleen als status = 0 (beschikbaar)
    const { data, error } = await supabase
      .from('roster_assignments')
      .update({
        status: AssignmentStatus.BLOCKED,
        service_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .eq('status', AssignmentStatus.AVAILABLE) // Alleen blokkeren als beschikbaar
      .select();

    if (error) {
      console.error(`❌ Error blocking ${date} ${dagdeel}:`, error);
      return false;
    }

    // Check of er daadwerkelijk een row is geupdate
    if (!data || data.length === 0) {
      console.log(`⚠️  Cell ${date} ${dagdeel} already blocked or assigned, skipping`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Exception blocking ${date} ${dagdeel}:`, error);
    return false;
  }
}

/**
 * Update assignment status naar beschikbaar (deblokeer)
 * Alleen als huidige status = 2 (geblokkeerd) EN service_id = null
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @returns true als gedeblokkeerd, false als niet mogelijk
 */
async function unblockAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<boolean> {
  try {
    // Update alleen als status = 2 (geblokkeerd) EN service_id = null
    const { data, error } = await supabase
      .from('roster_assignments')
      .update({
        status: AssignmentStatus.AVAILABLE,
        updated_at: new Date().toISOString()
      })
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .eq('status', AssignmentStatus.BLOCKED) // Alleen deblokkeren als geblokkeerd
      .is('service_id', null) // Alleen als niet ingepland
      .select();

    if (error) {
      console.error(`❌ Error unblocking ${date} ${dagdeel}:`, error);
      return false;
    }

    // Check of er daadwerkelijk een row is geupdate
    if (!data || data.length === 0) {
      console.log(`ℹ️  Cell ${date} ${dagdeel} not blocked or has service, skipping`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Exception unblocking ${date} ${dagdeel}:`, error);
    return false;
  }
}
