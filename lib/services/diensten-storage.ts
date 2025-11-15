// lib/services/diensten-storage.ts
// ============================================================================
// DRAAD30D - FIX: Optimistische health check + robuste initialisatie
// ============================================================================
import { Dienst, validateDienstwaarde, calculateDuration } from "../types/dienst";
import { teamRegelsFromJSON, teamRegelsToJSON, DEFAULT_TEAM_REGELS } from '../validators/service';
import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

// Legacy type voor backward compatibility
export interface ServiceDayStaffing {
  service_id: string;
  ma_min: number;
  ma_max: number;
  di_min: number;
  di_max: number;
  wo_min: number;
  wo_max: number;
  do_min: number;
  do_max: number;
  vr_min: number;
  vr_max: number;
  za_min: number;
  za_max: number;
  zo_min: number;
  zo_max: number;
  tot_enabled: boolean;
  gro_enabled: boolean;
  ora_enabled: boolean;
}

// ============================================================================
// CONSTANTS & CACHE
// ============================================================================
const CACHE_KEY = "diensten_cache";
const HEALTH_CHECK_KEY = "supabase_health_diensten";
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconden (was 60s)
const SYSTEM_CODES = ['NB', '==='];

// ============================================================================
// HEALTH CHECK - DRAAD30D FIX
// ============================================================================
let lastHealthCheck = 0;
let lastHealthStatus = true; // ✅ Start OPTIMISTISCH (assume healthy)
let healthCheckInProgress = false;

/**
 * Check Supabase health voor diensten tabel
 * DRAAD30D: Robuustere health check met retry en optimistische fallback
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached status als recent gechecked EN niet in progress
  if (!healthCheckInProgress && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return lastHealthStatus;
  }
  
  // Prevent concurrent checks
  if (healthCheckInProgress) {
    return lastHealthStatus;
  }
  
  healthCheckInProgress = true;
  
  try {
    // Timeout van 5 seconden voor health check
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );
    
    const checkPromise = supabase
      .from('service_types')
      .select('id')
      .limit(1);
    
    const { error } = await Promise.race([checkPromise, timeoutPromise]);
    
    lastHealthStatus = !error;
    lastHealthCheck = now;
    
    if (error) {
      console.warn('⚠️ Supabase health check failed:', error.message);
    } else {
      console.log('✅ Supabase health check passed');
    }
    
    return lastHealthStatus;
  } catch (err: any) {
    console.warn('⚠️ Supabase health check exception:', err.message);
    // Bij timeout of network error: blijf optimistisch maar log warning
    // Alleen bij herhaalde failures zetten we status op false
    const timeSinceLastSuccess = now - lastHealthCheck;
    if (timeSinceLastSuccess > HEALTH_CHECK_INTERVAL * 3) {
      // Na 3 mislukte checks (90s): zet status op unhealthy
      lastHealthStatus = false;
    }
    lastHealthCheck = now;
    return lastHealthStatus;
  } finally {
    healthCheckInProgress = false;
  }
}

/**
 * Get health status with message (voor UI)
 * DRAAD30D: Optimistisch - assume healthy tenzij bewezen ongezond
 */
export function getSupabaseHealthStatus(): { healthy: boolean; message: string } {
  // Als we nog nooit gecheckt hebben: return optimistisch
  if (lastHealthCheck === 0) {
    return { 
      healthy: true, 
      message: 'Database verbinding controleren...' 
    };
  }
  
  const now = Date.now();
  const timeSinceCheck = now - lastHealthCheck;
  
  // Als laatste check lang geleden was: trigger async recheck
  if (timeSinceCheck > HEALTH_CHECK_INTERVAL) {
    // Trigger async check (non-blocking)
    checkSupabaseHealth().catch(err => 
      console.warn('Background health check failed:', err)
    );
  }
  
  if (lastHealthStatus) {
    return { healthy: true, message: 'Database verbinding actief' };
  }
  
  return { 
    healthy: false, 
    message: 'Geen database verbinding. Controleer je internetverbinding.' 
  };
}

// ============================================================================
// DATABASE MAPPING
// ============================================================================

