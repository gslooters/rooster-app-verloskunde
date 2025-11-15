// FASE 2: Employee Services met UUID koppeling en dienstwaarde berekening
import { createClient } from '@supabase/supabase-js';
import type { 
  EmployeeService, 
  EmployeeServiceInput, 
  EmployeeServiceRow,
  ServiceType 
} from '../types/employee-services';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Haal alle medewerkers op met hun dienst-toewijzingen
 * Inclusief gewogen berekening van totaal
 */
export async function getEmployeeServicesOverview(): Promise<EmployeeServiceRow[]> {
  console.log('🔄 Loading employee services overview...');

  // Haal medewerkers op
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, naam, team, dienstenperiode')
    .order('team', { ascending: true })
    .order('naam', { ascending: true });
  
  if (empError) {
    console.error('❌ Error loading employees:', empError);
    throw empError;
  }

  // Haal alle diensten op inclusief dienstwaarde
  const { data: services, error: servError } = await supabase
    .from('service_types')
    .select('id, code, dienstwaarde')  // ← GEBRUIK dienstwaarde, niet weging
    .eq('actief', true)
    .order('code', { ascending: true });
  
  if (servError) {
    console.error('❌ Error loading services:', servError);
    throw servError;
  }

  // Haal alle employee_services op
  const { data: employeeServices, error: esError } = await supabase
    .from('employee_services')
    .select('employee_id, service_id, can_perform_service, target_count_per_period');
  
  if (esError) {
    console.error('❌ Error loading employee services:', esError);
    throw esError;
  }

  console.log(`✅ Loaded ${employees?.length || 0} employees, ${services?.length || 0} services`);

  // Maak lookup maps
  const serviceMap = new Map(
    services?.map(s => [s.id, { code: s.code, dienstwaarde: s.dienstwaarde || 1.0 }]) || []
  );
  
  const empServiceMap = new Map<string, Map<string, { 
    enabled: boolean; 
    count: number; 
    dienstwaarde: number 
  }>>();
  
  employeeServices?.forEach(es => {
    if (!empServiceMap.has(es.employee_id)) {
      empServiceMap.set(es.employee_id, new Map());
    }
    const serviceInfo = serviceMap.get(es.service_id);
    if (serviceInfo) {
      empServiceMap.get(es.employee_id)!.set(serviceInfo.code, {
        enabled: es.can_perform_service,
        count: es.target_count_per_period,
        dienstwaarde: serviceInfo.dienstwaarde
      });
    }
  });

  // Bouw result met gewogen berekening
  const result: EmployeeServiceRow[] = (employees || []).map(emp => {
    const empServices = empServiceMap.get(emp.id) || new Map();
    const servicesObj: any = {};
    let totalDiensten = 0;

    services?.forEach(service => {
      const data = empServices.get(service.code) || { 
        enabled: false, 
        count: 0, 
        dienstwaarde: service.dienstwaarde || 1.0
      };
      servicesObj[service.code] = data;
      
      // Berekening: som van (aantal × dienstwaarde)
      if (data.enabled && data.count > 0) {
        totalDiensten += data.count * data.dienstwaarde;
      }
    });

    return {
      employeeId: emp.id,
      employeeName: emp.naam,
      team: emp.team,
      dienstenperiode: emp.dienstenperiode || 0,
      services: servicesObj,
      totalDiensten: Math.round(totalDiensten * 10) / 10,
      isOnTarget: Math.abs(totalDiensten - (emp.dienstenperiode || 0)) < 0.1
    };
  });

  console.log(`✅ Built overview for ${result.length} employees`);
  return result;
}

/**
 * Update dienst-toewijzing voor een medewerker
 */
export async function upsertEmployeeService(
  input: EmployeeServiceInput
): Promise<EmployeeService> {
  console.log('💾 Upserting employee service:', input);

  const { data, error } = await supabase
    .from('employee_services')
    .upsert({
      employee_id: input.employee_id,
      service_id: input.service_id,
      can_perform_service: input.can_perform_service,
      target_count_per_period: input.target_count_per_period
    }, {
      onConflict: 'employee_id,service_id'
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error upserting:', error);
    throw error;
  }

  console.log('✅ Successfully upserted employee service');
  return data;
}

/**
 * Verwijder dienst-toewijzing
 */
export async function deleteEmployeeService(
  employeeId: string, 
  serviceId: string
): Promise<void> {
  const { error } = await supabase
    .from('employee_services')
    .delete()
    .eq('employee_id', employeeId)
    .eq('service_id', serviceId);
  
  if (error) throw error;
}

/**
 * Haal service_id op basis van code
 */
export async function getServiceIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('service_types')
    .select('id')
    .eq('code', code)
    .eq('actief', true)
    .single();
  
  if (error || !data) return null;
  return data.id;
}

/**
 * Legacy functie voor backwards compatibility
 * Retourneert: { "employee-id": ["dienst1", "dienst2"], ... }
 */
export async function getEmployeeServicesMappings(): Promise<Record<string, string[]>> {
  console.log('⚠️ Using legacy getEmployeeServicesMappings - consider migrating to getEmployeeServicesOverview');
  
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id');
  
  if (empError) throw empError;

  const { data: services, error: servError } = await supabase
    .from('service_types')
    .select('id, code')
    .eq('actief', true);
  
  if (servError) throw servError;

  const { data: employeeServices, error: esError } = await supabase
    .from('employee_services')
    .select('employee_id, service_id, can_perform_service');
  
  if (esError) throw esError;

  const serviceCodeMap = new Map(services?.map(s => [s.id, s.code]) || []);
  const mappings: Record<string, string[]> = {};
  
  employeeServices?.forEach(es => {
    if (es.can_perform_service) {
      const code = serviceCodeMap.get(es.service_id);
      if (code) {
        if (!mappings[es.employee_id]) {
          mappings[es.employee_id] = [];
        }
        mappings[es.employee_id].push(code);
      }
    }
  });
  
  return mappings;
}

/**
 * Legacy functie voor backwards compatibility
 * Sla diensten op voor een specifieke medewerker
 */
export async function setServicesForEmployee(employeeId: string, serviceCodes: string[]) {
  console.log('⚠️ Using legacy setServicesForEmployee - consider migrating to upsertEmployeeService');
  
  // Haal service IDs op voor de codes
  const { data: services, error: servError } = await supabase
    .from('service_types')
    .select('id, code')
    .in('code', serviceCodes)
    .eq('actief', true);
  
  if (servError) throw servError;

  const serviceIdMap = new Map(services?.map(s => [s.code, s.id]) || []);
  
  // Verwijder alle bestaande toekenningen
  const { error: deleteError } = await supabase
    .from('employee_services')
    .delete()
    .eq('employee_id', employeeId);
  
  if (deleteError) throw deleteError;
  
  // Als geen diensten, klaar
  if (serviceCodes.length === 0) {
    return [];
  }
  
  // Voeg nieuwe rijen toe
  const newRows = serviceCodes
    .map(code => {
      const serviceId = serviceIdMap.get(code);
      if (!serviceId) return null;
      return {
        employee_id: employeeId,
        service_id: serviceId,
        can_perform_service: true,
        target_count_per_period: 0
      };
    })
    .filter(row => row !== null);
  
  if (newRows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('employee_services')
    .insert(newRows)
    .select();
  
  if (error) throw error;
  return data;
}
