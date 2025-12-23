// lib/services/roster-employee-services.ts
// DRAAD66A: Service layer voor roster_employee_services tabel
// Deze tabel bevat een SNAPSHOT van employee_services op het moment van rooster creatie

import { supabase } from '@/lib/supabase';

/**
 * Database row structure voor roster_employee_services tabel
 * Dit is een snapshot van employee_services op moment van rooster creatie
 */
export interface RosterEmployeeServiceRow {
  id: string;
  roster_id: string;
  employee_id: string;
  team: string;           // ✅ NIEUW - na employee_id (DRAAD 341)
  service_id: string;
  actief: boolean; // Database column naam
  aantal: number;
  created_at: string;
}

/**
 * Extended row met service type informatie via JOIN
 */
export interface RosterEmployeeServiceWithType extends RosterEmployeeServiceRow {
  service_types?: {
    code: string;
    naam: string;
    kleur: string;
    dienstwaarde: number;
  } | null;
}

/**
 * Kopieer employee_services naar roster_employee_services voor specifieke medewerkers
 * Dit maakt een SNAPSHOT die onafhankelijk is van toekomstige wijzigingen
 * 
 * @param rosterId - Het roster ID waarvoor de snapshot gemaakt wordt
 * @param employeeIds - Array van employee IDs die gekopieerd moeten worden
 * @returns Aantal gekopieerde records
 * 
 * Flow:
 * 1. Haal actieve services op voor alle medewerkers in de lijst
 * 2. Filter alleen records waar actief = true
 * 3. Insert batch in roster_employee_services
 * 4. Return aantal records
 */
export async function copyEmployeeServicesToRoster(
  rosterId: string,
  employeeIds: string[]
): Promise<number> {
  console.log('🔄 [copyEmployeeServicesToRoster] Start:', {
    rosterId,
    employeeCount: employeeIds.length,
    timestamp: new Date().toISOString()
  });

  if (!rosterId || employeeIds.length === 0) {
    console.warn('⚠️ [copyEmployeeServicesToRoster] Geen roster ID of medewerkers opgegeven');
    return 0;
  }

  try {
    // Stap 1: Haal alle actieve employee_services op voor deze medewerkers
    const { data: employeeServices, error: fetchError } = await supabase
      .from('employee_services')
      .select('employee_id, service_id, actief, aantal')
      .in('employee_id', employeeIds)
      .eq('actief', true); // Alleen actieve services kopiëren

    if (fetchError) {
      console.error('❌ [copyEmployeeServicesToRoster] Fout bij ophalen employee_services:', fetchError);
      throw fetchError;
    }

    if (!employeeServices || employeeServices.length === 0) {
      console.log('ℹ️ [copyEmployeeServicesToRoster] Geen actieve services gevonden voor deze medewerkers');
      return 0;
    }

    console.log(`✅ [copyEmployeeServicesToRoster] ${employeeServices.length} actieve services gevonden`);

    // Stap 2: Transformeer naar roster_employee_services format
    const rosterServices = employeeServices.map(es => ({
      roster_id: rosterId,
      employee_id: es.employee_id,
      service_id: es.service_id,
      actief: es.actief, // Database column naam
      aantal: es.aantal
    }));

    // Stap 3: Batch insert in roster_employee_services
    const { data: insertedData, error: insertError } = await supabase
      .from('roster_employee_services')
      .insert(rosterServices)
      .select('id');

    if (insertError) {
      console.error('❌ [copyEmployeeServicesToRoster] Fout bij insert:', insertError);
      throw insertError;
    }

    const insertedCount = insertedData?.length || 0;

    console.log('✅ [copyEmployeeServicesToRoster] Succesvol afgerond:', {
      rosterId,
      insertedRecords: insertedCount,
      uniqueEmployees: new Set(rosterServices.map(r => r.employee_id)).size,
      uniqueServices: new Set(rosterServices.map(r => r.service_id)).size
    });

    return insertedCount;

  } catch (error) {
    console.error('❌ [copyEmployeeServicesToRoster] Onverwachte fout:', error);
    throw error;
  }
}

/**
 * Haal alle roster employee services op voor een specifiek rooster
 * Inclusief service type informatie via JOIN
 * 
 * @param rosterId - Het roster ID
 * @returns Array van roster employee services met service type details
 */