function fromDatabase(row: any): Dienst {
  return {
    id: row.id,
    code: row.code,
    naam: row.naam,
    beschrijving: row.beschrijving || '',
    begintijd: row.begintijd || '08:00',
    eindtijd: row.eindtijd || '16:00',
    duur: row.duur ?? calculateDuration(row.begintijd || '08:00', row.eindtijd || '16:00'),
    kleur: row.kleur || '#10B981',
    dienstwaarde: row.dienstwaarde ?? 1,
    system: row.system ?? false, // DEPRECATED
    actief: row.actief ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    planregels: row.planregels || '',

    // ---- DRAAD30B: Nieuwe velden (graceful fallback op DEFAULTS) ----
    blokkeert_volgdag: typeof row.blokkeert_volgdag === 'boolean' ? row.blokkeert_volgdag : false,
    team_groen_regels: teamRegelsFromJSON(row.team_groen_regels),
    team_oranje_regels: teamRegelsFromJSON(row.team_oranje_regels),
    team_totaal_regels: teamRegelsFromJSON(row.team_totaal_regels)
  };
}

function toDatabase(dienst: Partial<Dienst>) {
  const data: any = {
    code: dienst.code,
    naam: dienst.naam,
    beschrijving: dienst.beschrijving,
    begintijd: dienst.begintijd,
    eindtijd: dienst.eindtijd,
    duur: dienst.duur,
    kleur: dienst.kleur,
    dienstwaarde: dienst.dienstwaarde,
    system: dienst.system, // DEPRECATED
    actief: dienst.actief,
    planregels: dienst.planregels || '',
    // ---- DRAAD30B: Nieuwe velden naar JSONB/boolean ----
    blokkeert_volgdag: typeof dienst.blokkeert_volgdag === 'boolean' ? dienst.blokkeert_volgdag : false,
    team_groen_regels: dienst.team_groen_regels ? teamRegelsToJSON(dienst.team_groen_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS),
    team_oranje_regels: dienst.team_oranje_regels ? teamRegelsToJSON(dienst.team_oranje_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS),
    team_totaal_regels: dienst.team_totaal_regels ? teamRegelsToJSON(dienst.team_totaal_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS)
  };
  if (dienst.id) data.id = dienst.id;
  if (dienst.created_at) data.created_at = dienst.created_at;
  if (dienst.updated_at) data.updated_at = dienst.updated_at;
  return data;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

let servicesCache: Dienst[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuten

/**
 * Get cached services als geldig
 */
export function getCachedServices(): Dienst[] | null {
  const now = Date.now();
  
  if (servicesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return servicesCache;
  }
  
  return null;
}

/**
 * Update cache
 */
function updateCache(services: Dienst[]): void {
  servicesCache = services;
  cacheTimestamp = Date.now();
}

/**
 * Clear cache
 */
export function clearServicesCache(): void {
  servicesCache = null;
  cacheTimestamp = 0;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all active services from database
 */
export async function getAllServices(): Promise<Dienst[]> {
  try {
    // Check cache eerst
    const cached = getCachedServices();
    if (cached) {
      console.log('✅ Using cached services');
      return cached;
    }
    
    console.log('🔄 Loading services from database...');
    
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('actief', true)
      .order('code', { ascending: true });
    
    if (error) {
      console.error('❌ Error loading services:', error);
      throw error;
    }
    
    const services = (data || []).map(fromDatabase);
    
    // Update cache
    updateCache(services);
    
    // Update health status bij succesvolle data fetch
    lastHealthStatus = true;
    lastHealthCheck = Date.now();
    
    console.log(`✅ Loaded ${services.length} services from database`);
    
    return services;
  } catch (error) {
    console.error('❌ Failed to load services:', error);
    // Update health status bij failure
    lastHealthStatus = false;
    lastHealthCheck = Date.now();
    throw error;
  }
}

/**
 * Get service by ID
 */
export async function getServiceById(id: string): Promise<Dienst | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data ? fromDatabase(data) : null;
  } catch (error) {
    console.error('❌ Failed to get service:', error);
    throw error;
  }
}

/**
 * Get service by code
 */
export async function getServiceByCode(code: string): Promise<Dienst | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data ? fromDatabase(data) : null;
  } catch (error) {
    console.error('❌ Failed to get service by code:', error);
    throw error;
  }
}

/**
 * Create new service
 */
export async function createService(dienst: Omit<Dienst, 'id' | 'created_at' | 'updated_at'>): Promise<Dienst> {
  try {
    // Validate
    if (!dienst.code || !dienst.naam) {
      throw new Error('Code en naam zijn verplicht');
    }
    
    const dbData = toDatabase(dienst);
    
    const { data, error } = await supabase
      .from('service_types')
      .insert(dbData)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Clear cache
    clearServicesCache();
    
    return fromDatabase(data);
  } catch (error) {
    console.error('❌ Failed to create service:', error);
    throw error;
  }
}

