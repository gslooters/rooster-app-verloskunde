/**
 * PrePlanning Storage Service
 * Data service layer voor PrePlanning scherm
 * Alle data wordt opgeslagen in Supabase roster_assignments tabel
 * 
 * DRAAD 77: Uitgebreid met dagdeel ondersteuning en status structuur
 * DRAAD 79: getServicesForEmployee updated om ServiceTypeWithTimes te returnen
 * DRAAD 82: service_code verwijderd uit updateAssignmentStatus (kolom bestaat niet meer)
 * DRAAD 83: Fix service_code mapping - JOIN returnt object, geen array
 * DRAAD 90: Added getServicesForEmployeeFiltered voor dagdeel/datum/status filtering
 * DRAAD 91: Fix TypeScript type error - type casting op regel 360
 * DRAAD 92: Fix status filtering - !== 'MAG_NIET' ipv === 'MAG', verwijder onjuist actief filter
 * DRAAD 99B: Verwijderd service blocking rules (constraints disabled)
 * HERSTEL: Service blocking rules ge-integreerd in getServicesForEmployee + getServicesForEmployeeFiltered
 * DRAAD 100B: FIX getEmployeeServiceCodes - resolve service_code via JOIN met service_types
 * DRAAD179-FASE3: FIXED - Replaced roster_period_staffing with roster_period_staffing_dagdelen
 * DRAAD352-FASE1: ✅ deletePrePlanningAssignment verwijderd - alle status=0 updates gaan via updateAssignmentStatus
 * DRAAD366: ✅ FIXED - Added source: 'manual' to track UI-initiated changes
 * DRAAD399-FASE2: ✅ QUERY - Select id, team uit roster_period_staffing_dagdelen
 * DRAAD399-FASE3: ✅ MAPPING - Add team_variant + variant_id aan services
 * DRAAD399-FASE6: ✅ STORAGE - Save roster_period_staffing_dagdelen_id naar database
 * DRAAD400-FASE1: ✅ FIX - Vervang .find() door .filter() voor ALLE team-varianten
 * DRAAD401-FASE2: ✅ FIX - updateAssignmentStatus() slaagt variantId op in database
 * DRAAD402-HOTFIX: ✅ FIX - Add service_id to returned ServiceTypeWithTimes objects
 * DRAAD404: ✅ IMPLEMENTATIE - New getServicesForEmployeeWithAllVariants() for admin mode
 * DRAAD370-FIX: ✅ KRITIEKE FIX - Correct database query in getServicesForEmployeeWithAllVariants()
 * 
 * Cache: 2026-01-11T15:23:00Z
 */

import { supabase } from '@/lib/supabase';
import { PrePlanningAssignment, EmployeeWithServices, CellStatus, Dagdeel, ServiceTypeWithTimes } from '@/lib/types/preplanning';
import { ServiceType } from '@/lib/types/service';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { 
  getServiceBlockingRules, 
  applyServiceBlocks 
} from '@/lib/services/service-blocking-rules';

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
 * DRAAD366: ✅ FIXED - Added source: 'manual' to track UI-initiated changes
 * DRAAD399-FASE6: ✅ Added roster_period_staffing_dagdelen_id parameter
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param serviceCode - Dienst code (bijv. 'NB', 'Echo', 'Besch')
 * @param dagdeel - Dagdeel (O/M/A) - default 'O'
 * @param variantId - UUID van roster_period_staffing_dagdelen record (optional)
 * @returns true bij succes, false bij fout
 */
