/**
 * PrePlanning Storage Service
 * Data service layer voor PrePlanning scherm
 * Alle data wordt opgeslagen in Supabase roster_assignments tabel
 * 
 * DRAAD 77: Uitgebreid met dagdeel ondersteuning en status structuur
 * DRAAD 79: getServicesForEmployee updated om ServiceTypeWithTimes te returnen
 * DRAAD 82: service_code verwijderd uit updateAssignmentStatus (kolom bestaat niet meer)
 * DRAAD 83: Fix service_code mapping - JOIN returnt object, geen array
 * DRAAD 89: Service blocking rules integratie
 * DRAAD 90: Added getServicesForEmployeeFiltered voor dagdeel/datum/status filtering
 */

import { supabase } from '@/lib/supabase';
import { PrePlanningAssignment, EmployeeWithServices, CellStatus, Dagdeel, ServiceTypeWithTimes } from '@/lib/types/preplanning';
import { ServiceType } from '@/lib/types/service';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { 
  applyServiceBlockingRules, 
  removeServiceBlockingRules,
  getServiceBlockingProperties 
} from './service-blocking-rules';

/**
 * Haal alle PrePlanning assignments op voor een rooster periode
 * DRAAD 77: Nu met dagdeel, status en service JOIN voor kleur
 * DRAAD 83: Fix service_code mapping - verwijder [0] array index
 * @param rosterId - UUID van het rooster
 * @param startDate - Start datum van periode (YYYY-MM-DD)
 * @param endDate - Eind datum van periode (YYYY-MM-DD)
 * @returns Array van PrePlanningAssignment objecten
 */
