/**
 * Service Blocking Rules
 * 
 * Beheert blokkerende relaties tussen diensttypes.
 * Wanneer een dienst als "blocker" is gemarkeerd, kunnen bepaalde andere 
 * diensten niet meer aan dezelfde medewerker toegewezen worden.
 * 
 * Database: service_blocking_rules tabel
 * - blocker_service_id: De dienst die blokkeert
 * - blocked_service_id: De dienst die geblokkeerd wordt
 * - actief: Boolean of de regel actief is
 * 
 * Gebruik:
 * 1. getServiceBlockingRules() - Haal alle actieve blokkeringsregels op
 * 2. applyServiceBlocks() - Filter diensten lijst op basis van regels
 * 3. getBlockedServiceIds() - Quick lookup voor geblokkeerde dienst IDs
 * 4. isServiceBlockedBy() - Check specifieke blokkering
 * 
 * DRAAD 97E: Fix import error - @/lib/supabase/client → @/lib/supabase
 * DRAAD 100: Fix TypeScript build error - maak applyServiceBlocks generic
 * DRAAD 100.4: Fix TypeScript type error - cast Supabase nested relations
 */

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ServiceBlockingRule {
  id: string;
  blocker_service_id: string;
  blocked_service_id: string;
  actief: boolean;
  blocker_service?: {
    id: string;
    code: string;
    naam: string;
    kleur: string;
  };
  blocked_service?: {
    id: string;
    code: string;
    naam: string;
    kleur: string;
  };
}

export interface ServiceType {
  id: string;
  code: string;
  naam: string;
  omschrijving?: string;
  kleur: string;
  actief: boolean;
}

/**
 * DRAAD 100: Generic interface voor service blocking
 * Accepteert elk type met minimaal een 'id' property
 */