export async function savePrePlanningAssignment(
  rosterId: string,
  employeeId: string,
  date: string,
  serviceCode: string,
  dagdeel: Dagdeel = 'O',
  variantId?: string | null
): Promise<boolean> {
  try {
    console.log('💾 Saving PrePlanning assignment:', { rosterId, employeeId, date, serviceCode, dagdeel, variantId });
    
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
        roster_period_staffing_dagdelen_id: variantId || null, // DRAAD399: Sla variant ID op
        source: 'manual',  // ✅ DRAAD366: Set source to 'manual' for all UI-initiated changes
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
 * DRAAD 99B: Service blocking rules verwijderd (constraints zijn disabled)
 * HERSTEL: Service blocking validatie weer toegevoegd
 * DRAAD352-FASE1: ✅ Nu ondersteunt status=0 via UPSERT (soft delete)
 * DRAAD366: ✅ FIXED - Added source: 'manual' to track UI-initiated changes
 * DRAAD399-FASE6: ✅ Added roster_period_staffing_dagdelen_id parameter
 * DRAAD401-FASE2: ✅ FIXED - updateAssignmentStatus() slaagt variantId op in database
 * 
 * Voor het wijzigen van cel status (leeg, dienst, geblokkeerd, NB)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @param status - Nieuwe status (0/1/2/3)
 * @param serviceId - UUID van service (alleen bij status 1)
 * @param rosterStartDate - Startdatum van rooster (voor periode validatie) - DEPRECATED
 * @param variantId - UUID van roster_period_staffing_dagdelen record (optional)
 * @returns Object met { success: boolean, warnings: string[] }
 */
export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null,
  rosterStartDate?: string,
  variantId?: string | null
): Promise<{ success: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  
  try {
    console.log('🔄 Updating assignment status:', { 
      rosterId, 
      employeeId, 
      date, 
      dagdeel, 
      status, 
      serviceId, 
      variantId  // ✅ DRAAD401: Log variantId
    });
    
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

    // Update/create assignment in database
    const { error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        dagdeel: dagdeel,
        status: status,
        service_id: serviceId,
        roster_period_staffing_dagdelen_id: variantId || null, // ✅ DRAAD401: Sla variant ID op
        source: 'manual',  // ✅ DRAAD366: Set source to 'manual' for all UI-initiated changes
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roster_id,employee_id,date,dagdeel'
      });

    if (error) {
      console.error('❌ Error updating assignment status:', error);
      return { success: false, warnings: [] };
    }

    console.log('✅ Assignment status updated (variant_id:', variantId, ')');
    
    return { success: true, warnings };
  } catch (error) {
    console.error('❌ Exception in updateAssignmentStatus:', error);
    return { success: false, warnings: [] };
  }
}

/**
 * DRAAD 79: Haal diensten op die een specifieke medewerker kan uitvoeren
 * Via employee_services koppeltabel
 * DRAAD402-HOTFIX: ✅ Add service_id to returned objects
 * HERSTEL: Service blocking rules integratie
 * 
 * BLOCKING LOGIC:
 * - Haal alle assignments van medewerker op (alle datums in roster)
 * - Verzamel toegewezen service IDs
 * - Pas service blocking rules toe
 * - Retourneer alleen diensten die NIET geblokkeerd zijn
 * 
 * @param employeeId - TEXT ID van de medewerker
 * @param rosterId - Optional: UUID van roster voor blocking check
 * @returns Array van ServiceTypeWithTimes objecten met simplified structure
 */
export async function getServicesForEmployee(
  employeeId: string,
  rosterId?: string
): Promise<ServiceTypeWithTimes[]> {
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
    // DRAAD402-HOTFIX: ✅ Add service_id to returned objects
    let services: ServiceTypeWithTimes[] = (data || [])
      .filter((item: any) => item.service_types && item.service_types.actief)
      .map((item: any) => ({
        id: item.service_types.id,                          // service_types.id (same as service_id)
        code: item.service_types.code,
        naam: item.service_types.naam,
        kleur: item.service_types.kleur || '#3B82F6',
        start_tijd: item.service_types.begintijd || '09:00',
        eind_tijd: item.service_types.eindtijd || '17:00',
        service_id: item.service_types.id,                  // ✅ ADD THIS - for type safety
        actief: true
      }));

    // HERSTEL: Service blocking filter
    if (rosterId) {
      try {
        // Haal alle assignments van deze medewerker in dit rooster
        const { data: assignments, error: assignError } = await supabase
          .from('roster_assignments')
          .select('service_id')
          .eq('roster_id', rosterId)
          .eq('employee_id', employeeId)
          .eq('status', 1) // Alleen dienst status
          .not('service_id', 'is', null);

        if (assignError) {
          console.error('[getServicesForEmployee] Error fetching assignments:', assignError);
        } else if (assignments && assignments.length > 0) {
          const assignedServiceIds = assignments.map(a => a.service_id).filter(Boolean) as string[];
          
          console.log(`[getServicesForEmployee] Found ${assignedServiceIds.length} assigned services, applying blocking rules`);
          
          // Pas service blocking toe
          const blockingRules = await getServiceBlockingRules();
          services = await applyServiceBlocks(services, assignedServiceIds, blockingRules);
        }
      } catch (blockError) {
        console.error('[getServicesForEmployee] Error applying service blocks:', blockError);
        // Continue zonder blocking (graceful degradation)
      }
    }

    console.log(`✅ Found ${services.length} active services for employee ${employeeId}`);
    return services;
  } catch (error) {
    console.error('❌ Exception in getServicesForEmployee:', error);
    return [];
  }
}