export async function getPrePlanningData(
  rosterId: string,
  startDate: string,
  endDate: string
): Promise<PrePlanningAssignment[]> {
  try {
    console.log('📥 Loading PrePlanning data:', { rosterId, startDate, endDate });
    
    // JOIN met service_types om code en kleur op te halen
    const { data, error } = await supabase
      .from('roster_assignments')
      .select(`
        *,
        service_types (
          code,
          kleur
        )
      `)
      .eq('roster_id', rosterId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .limit(10000); // ✅ Fix: Verhoog limit naar 10000 voor grote roosters

    if (error) {
      console.error('❌ Error loading PrePlanning data:', error);
      throw error;
    }

    // Map resultaten naar PrePlanningAssignment met backwards compatibility
    const assignments: PrePlanningAssignment[] = (data || []).map((row: any) => ({
      id: row.id,
      roster_id: row.roster_id,
      employee_id: row.employee_id,
      date: row.date,
      
      // DRAAD 77: Nieuwe velden met defaults voor legacy data
      dagdeel: row.dagdeel || 'O', // Default ochtend voor legacy data
      status: row.status !== null && row.status !== undefined ? row.status : 1, // Default dienst
      service_id: row.service_id || null,
      
      // DRAAD 83: FIX - JOIN returnt object, geen array - verwijder [0] index
      service_code: row.service_types?.code || row.service_code || '',
      
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    console.log(`✅ Loaded ${assignments.length} PrePlanning assignments`);
    return assignments;
  } catch (error) {
    console.error('❌ Exception in getPrePlanningData:', error);
    return [];
  }
}

/**
 * Sla een PrePlanning assignment op (of update bestaande)
 * DRAAD 77: Nu met dagdeel ondersteuning
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param serviceCode - Dienst code (bijv. 'NB', 'Echo', 'Besch')
 * @param dagdeel - Dagdeel (O/M/A) - default 'O'
 * @returns true bij succes, false bij fout
 */
export async function savePrePlanningAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  serviceCode: string,
  dagdeel: Dagdeel = 'O'
): Promise<boolean> {
  try {
    console.log('💾 Saving PrePlanning assignment:', { rosterId, employeeId, date, serviceCode, dagdeel });
    
    // Haal service_id op basis van code
    const { data: serviceData, error: serviceError } = await supabase
      .from('service_types')
      .select('id')
      .eq('code', serviceCode)
      .single();
    
    if (serviceError) {
      console.error('❌ Service code not found:', serviceCode);
      return false;
    }
    
    const { error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        dagdeel: dagdeel,
        status: 1, // Dienst
        service_id: serviceData.id,
        service_code: serviceCode, // Voor backwards compatibility
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roster_id,employee_id,date,dagdeel'
      });

    if (error) {
      console.error('❌ Error saving PrePlanning assignment:', error);
      return false;
    }

    console.log('✅ PrePlanning assignment saved successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in savePrePlanningAssignment:', error);
    return false;
  }
}

/**
 * DRAAD 77: Nieuwe functie - Update assignment status
 * DRAAD 82: service_code VERWIJDERD - kolom bestaat niet meer in database schema
 * DRAAD 89: Service blocking rules integratie met Clean Slate strategie
 * 
 * Voor het wijzigen van cel status (leeg, dienst, geblokkeerd, NB)
 * 
 * CLEAN SLATE FLOW:
 * 1. Haal oude assignment op (indien aanwezig)
 * 2. Verwijder ALLE oude blokkeringen (indien service met blokkeer_volgdag)
 * 3. Update/create nieuwe assignment
 * 4. Pas nieuwe blokkeringen toe (indien service met blokkeer_volgdag)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @param status - Nieuwe status (0/1/2/3)
 * @param serviceId - UUID van service (alleen bij status 1)
 * @param rosterStartDate - Startdatum van rooster (voor periode validatie)
 * @returns Object met { success: boolean, warnings: string[] }
 */
export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null,
  rosterStartDate?: string
): Promise<{ success: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  
  try {
    console.log('🔄 Updating assignment status:', { rosterId, employeeId, date, dagdeel, status, serviceId });
    
    // Validatie: bij status 1 moet service_id aanwezig zijn
    if (status === 1 && !serviceId) {
      console.error('❌ Status 1 (dienst) requires service_id');
      return { success: false, warnings: [] };
    }
    
    // Bij status 0, 2, 3 moet service_id null zijn
    if (status !== 1 && serviceId !== null) {
      console.warn('⚠️  Setting service_id to null for status', status);
      serviceId = null;
    }

    // DRAAD 89: CLEAN SLATE STAP 1 - Haal oude assignment op
    const oldAssignment = await getAssignmentForDate(rosterId, employeeId, date, dagdeel);
    
    // DRAAD 89: CLEAN SLATE STAP 2 - Verwijder oude blokkeringen (indien aanwezig)
    if (oldAssignment && oldAssignment.service_id) {
      console.log('🧹 Clean Slate: Removing old blocking rules...');
      await removeServiceBlockingRules(
        rosterId,
        employeeId,
        date,
        dagdeel,
        oldAssignment.service_id
      );
    }
    
    // DRAAD 89: STAP 3 - Update/create assignment in database
    const { error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        dagdeel: dagdeel,
        status: status,
        service_id: serviceId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roster_id,employee_id,date,dagdeel'
      });

    if (error) {
      console.error('❌ Error updating assignment status:', error);
      return { success: false, warnings: [] };
    }

    console.log('✅ Assignment status updated successfully');

    // DRAAD 89: STAP 4 - Pas nieuwe blokkeringen toe (alleen bij status 1 met service)
    if (status === 1 && serviceId && rosterStartDate) {
      console.log('🔒 Applying new blocking rules...');
      const blockingResult = await applyServiceBlockingRules(
        rosterId,
        employeeId,
        date,
        dagdeel,
        serviceId,
        rosterStartDate
      );
      
      // Verzamel warnings
      if (blockingResult.warnings.length > 0) {
        warnings.push(...blockingResult.warnings);
        console.log('⚠️  Blocking warnings:', blockingResult.warnings);
      }
      
      console.log(`📊 Applied ${blockingResult.blocksApplied.length} blocks`);
    }
    
    return { success: true, warnings };
  } catch (error) {
    console.error('❌ Exception in updateAssignmentStatus:', error);
    return { success: false, warnings: [] };
  }
}

/**
 * DRAAD 79: Haal diensten op die een specifieke medewerker kan uitvoeren
 * Via employee_services koppeltabel
 * @param employeeId - TEXT ID van de medewerker
 * @returns Array van ServiceTypeWithTimes objecten met simplified structure
 */
