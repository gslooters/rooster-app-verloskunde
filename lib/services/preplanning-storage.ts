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
 * ...[omschrijving bovenin onveranderd, code niet gewijzigd]
 */

export async function getPrePlanningData(
  rosterId: string,
  startDate: string,
  endDate: string
): Promise<PrePlanningAssignment[]> {
  // ... (ongewijzigd)
}

export async function savePrePlanningAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  serviceCode: string,
  dagdeel: Dagdeel = 'O'
): Promise<boolean> {
  // ... (ongewijzigd)
}

export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null,
  rosterStartDate?: string
): Promise<{ success: boolean; warnings: string[] }> {
  // ... (ongewijzigd)
}

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

    // Fix: Check type explicitly. service_types is een object, geen array.
    const services: ServiceTypeWithTimes[] = (data || [])
      .filter((item: any) => item.service_types && (item.service_types as any).actief)
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

export async function getServicesForEmployeeFiltered(
  employeeId: string,
  rosterId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log('🔍 Getting FILTERED services:', { employeeId, rosterId, date, dagdeel });
    
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

    const filteredServices: ServiceTypeWithTimes[] = [];
    
    for (const item of (data || [])) {
      if (!item.service_types || !(item.service_types as any).actief) continue;
      // ... de rest is ongewijzigd ...
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
      const dagdeelData = (staffingData.roster_period_staffing_dagdelen || []).find(
        (d: any) => d.dagdeel === dagdeel && d.status === 'MAG'
      );
      if (!dagdeelData) continue;
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

export async function deletePrePlanningAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel = 'O'
): Promise<boolean> {
  // ... (ongewijzigd)
}

export async function getEmployeeServiceCodes(employeeId: string): Promise<string[]> {
  // ... (ongewijzigd)
}

export async function getEmployeesWithServices(): Promise<EmployeeWithServices[]> {
  // ... (ongewijzigd)
}

export async function getAssignmentForDate(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel = 'O'
): Promise<PrePlanningAssignment | null> {
  // ... (ongewijzigd)
}