/**
 * DRAAD404: NIEUWE FUNCTIE - Haal ALLE team-varianten op voor admin modus
 * DRAAD370-FIX: ✅ KRITIEKE FIX - Correct database query
 * 
 * Retourneert ALLE mogelijke service×team combinaties voor admin modus.
 * Gebruik voor admin toggle om alle 27 entries (9 diensten × 3 teams) te tonen.
 * 
 * LOGIC:
 * 1. Haal basis services van medewerker op (via employee_services)
 * 2. Voor ELKE service: Query roster_period_staffing op datum/dagdeel
 * 3. SELECT dagdelen array en HANDMATIG expand voor target dagdeel
 * 4. Collect ALLE team-varianten (GRO, ORA, TOT) per service
 * 5. Voeg aparte entry toe per variant (team_variant + variant_id uniek)
 * 6. Result: 9 diensten × 3 teams = 27 entries met duidelijke team labels
 * 
 * DRAAD370-FIX:
 * - Query 'roster_period_staffing' (parent) ipv 'roster_period_staffing_dagdelen'
 * - Reden: dagdelen-variant table heeft geen directe service_id link
 * - roster_period_staffing: service_id → dagdelen array
 * - HANDMATIG: expand dagdelen voor target dagdeel + teams
 * 
 * Edge cases:
 * - Service ZONDER team-varianten → Fallback: service zonder team label
 * - Geen staffing records → Log warning, continue
 * - No services for employee → Return empty array
 * 
 * @param employeeId - TEXT ID van de medewerker
 * @param rosterId - UUID van het rooster
 * @param targetDate - Datum (YYYY-MM-DD) voor staffing lookup
 * @param targetDagdeel - Dagdeel (O/M/A) voor staffing lookup
 * @returns Array van ServiceTypeWithTimes met team_variant per entry (27 entries expected)
 */
export async function getServicesForEmployeeWithAllVariants(
  employeeId: string,
  rosterId: string,
  targetDate: string,
  targetDagdeel: Dagdeel
): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log(
      '[getServicesForEmployeeWithAllVariants] Loading all team variants for admin mode:',
      { employeeId, rosterId, targetDate, targetDagdeel }
    );
    
    // Stap 1: Haal basis services op (9 diensten)
    let baseServices = await getServicesForEmployee(employeeId, rosterId);
    
    if (baseServices.length === 0) {
      console.warn('[getServicesForEmployeeWithAllVariants] No base services found');
      return [];
    }
    
    console.log(`[getServicesForEmployeeWithAllVariants] Found ${baseServices.length} base services`);
    
    // Stap 2: Voor ELKE service - haal ALLE team-varianten op
    const servicesWithVariants: ServiceTypeWithTimes[] = [];
    
    for (const service of baseServices) {
      // ✅ DRAAD370-FIX: Query 'roster_period_staffing' (parent table)
      // Reden: roster_period_staffing_dagdelen heeft geen directe service_id link
      const { data: staffingData, error } = await supabase
        .from('roster_period_staffing')
        .select('id, dagdelen')  // ✅ Select id (parent) + dagdelen array
        .eq('roster_id', rosterId)
        .eq('service_id', service.service_id)  // ✅ Use service_id for lookup
        .eq('date', targetDate);
      
      if (error) {
        console.warn(
          `[getServicesForEmployeeWithAllVariants] Error querying variants for ${service.code}:`,
          error
        );
        continue;
      }
      
      if (!staffingData || staffingData.length === 0) {
        console.warn(
          `[getServicesForEmployeeWithAllVariants] No variants found for ${service.code} ` +
          `on ${targetDate} ${targetDagdeel} - service may not be configured`
        );
        // Fallback: Voeg service zonder team toe
        servicesWithVariants.push(service);
        continue;
      }
      
      // Stap 3: HANDMATIG expand dagdelen array voor target dagdeel
      for (const staffingRecord of staffingData) {
        // staffingRecord.dagdelen is array van { id, dagdeel, team, status, aantal }
        const dagdelenArray = staffingRecord.dagdelen as any[];
        
        if (!dagdelenArray || dagdelenArray.length === 0) {
          console.warn(
            `[getServicesForEmployeeWithAllVariants] No dagdelen in staffing record for ` +
            `${service.code} on ${targetDate}`
          );
          // Fallback service
          servicesWithVariants.push(service);
          continue;
        }
        
        // Filter op target dagdeel en voeg aparte entry toe per variant
        const targetDagdeelRecords = dagdelenArray.filter(
          (d: any) => d.dagdeel === targetDagdeel
        );
        
        for (const dagdeelRecord of targetDagdeelRecords) {
          servicesWithVariants.push({
            ...service,                      // ✅ Behoud alle velden van baseService
            id: dagdeelRecord.id,            // ⭐ Override: variant ID (dagdelen.id)
            team_variant: dagdeelRecord.team, // ⭐ Add: 'GRO'|'ORA'|'TOT'
            variant_id: dagdeelRecord.id     // ⭐ Add: UUID van dagdeel record
          });
        }
      }
    }
    
    console.log(
      `✅ Found ${servicesWithVariants.length} service variants ` +
      `(${baseServices.length} services × teams) for admin mode`
    );
    return servicesWithVariants;
  } catch (error) {
    console.error('[getServicesForEmployeeWithAllVariants] Exception:', error);
    // Graceful fallback: Return basis services
    return getServicesForEmployee(employeeId, rosterId);
  }
}