export async function getServicesForEmployee(employeeId: string): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log('🔍 Getting services for employee:', employeeId);
    
    const { data, error } = await supabase
      .from('employee_services')
      .select(`
        service_id,
        service_types (
          id,
          code,
          naam,
          kleur,
          begintijd,
          eindtijd,
          actief
        )
      `)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('❌ Error getting services for employee:', error);
      return [];
    }

    // Transform nested data naar platte structuur
    const services: ServiceTypeWithTimes[] = (data || [])
      .filter((item: any) => item.service_types && item.service_types.actief)
      .map((item: any) => ({
        id: item.service_types.id,
        code: item.service_types.code,
        naam: item.service_types.naam,
        kleur: item.service_types.kleur || '#3B82F6',
        start_tijd: item.service_types.begintijd || '09:00',
        eind_tijd: item.service_types.eindtijd || '17:00'
      }));

    console.log(`✅ Found ${services.length} active services for employee ${employeeId}`);
    return services;
  } catch (error) {
    console.error('❌ Exception in getServicesForEmployee:', error);
    return [];
  }
}

/**
 * DRAAD 90: Nieuwe functie - Gefilterde diensten ophalen
 * Haal diensten op die beschikbaar zijn voor specifieke medewerker op datum/dagdeel
 * Filtert op basis van roster_period_staffing status (MAG)
 * 
 * @param employeeId - TEXT ID van de medewerker
 * @param rosterId - UUID van het rooster (voor staffing check)
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @returns Array van ServiceTypeWithTimes die MAG status hebben voor datum/dagdeel
 */
export async function getServicesForEmployeeFiltered(
  employeeId: string,
  rosterId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log('🔍 Getting FILTERED services:', { employeeId, rosterId, date, dagdeel });
    
    // Stap 1: Haal alle diensten van medewerker op
    const { data, error } = await supabase
      .from('employee_services')
      .select(`
        service_id,
        service_types (
          id,
          code,
          naam,
          kleur,
          begintijd,
          eindtijd,
          actief
        )
      `)
      .eq('employee_id', employeeId)
      .eq('actief', true);

    if (error) {
      console.error('❌ Error getting employee services:', error);
      return [];
    }

    // Stap 2: Filter diensten op basis van staffing status
    const filteredServices: ServiceTypeWithTimes[] = [];
    
    for (const item of (data || [])) {
      if (!item.service_types || !item.service_types.actief) continue;
      
      // Check staffing status voor deze dienst op datum/dagdeel
      const { data: staffingData, error: staffingError } = await supabase
        .from('roster_period_staffing')
        .select(`
          id,
          roster_period_staffing_dagdelen (
            dagdeel,
            status
          )
        `)
        .eq('roster_id', rosterId)
        .eq('service_id', item.service_id)
        .eq('date', date)
        .single();

      if (staffingError || !staffingData) continue;
      
      // Check of dagdeel MAG status heeft
      const dagdeelData = (staffingData.roster_period_staffing_dagdelen || []).find(
        (d: any) => d.dagdeel === dagdeel && d.status === 'MAG'
      );
      
      if (!dagdeelData) continue;
      
      // Dienst is toegestaan - voeg toe aan resultaat
      filteredServices.push({
        id: item.service_types.id,
        code: item.service_types.code,
        naam: item.service_types.naam,
        kleur: item.service_types.kleur || '#3B82F6',
        start_tijd: item.service_types.begintijd || '09:00',
        eind_tijd: item.service_types.eindtijd || '17:00'
      });
    }
    
    console.log(
      `✅ Found ${filteredServices.length}/${data?.length || 0} ALLOWED services ` +
      `for employee ${employeeId} on ${date} ${dagdeel}`
    );
    return filteredServices;
  } catch (error) {
    console.error('❌ Exception in getServicesForEmployeeFiltered:', error);
    return [];
  }
}

/**
 * Verwijder een PrePlanning assignment (cel leeg maken)
 * DRAAD 77: Nu met dagdeel parameter
 * DRAAD 89: Verwijder ook blokkerings-regels
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A) - default 'O' voor backwards compatibility
 * @returns true bij succes, false bij fout
 */
