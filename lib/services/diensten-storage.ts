// lib/services/diensten-storage.ts
// ============================================================================
// DRAAD30B - Storage Layer Update: Team Regels en Blokkeert Volgdag
// ============================================================================
import { Dienst, validateDienstwaarde, calculateDuration } from "../types/dienst";
import { teamRegelsFromJSON, teamRegelsToJSON, DEFAULT_TEAM_REGELS } from '../validators/service';
import { supabase } from '../supabase';

// ============================================================================
// CONSTANTS & CACHE
// ============================================================================
const CACHE_KEY = "diensten_cache";
const HEALTH_CHECK_KEY = "supabase_health_diensten";
const HEALTH_CHECK_INTERVAL = 60000; // 1 minuut
const SYSTEM_CODES = ['NB', '==='];

// ============================================================================
// HEALTH CHECK
// ============================================================================
let lastHealthCheck = 0;
let lastHealthStatus = false;

/**
 * Check Supabase health voor diensten tabel
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached status als recent gecheck
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return lastHealthStatus;
  }
  
  try {
    const { error } = await supabase
      .from('service_types')
      .select('id')
      .limit(1);
    
    lastHealthStatus = !error;
    lastHealthCheck = now;
    
    if (error) {
      console.error('❌ Supabase health check failed:', error);
    }
    
    return lastHealthStatus;
  } catch (err) {
    console.error('❌ Supabase health check exception:', err);
    lastHealthStatus = false;
    lastHealthCheck = now;
    return false;
  }
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
    
    console.log(`✅ Loaded ${services.length} services from database`);
    
    return services;
  } catch (error) {
    console.error('❌ Failed to load services:', error);
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

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SYSTEM_CODES
};