export async function getRosterEmployeeServices(
  rosterId: string
): Promise<RosterEmployeeServiceWithType[]> {
  console.log('🔄 [getRosterEmployeeServices] Ophalen voor roster:', rosterId);

  try {
    const { data, error } = await supabase
      .from('roster_employee_services')
      .select(`
        *,
        service_types (
          code,
          naam,
          kleur,
          dienstwaarde
        )
      `)
      .eq('roster_id', rosterId)
      .eq('actief', true) // Database column naam
      .order('employee_id', { ascending: true });

    if (error) {
      console.error('❌ [getRosterEmployeeServices] Supabase error:', error);
      throw error;
    }

    console.log(`✅ [getRosterEmployeeServices] ${data?.length || 0} records gevonden`);
    return (data || []) as RosterEmployeeServiceWithType[];

  } catch (error) {
    console.error('❌ [getRosterEmployeeServices] Fout:', error);
    throw error;
  }
}

/**
 * Haal roster employee services op voor een specifieke medewerker in een rooster
 * 
 * @param rosterId - Het roster ID
 * @param employeeId - De employee ID
 * @returns Array van services die deze medewerker kan uitvoeren in dit rooster
 */
export async function getRosterEmployeeServicesByEmployee(
  rosterId: string,
  employeeId: string
): Promise<RosterEmployeeServiceWithType[]> {
  console.log('🔄 [getRosterEmployeeServicesByEmployee] Ophalen:', {
    rosterId,
    employeeId
  });

  try {
    const { data, error } = await supabase
      .from('roster_employee_services')
      .select(`
        *,
        service_types (
          code,
          naam,
          kleur,
          dienstwaarde
        )
      `)
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('actief', true) // Database column naam
      .order('service_id', { ascending: true });

    if (error) {
      console.error('❌ [getRosterEmployeeServicesByEmployee] Supabase error:', error);
      throw error;
    }

    console.log(`✅ [getRosterEmployeeServicesByEmployee] ${data?.length || 0} services gevonden`);
    return (data || []) as RosterEmployeeServiceWithType[];

  } catch (error) {
    console.error('❌ [getRosterEmployeeServicesByEmployee] Fout:', error);
    throw error;
  }
}

/**
 * Check of een medewerker een specifieke service kan uitvoeren in een rooster
 * 
 * @param rosterId - Het roster ID
 * @param employeeId - De employee ID
 * @param serviceCode - De service code (bijv. "D", "N", "L")
 * @returns true als de medewerker deze service kan uitvoeren, false anders
 */
export async function canEmployeePerformService(
  rosterId: string,
  employeeId: string,
  serviceCode: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('roster_employee_services')
      .select(`
        id,
        service_types!inner (
          code
        )
      `)
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('actief', true) // Database column naam
      .eq('service_types.code', serviceCode)
      .maybeSingle();

    if (error) {
      console.error('❌ [canEmployeePerformService] Supabase error:', error);
      return false;
    }

    return !!data;

  } catch (error) {
    console.error('❌ [canEmployeePerformService] Fout:', error);
    return false;
  }
}

/**
 * Haal statistics op voor roster employee services
 * Handig voor debugging en overzichten
 * 
 * @param rosterId - Het roster ID
 * @returns Object met statistieken
 */
export async function getRosterEmployeeServicesStats(
  rosterId: string
): Promise<{
  totalRecords: number;
  uniqueEmployees: number;
  uniqueServices: number;
  averageServicesPerEmployee: number;
}> {
  try {
    const services = await getRosterEmployeeServices(rosterId);
    
    const uniqueEmployees = new Set(services.map(s => s.employee_id)).size;
    const uniqueServices = new Set(services.map(s => s.service_id)).size;
    const averageServicesPerEmployee = uniqueEmployees > 0 
      ? Math.round((services.length / uniqueEmployees) * 10) / 10 
      : 0;

    return {
      totalRecords: services.length,
      uniqueEmployees,
      uniqueServices,
      averageServicesPerEmployee
    };

  } catch (error) {
    console.error('❌ [getRosterEmployeeServicesStats] Fout:', error);
    return {
      totalRecords: 0,
      uniqueEmployees: 0,
      uniqueServices: 0,
      averageServicesPerEmployee: 0
    };
  }
}