/**
 * Update existing service
 */
export async function updateService(id: string, updates: Partial<Dienst>): Promise<Dienst> {
  try {
    const dbData = toDatabase(updates);
    delete dbData.id;
    delete dbData.created_at;
    
    const { data, error } = await supabase
      .from('service_types')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Clear cache
    clearServicesCache();
    
    return fromDatabase(data);
  } catch (error) {
    console.error('❌ Failed to update service:', error);
    throw error;
  }
}

/**
 * Check if service can be deleted
 */
export async function canDeleteService(code: string): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    // System codes cannot be deleted
    if (SYSTEM_CODES.includes(code)) {
      return { 
        canDelete: false, 
        reason: 'Systeemdiensten kunnen niet verwijderd worden' 
      };
    }
    
    // Check if service is used in any roster assignments
    const { data: assignments, error } = await supabase
      .from('roster_assignments')
      .select('id')
      .eq('service_code', code)
      .limit(1);
    
    if (error) {
      console.error('❌ Error checking assignments:', error);
      return { 
        canDelete: false, 
        reason: 'Kon niet controleren of dienst in gebruik is' 
      };
    }
    
    if (assignments && assignments.length > 0) {
      return { 
        canDelete: false, 
        reason: 'Dienst is in gebruik in een of meer roosters' 
      };
    }
    
    return { canDelete: true };
  } catch (error) {
    console.error('❌ Failed to check if service can be deleted:', error);
    return { 
      canDelete: false, 
      reason: 'Fout bij controleren' 
    };
  }
}

/**
 * Delete service (soft delete by setting actief = false)
 */
export async function deleteService(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_types')
      .update({ actief: false })
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    // Clear cache
    clearServicesCache();
  } catch (error) {
    console.error('❌ Failed to delete service:', error);
    throw error;
  }
}

/**
 * Remove service (alias for deleteService for backward compatibility)
 */
export async function removeService(code: string): Promise<void> {
  try {
    const service = await getServiceByCode(code);
    if (!service) {
      throw new Error('Dienst niet gevonden');
    }
    await deleteService(service.id);
  } catch (error) {
    console.error('❌ Failed to remove service:', error);
    throw error;
  }
}

// ============================================================================
// LEGACY DAY STAFFING FUNCTIONS (DEPRECATED)
// ============================================================================

/**
 * @deprecated Deze functie is deprecated en wordt vervangen door team_regels
 * Get all services with day staffing data
 */
export async function getAllServicesDayStaffing(): Promise<ServiceDayStaffing[]> {
  console.warn('⚠️ getAllServicesDayStaffing is deprecated - gebruik team_regels in plaats daarvan');
  
  try {
    const services = await getAllServices();
    
    // Return mock data for backward compatibility
    return services.map(service => ({
      service_id: service.id,
      ma_min: 0, ma_max: 0,
      di_min: 0, di_max: 0,
      wo_min: 0, wo_max: 0,
      do_min: 0, do_max: 0,
      vr_min: 0, vr_max: 0,
      za_min: 0, za_max: 0,
      zo_min: 0, zo_max: 0,
      tot_enabled: true,
      gro_enabled: false,
      ora_enabled: false
    }));
  } catch (error) {
    console.error('❌ Failed to get day staffing:', error);
    return [];
  }
}

/**
 * @deprecated Deze functie is deprecated en wordt vervangen door team_regels
 * Update service day staffing and team
 */
export async function updateServiceDayStaffingAndTeam(
  serviceId: string,
  staffing: Partial<ServiceDayStaffing>,
  team: { tot_enabled: boolean; gro_enabled: boolean; ora_enabled: boolean }
): Promise<void> {
  console.warn('⚠️ updateServiceDayStaffingAndTeam is deprecated - gebruik team_regels in plaats daarvan');
  
  // This is a no-op for backward compatibility
  console.log('Legacy staffing update called but not executed:', { serviceId, staffing, team });
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to service changes
 */
export function subscribeToServices(callback: (services: Dienst[]) => void): () => void {
  const channel = supabase
    .channel('service_types_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_types'
      },
      async () => {
        // Clear cache and reload
        clearServicesCache();
        try {
          const services = await getAllServices();
          callback(services);
        } catch (error) {
          console.error('❌ Failed to reload services after change:', error);
        }
      }
    )
    .subscribe();
  
  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to service changes (alias voor backward compatibility)
 */
export function subscribeToServiceChanges(callback: (services: Dienst[]) => void): () => void {
  return subscribeToServices(callback);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SYSTEM_CODES
};