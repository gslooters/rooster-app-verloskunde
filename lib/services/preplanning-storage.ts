/**
 * PrePlanning Storage Service
 * Data service layer voor PrePlanning scherm
 * Alle data wordt opgeslagen in Supabase roster_assignments tabel
 * 
 * DRAAD 77: Uitgebreid met dagdeel ondersteuning en status structuur
 */

import { supabase } from '@/lib/supabase';
import { PrePlanningAssignment, EmployeeWithServices, CellStatus, Dagdeel } from '@/lib/types/preplanning';
import { ServiceType } from '@/lib/types/service';
import { getAllEmployees } from '@/lib/services/employees-storage';

/**
 * Haal alle PrePlanning assignments op voor een rooster periode
 * DRAAD 77: Nu met dagdeel, status en service JOIN voor kleur
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
      .order('date', { ascending: true });

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
      
      // BACKWARDS COMPATIBILITY: service_code blijft bestaan
      service_code: row.service_types?.[0]?.code || row.service_code || '',
      
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
 * Voor het wijzigen van cel status (leeg, dienst, geblokkeerd, NB)
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @param status - Nieuwe status (0/1/2/3)
 * @param serviceId - UUID van service (alleen bij status 1)
 * @returns true bij succes, false bij fout
 */
export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null
): Promise<boolean> {
  try {
    console.log('🔄 Updating assignment status:', { rosterId, employeeId, date, dagdeel, status, serviceId });
    
    // Validatie: bij status 1 moet service_id aanwezig zijn
    if (status === 1 && !serviceId) {
      console.error('❌ Status 1 (dienst) requires service_id');
      return false;
    }
    
    // Bij status 0, 2, 3 moet service_id null zijn
    if (status !== 1 && serviceId !== null) {
      console.warn('⚠️  Setting service_id to null for status', status);
      serviceId = null;
    }
    
    const { error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        dagdeel: dagdeel,
        status: status,
        service_id: serviceId,
        service_code: null, // Reset backwards compat field
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roster_id,employee_id,date,dagdeel'
      });

    if (error) {
      console.error('❌ Error updating assignment status:', error);
      return false;
    }

    console.log('✅ Assignment status updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in updateAssignmentStatus:', error);
    return false;
  }
}

/**
 * DRAAD 77: Nieuwe functie - Haal beschikbare diensten voor medewerker
 * Via employee_services koppeltabel en JOIN met service_types
 * @param employeeId - TEXT ID van de medewerker
 * @returns Array van ServiceType objecten met code, naam, kleur
 */
export async function getServicesForEmployee(employeeId: string): Promise<ServiceType[]> {
  try {
    console.log('🔍 Getting services for employee:', employeeId);
    
    const { data, error } = await supabase
      .from('employee_services')
      .select(`
        service_types (
          id,
          code,
          naam,
          kleur,
          begintijd,
          eindtijd,
          duur,
          dienstwaarde,
          blokkeert_volgdag,
          actief,
          planregels,
          team_groen_regels,
          team_oranje_regels,
          team_totaal_regels,
          created_at,
          updated_at
        )
      `)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('❌ Error getting services for employee:', error);
      return [];
    }

    // Extract service_types van nested structure en filter actieve diensten
    const services: ServiceType[] = (data || [])
      .map((row: any) => row.service_types)
      .filter((service: any) => service && service.actief);

    console.log(`✅ Found ${services.length} active services for employee ${employeeId}`);
    return services;
  } catch (error) {
    console.error('❌ Exception in getServicesForEmployee:', error);
    return [];
  }
}

/**
 * Verwijder een PrePlanning assignment (cel leeg maken)
 * DRAAD 77: Nu met dagdeel parameter
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

    // Map naar PrePlanningAssignment met backwards compatibility
    return {
      id: data.id,
      roster_id: data.roster_id,
      employee_id: data.employee_id,
      date: data.date,
      dagdeel: data.dagdeel || 'O',
      status: data.status !== null && data.status !== undefined ? data.status : 1,
      service_id: data.service_id || null,
      service_code: data.service_types?.[0]?.code || data.service_code || '',
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('❌ Exception in getAssignmentForDate:', error);
    return null;
  }
}