export interface ServiceWithId {
  id: string;
  [key: string]: any; // Allow additional properties
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

/**
 * Haal alle actieve blokkerings regels op uit de database
 * Inclusief metadata van blocker en blocked services
 * 
 * DRAAD 100.4: Supabase retourneert arrays voor foreign key relations.
 * We moeten expliciete type casting doen na de query.
 * 
 * @returns Array van actieve service blocking rules
 */
export async function getServiceBlockingRules(): Promise<ServiceBlockingRule[]> {
  try {
    const { data, error } = await supabase
      .from('service_blocking_rules')
      .select(`
        id,
        blocker_service_id,
        blocked_service_id,
        actief,
        blocker_service:service_types!blocker_service_id(
          id,
          code,
          naam,
          kleur
        ),
        blocked_service:service_types!blocked_service_id(
          id,
          code,
          naam,
          kleur
        )
      `)
      .eq('actief', true);

    if (error) {
      console.error('[service-blocking-rules] Database error:', error);
      throw new Error(`Failed to fetch service blocking rules: ${error.message}`);
    }

    // DRAAD 100.4: Supabase returns arrays, maar we willen objecten
    // Cast naar correct formaat
    const mappedData = (data || []).map(rule => ({
      id: rule.id,
      blocker_service_id: rule.blocker_service_id,
      blocked_service_id: rule.blocked_service_id,
      actief: rule.actief,
      blocker_service: Array.isArray(rule.blocker_service) 
        ? rule.blocker_service[0] 
        : rule.blocker_service,
      blocked_service: Array.isArray(rule.blocked_service)
        ? rule.blocked_service[0]
        : rule.blocked_service
    })) as ServiceBlockingRule[];

    return mappedData;
  } catch (error) {
    console.error('[service-blocking-rules] Unexpected error:', error);
    return []; // Graceful degradation: geen blocking als query faalt
  }
}

/**
 * Haal alle geblokkeerde service IDs op voor een gegeven blocker service
 * 
 * @param blockerServiceId - ID van de blokkerende dienst
 * @param rules - Optioneel: vooraf opgehaalde regels (voor performance)
 * @returns Set van geblokkeerde service IDs
 */
export async function getBlockedServiceIds(
  blockerServiceId: string,
  rules?: ServiceBlockingRule[]
): Promise<Set<string>> {
  const blockingRules = rules || await getServiceBlockingRules();
  
  const blockedIds = blockingRules
    .filter(rule => rule.blocker_service_id === blockerServiceId)
    .map(rule => rule.blocked_service_id);
  
  return new Set(blockedIds);
}

/**
 * Check of een specifieke service geblokkeerd wordt door een andere
 * 
 * @param blockerServiceId - ID van de blokkerende dienst
 * @param blockedServiceId - ID van de dienst om te checken
 * @param rules - Optioneel: vooraf opgehaalde regels
 * @returns true als service geblokkeerd is
 */
export async function isServiceBlockedBy(
  blockerServiceId: string,
  blockedServiceId: string,
  rules?: ServiceBlockingRule[]
): Promise<boolean> {
  const blockedIds = await getBlockedServiceIds(blockerServiceId, rules);
  return blockedIds.has(blockedServiceId);
}

// ============================================================================
// FILTERING LOGIC
// ============================================================================

/**
 * DRAAD 100: Generic versie van applyServiceBlocks
 * Filter een lijst van services door blokkerings regels toe te passen
 * 
 * Accepteert elk type met minimaal een 'id' property.
 * Werkt nu met zowel ServiceType als ServiceTypeWithTimes.
 * 
 * Scenario:
 * - Medewerker heeft dienst A toegewezen (blocker)
 * - Dienst B is geblokkeerd door dienst A
 * - Return: services zonder dienst B
 * 
 * @param services - Alle beschikbare services (met minimaal 'id' property)
 * @param assignedServiceIds - Services al toegewezen aan medewerker
 * @param rules - Optioneel: vooraf opgehaalde regels
 * @returns Gefilterde lijst van toegestane services
 */
export async function applyServiceBlocks<T extends ServiceWithId>(
  services: T[],
  assignedServiceIds: string[],
  rules?: ServiceBlockingRule[]
): Promise<T[]> {
  // Early return als geen assigned services
  if (assignedServiceIds.length === 0) {
    return services;
  }

  const blockingRules = rules || await getServiceBlockingRules();
  
  // Verzamel alle geblokkeerde service IDs op basis van assigned services
  const blockedServiceIds = new Set<string>();
  
  for (const assignedId of assignedServiceIds) {
    const blocked = await getBlockedServiceIds(assignedId, blockingRules);
    blocked.forEach(id => blockedServiceIds.add(id));
  }

  // Filter services: verwijder geblokkeerde services
  const filteredServices = services.filter(
    service => !blockedServiceIds.has(service.id)
  );

  console.log('[service-blocking-rules] Applied blocks:', {
    totalServices: services.length,
    assignedServices: assignedServiceIds.length,
    blockedServices: blockedServiceIds.size,
    remainingServices: filteredServices.length
  });

  return filteredServices;
}

/**
 * Helper: Krijg service details voor een lijst IDs
 * Gebruikt voor UI weergave van blokkerings informatie
 * 
 * @param serviceIds - Array van service IDs
 * @returns Array van ServiceType objecten
 */
export async function getServicesByIds(serviceIds: string[]): Promise<ServiceType[]> {
  if (serviceIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, code, naam, omschrijving, kleur, actief')
      .in('id', serviceIds)
      .eq('actief', true);

    if (error) {
      console.error('[service-blocking-rules] Error fetching services:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[service-blocking-rules] Unexpected error:', error);
    return [];
  }
}

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

/**
 * Valideer of een service assignment toegestaan is
 * 
 * @param employeeId - ID van medewerker
 * @param newServiceId - ID van nieuwe service om toe te wijzen
 * @param existingAssignments - Bestaande diensten van medewerker
 * @param rules - Optioneel: vooraf opgehaalde regels
 * @returns Object met allowed boolean en optionele reason
 */
export async function validateServiceAssignment(
  employeeId: string,
  newServiceId: string,
  existingAssignments: string[],
  rules?: ServiceBlockingRule[]
): Promise<{ allowed: boolean; reason?: string; blockedBy?: string[] }> {
  const blockingRules = rules || await getServiceBlockingRules();
  
  // Check: wordt nieuwe service geblokkeerd door bestaande assignments?
  const blockedBy: string[] = [];
  
  for (const existingId of existingAssignments) {
    const isBlocked = await isServiceBlockedBy(existingId, newServiceId, blockingRules);
    if (isBlocked) {
      blockedBy.push(existingId);
    }
  }

  if (blockedBy.length > 0) {
    // Haal service details op voor error message
    const blockerServices = await getServicesByIds(blockedBy);
    const blockerNames = blockerServices.map(s => s.naam).join(', ');
    
    return {
      allowed: false,
      reason: `Dienst geblokkeerd door: ${blockerNames}`,
      blockedBy
    };
  }

  // Check: blokkeert nieuwe service bestaande assignments?
  const wouldBlock: string[] = [];
  
  for (const existingId of existingAssignments) {
    const wouldBeBlocked = await isServiceBlockedBy(newServiceId, existingId, blockingRules);
    if (wouldBeBlocked) {
      wouldBlock.push(existingId);
    }
  }

  if (wouldBlock.length > 0) {
    const blockedServices = await getServicesByIds(wouldBlock);
    const blockedNames = blockedServices.map(s => s.naam).join(', ');
    
    return {
      allowed: false,
      reason: `Zou blokkeren: ${blockedNames}`,
      blockedBy: wouldBlock
    };
  }

  return { allowed: true };
}

/**
 * Krijg een overzicht van alle blokkerings relaties voor rapportage
 * 
 * @returns Gegroepeerde blokkerings informatie
 */
export async function getBlockingSummary(): Promise<{
  totalRules: number;
  activeRules: number;
  blockerServices: Map<string, string[]>; // blocker ID -> blocked IDs
  mostRestrictive: { serviceId: string; blocksCount: number }[];
}> {
  const rules = await getServiceBlockingRules();
  
  const blockerServices = new Map<string, string[]>();
  
  for (const rule of rules) {
    const existing = blockerServices.get(rule.blocker_service_id) || [];
    existing.push(rule.blocked_service_id);
    blockerServices.set(rule.blocker_service_id, existing);
  }

  // Sorteer blockers op aantal geblokkeerde services
  const mostRestrictive = Array.from(blockerServices.entries())
    .map(([serviceId, blocked]) => ({
      serviceId,
      blocksCount: blocked.length
    }))
    .sort((a, b) => b.blocksCount - a.blocksCount);

  return {
    totalRules: rules.length,
    activeRules: rules.filter(r => r.actief).length,
    blockerServices,
    mostRestrictive
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getServiceBlockingRules,
  getBlockedServiceIds,
  isServiceBlockedBy,
  applyServiceBlocks,
  getServicesByIds,
  validateServiceAssignment,
  getBlockingSummary
};