/**
 * DRAAD 90: Nieuwe functie - Gefilterde diensten ophalen
 * Haal diensten op die beschikbaar zijn voor specifieke medewerker op datum/dagdeel
 * Filtert op basis van roster_period_staffing_dagdelen status (NIET status='MAG_NIET')
 * DRAAD402-HOTFIX: ✅ Add service_id when building filtered services
 * HERSTEL: Service blocking rules integratie
 * 
 * DRAAD 91: Fix TypeScript type error - toegevoegd type casting as any[]
 * DRAAD 92: Fix status filtering - !== 'MAG_NIET' ipv === 'MAG', verwijder onjuist actief filter
 * DRAAD179-FASE3: FIXED - Replaced roster_period_staffing with roster_period_staffing_dagdelen
 * DRAAD399-FASE2,3: ✅ Select id, team from roster_period_staffing_dagdelen + map to team_variant + variant_id
 * DRAAD400-FASE1: ✅ FIX - Vervang .find() door .filter() voor ALLE team-varianten per service
 * 
 * Status waarden:
 * - 'MAG' = toegestaan (toon)
 * - 'MOET' = verplicht (toon)
 * - 'AANGEPAST' = aangepast (toon)
 * - 'MAG_NIET' = niet toegestaan (NIET tonen)
 * 
 * DRAAD400-FASE1 LOGICA:
 * - Voor ELKE service: haal ALLE staffing records op voor datum
 * - Voor ELKE record met dagdeel === target AND status !== 'MAG_NIET'
 * - Voeg aparte entry toe per variant (team + variant_id uniek)
 * - Result: service DIO krijgt 3 entries voor 3 teams
 * 
 * @param employeeId - TEXT ID van de medewerker
 * @param rosterId - UUID van het rooster (voor staffing check)
 * @param date - Datum (YYYY-MM-DD)
 * @param dagdeel - Dagdeel (O/M/A)
 * @returns Array van ServiceTypeWithTimes met ALLE team-varianten
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
    // DRAAD 92: FIX - Verwijder .eq('actief', true) - deze kolom bestaat niet in employee_services
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
      // Filter op service_types.actief gebeurt al in loop hieronder

    if (error) {
      console.error('❌ Error getting employee services:', error);
      return [];
    }

    // HERSTEL: Service blocking filter - VOOR staffing filter (efficiency)
    let baseServices: ServiceTypeWithTimes[] = (data || [])
      .filter((item: any) => item.service_types && item.service_types.actief)
      .map((item: any) => ({
        id: item.service_types.id,
        code: item.service_types.code,
        naam: item.service_types.naam,
        kleur: item.service_types.kleur || '#3B82F6',
        start_tijd: item.service_types.begintijd || '09:00',
        eind_tijd: item.service_types.eindtijd || '17:00',
        service_id: item.service_types.id,                  // ✅ DRAAD402: Add service_id
        actief: true
      }));

    // HERSTEL: Pas service blocking toe
    try {
      // Haal alle assignments van deze medewerker in dit rooster
      const { data: assignments, error: assignError } = await supabase
        .from('roster_assignments')
        .select('service_id')
        .eq('roster_id', rosterId)
        .eq('employee_id', employeeId)
        .eq('status', 1) // Alleen dienst status
        .not('service_id', 'is', null);

      if (assignError) {
        console.error('[getServicesForEmployeeFiltered] Error fetching assignments:', assignError);
      } else if (assignments && assignments.length > 0) {
        const assignedServiceIds = assignments.map(a => a.service_id).filter(Boolean) as string[];
        
        console.log(`[getServicesForEmployeeFiltered] Found ${assignedServiceIds.length} assigned services, applying blocking rules`);
        
        // Pas service blocking toe
        const blockingRules = await getServiceBlockingRules();
        baseServices = await applyServiceBlocks(baseServices, assignedServiceIds, blockingRules);
      }
    } catch (blockError) {
      console.error('[getServicesForEmployeeFiltered] Error applying service blocks:', blockError);
      // Continue zonder blocking (graceful degradation)
    }

    // Stap 2: Filter diensten op basis van staffing status - DRAAD400: ALLE variants per service
    const filteredServices: ServiceTypeWithTimes[] = [];
    
    for (const service of baseServices) {
      // Check staffing status voor deze dienst op datum/dagdeel
      // DRAAD179-FASE3: FIXED - Query direct uit roster_period_staffing_dagdelen (no parent join)
      // DRAAD399-FASE2: SELECT id, team uit roster_period_staffing_dagdelen
      const { data: staffingData, error: staffingError } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('id, dagdeel, status, team') // DRAAD399: Voeg id en team toe
        .eq('roster_id', rosterId)
        .eq('service_id', service.id)
        .eq('date', date);

      if (staffingError) {
        console.warn(
          `[getServicesForEmployeeFiltered] No staffing data for service ${service.code} ` +
          `on ${date} ${dagdeel}:`,
          staffingError
        );
        continue;
      }
      
      if (!staffingData || staffingData.length === 0) {
        console.warn(
          `[getServicesForEmployeeFiltered] No staffing record for service ${service.code} ` +
          `on ${date} dagdeel ${dagdeel} - service may not be configured for this date`
        );
        continue;
      }
      
      // DRAAD400-FASE1: FIX - Vervang .find() door .filter()
      // Haal ALLE variants op (niet alleen eerste) met correct dagdeel en status
      const dagdeelDataList = staffingData.filter(
        (d: any) => d.dagdeel === dagdeel && d.status !== 'MAG_NIET'
      );
      
      // Als geen variants beschikbaar, skip service
      if (dagdeelDataList.length === 0) continue;
      
      // DRAAD400-FASE1: Voor ELKE variant: aparte entry toevoegen
      // Dit zorgt dat service DIO + 3 teams = 3 entries in resultaat
      // DRAAD402-HOTFIX: ✅ Preserve service_id from baseServices
      for (const dagdeelData of dagdeelDataList) {
        filteredServices.push({
          ...service,                         // ✅ Includes service_id from baseServices
          id: dagdeelData.id,                 // ⭐ Override with variant ID (roster_period_staffing_dagdelen.id)
          team_variant: dagdeelData.team,     // 'GRO' | 'ORA' | 'TOT'
          variant_id: dagdeelData.id          // UUID van staffing record (uniek per variant)
        });
      }
    }
    
    console.log(
      `✅ Found ${filteredServices.length}/${baseServices.length} service variants ` +
      `for employee ${employeeId} on ${date} ${dagdeel} (after blocking + staffing filter + team expansion)`
    );
    return filteredServices;
  } catch (error) {
    console.error('❌ Exception in getServicesForEmployeeFiltered:', error);
    return [];
  }
}

/**
 * Haal alle dienst codes op die een medewerker kan uitvoeren
 * DRAAD 100B: FIX - resolve service_code via JOIN met service_types
 * employee_services tabel heeft GEEN service_code kolom
 * 
 * @param employeeId - TEXT ID van de medewerker
 * @returns Array van service codes
 */
export async function getEmployeeServiceCodes(employeeId: string): Promise<string[]> {
  try {
    console.log('🔍 Getting service codes for employee:', employeeId);
    
    // FIX DRAAD100B: JOIN met service_types om code op te halen
    const { data, error } = await supabase
      .from('employee_services')
      .select(`
        service_id,
        service_types (
          code
        )
      `)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('❌ Error getting employee service codes:', error);
      return [];
    }

    // FIX DRAAD100B: Extract codes uit JOIN resultaat
    const codes = (data || [])
      .filter((item: any) => item.service_types?.code)
      .map((item: any) => item.service_types.code);
    
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