export async function deletePrePlanningAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel = 'O'
): Promise<boolean> {
  try {
    console.log('🗑️  Deleting PrePlanning assignment:', { rosterId, employeeId, date, dagdeel });
    
    // DRAAD 89: Haal assignment op om service_id te krijgen (voor blocking rules)
    const assignment = await getAssignmentForDate(rosterId, employeeId, date, dagdeel);
    
    // DRAAD 89: Verwijder blokkerings-regels indien aanwezig
    if (assignment && assignment.service_id) {
      console.log('🔓 Removing blocking rules before delete...');
      await removeServiceBlockingRules(
        rosterId,
        employeeId,
        date,
        dagdeel,
        assignment.service_id
      );
    }
    
    // Delete assignment
    const { error } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel);

    if (error) {
      console.error('❌ Error deleting PrePlanning assignment:', error);
      return false;
    }

    console.log('✅ PrePlanning assignment deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in deletePrePlanningAssignment:', error);
    return false;
  }
}

/**
 * Haal alle dienst codes op die een medewerker kan uitvoeren
 * @param employeeId - TEXT ID van de medewerker
 * @returns Array van service codes
 */
export async function getEmployeeServiceCodes(employeeId: string): Promise<string[]> {
  try {
    console.log('🔍 Getting service codes for employee:', employeeId);
    
    const { data, error } = await supabase
      .from('employee_services')
      .select('service_code')
      .eq('employee_id', employeeId);

    if (error) {
      console.error('❌ Error getting employee service codes:', error);
      return [];
    }

    const codes = data?.map(item => item.service_code) || [];
    console.log(`✅ Found ${codes.length} service codes for employee ${employeeId}:`, codes);
    return codes;
  } catch (error) {
    console.error('❌ Exception in getEmployeeServiceCodes:', error);
    return [];
  }
}

/**
 * Haal alle medewerkers op met hun beschikbare diensten
 * @returns Array van EmployeeWithServices objecten
 */
export async function getEmployeesWithServices(): Promise<EmployeeWithServices[]> {
  try {
    console.log('👥 Loading employees with services...');
    
    // Haal alle medewerkers op
    const employees = await getAllEmployees();
    const activeEmployees = employees.filter(e => e.actief);
    
    // Haal voor elke medewerker de service codes op
    const employeesWithServices: EmployeeWithServices[] = [];
    
    for (const employee of activeEmployees) {
      const serviceCodes = await getEmployeeServiceCodes(employee.id);
      
      employeesWithServices.push({
        id: employee.id,
        voornaam: employee.voornaam,
        achternaam: employee.achternaam,
        team: employee.team,
        dienstverband: employee.dienstverband,
        serviceCodes: serviceCodes
      });
    }
    
    console.log(`✅ Loaded ${employeesWithServices.length} employees with services`);
    return employeesWithServices;
  } catch (error) {
    console.error('❌ Exception in getEmployeesWithServices:', error);
    return [];
  }
}

/**
 * Helper functie: controleer of assignment bestaat voor specifieke datum
 * DRAAD 77: Nu met dagdeel parameter
 * DRAAD 83: Fix service_code mapping - verwijder [0] array index
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A) - default 'O' voor backwards compatibility
 * @returns PrePlanningAssignment of null
 */
export async function getAssignmentForDate(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel = 'O'
): Promise<PrePlanningAssignment | null> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select(`
        *,
        service_types (
          code,
          kleur
        )
      `)
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .single();

    if (error) {
      // Geen assignment gevonden is geen error
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('❌ Error getting assignment for date:', error);
      return null;
    }

    // DRAAD 83: FIX - JOIN returnt object, geen array - verwijder [0] index
    return {
      id: data.id,
      roster_id: data.roster_id,
      employee_id: data.employee_id,
      date: data.date,
      dagdeel: data.dagdeel || 'O',
      status: data.status !== null && data.status !== undefined ? data.status : 1,
      service_id: data.service_id || null,
      service_code: data.service_types?.code || data.service_code || '',
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('❌ Exception in getAssignmentForDate:', error);
    return null;
  }
}
