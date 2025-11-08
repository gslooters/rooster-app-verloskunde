// lib/services/diensten-storage.ts
// ============================================================================
// SUPABASE VOLLEDIGE INTEGRATIE - Diensten Beheer
// ============================================================================
// Sprint: Diensten Cloud Opslag v1.0
// Datum: 2025-11-08
// 
// Features:
// - ✅ Volledige CRUD via Supabase
// - ✅ Realtime subscriptions voor live updates
// - ✅ Systeemdiensten bescherming (NB, ===)
// - ✅ Referential integrity checks
// - ✅ Health check en fallback strategie
// - ✅ Cache voor read-only bij storing
// ============================================================================

import { Dienst, validateDienstwaarde, calculateDuration } from "../types/dienst";
import { supabase } from '../supabase';

// ============================================================================
// CONFIGURATIE & CONSTANTEN
// ============================================================================

const CACHE_KEY = "diensten_cache";
const HEALTH_CHECK_KEY = "supabase_health_diensten";
const HEALTH_CHECK_INTERVAL = 60000; // 1 minuut

// Systeemdiensten die altijd aanwezig moeten zijn
const SYSTEM_CODES = ['NB', '==='];

// ============================================================================
// SUPABASE HEALTH CHECK
// ============================================================================

let isSupabaseHealthy = true;
let lastHealthCheck = 0;

async function checkSupabaseHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Cache health check voor 1 minuut
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return isSupabaseHealthy;
  }
  
  try {
    const { error } = await supabase
      .from('service_types')
      .select('id')
      .limit(1);
    
    isSupabaseHealthy = !error;
    lastHealthCheck = now;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(HEALTH_CHECK_KEY, JSON.stringify({
        healthy: isSupabaseHealthy,
        timestamp: now
      }));
    }
    
    return isSupabaseHealthy;
  } catch (error) {
    console.error('❌ Supabase health check failed:', error);
    isSupabaseHealthy = false;
    lastHealthCheck = now;
    return false;
  }
}

export function getSupabaseHealthStatus(): { healthy: boolean; message: string } {
  if (isSupabaseHealthy) {
    return { 
      healthy: true, 
      message: '✅ Verbonden met database' 
    };
  }
  return { 
    healthy: false, 
    message: '⚠️ Database niet bereikbaar. Alleen-lezen modus actief.' 
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function getCachedServices(): Dienst[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const cached = JSON.parse(raw);
    return cached.data as Dienst[];
  } catch {
    return null;
  }
}

function setCachedServices(services: Dienst[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: services,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('⚠️ Failed to cache services:', error);
  }
}

// ============================================================================
// DATABASE MAPPING FUNCTIES
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
    system: row.system ?? false,
    actief: row.actief ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    planregels: row.planregels || ''
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
    system: dienst.system,
    actief: dienst.actief,
    planregels: dienst.planregels || ''
  };
  
  if (dienst.id) data.id = dienst.id;
  if (dienst.created_at) data.created_at = dienst.created_at;
  if (dienst.updated_at) data.updated_at = dienst.updated_at;
  
  return data;
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

let realtimeChannel: any = null;

export function subscribeToServiceChanges(callback: (services: Dienst[]) => void): () => void {
  console.log('📡 Starting realtime subscription for service_types...');
  
  realtimeChannel = supabase
    .channel('service_types_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_types' },
      async (payload) => {
        console.log('🔄 Service changed:', payload);
        
        // Haal alle diensten opnieuw op en roep callback aan
        const services = await getAllServices();
        callback(services);
        
        // Trigger custom event voor andere componenten
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('services-updated', { 
            detail: { payload, services } 
          }));
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });
  
  // Return unsubscribe function
  return () => {
    console.log('📡 Unsubscribing from service_types changes...');
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

// ============================================================================
// CRUD OPERATIES
// ============================================================================

export async function getAllServices(): Promise<Dienst[]> {
  const healthy = await checkSupabaseHealth();
  
  if (!healthy) {
    console.warn('⚠️ Supabase niet bereikbaar, gebruik cached data');
    const cached = getCachedServices();
    if (cached) {
      return cached;
    }
    throw new Error('Database niet bereikbaar en geen cached data beschikbaar');
  }
  
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .order('code', { ascending: true });
    
    if (error) throw error;
    
    const services = (data || []).map(fromDatabase);
    
    // Cache resultaat
    setCachedServices(services);
    
    return services;
  } catch (error) {
    console.error('❌ Error loading services:', error);
    
    // Fallback naar cache
    const cached = getCachedServices();
    if (cached) {
      console.warn('⚠️ Using cached services due to error');
      return cached;
    }
    
    throw error;
  }
}

export async function createService(
  data: Omit<Dienst, 'id'|'created_at'|'updated_at'|'system'|'duur'> & { id?: string; system?: boolean }
): Promise<Dienst> {
  const healthy = await checkSupabaseHealth();
  
  if (!healthy) {
    throw new Error('⚠️ Database niet bereikbaar. Kan geen nieuwe dienst aanmaken.');
  }
  
  // Validaties
  if (!data.code || data.code.length < 1 || data.code.length > 4) {
    throw new Error('Code moet 1-4 tekens zijn');
  }
  
  if (!data.naam) {
    throw new Error('Naam is verplicht');
  }
  
  if (!validateDienstwaarde(data.dienstwaarde)) {
    throw new Error('Dienstwaarde moet tussen 0 en 6 liggen in stappen van 0,5');
  }
  
  // Check uniekheid
  const existing = await getAllServices();
  if (existing.some(d => d.code.toLowerCase() === data.code.toLowerCase())) {
    throw new Error('Code moet uniek zijn');
  }
  
  // Bereken duur
  const duur = calculateDuration(data.begintijd, data.eindtijd);
  
  const now = new Date().toISOString();
  const id = data.id ?? data.code.toLowerCase();
  
  const newDienst: Dienst = {
    id,
    created_at: now,
    updated_at: now,
    system: false,
    duur,
    planregels: data.planregels || '',
    ...data
  } as Dienst;
  
  try {
    const { data: inserted, error } = await supabase
      .from('service_types')
      .insert([toDatabase(newDienst)])
      .select()
      .single();
    
    if (error) throw error;
    
    const result = fromDatabase(inserted);
    
    // Update cache
    const services = await getAllServices();
    setCachedServices(services);
    
    return result;
  } catch (error) {
    console.error('❌ Error creating service:', error);
    throw error;
  }
}

export async function updateService(id: string, patch: Partial<Dienst>): Promise<Dienst> {
  const healthy = await checkSupabaseHealth();
  
  if (!healthy) {
    throw new Error('⚠️ Database niet bereikbaar. Kan dienst niet bijwerken.');
  }
  
  try {
    // Haal huidige dienst op
    const { data: current, error: fetchError } = await supabase
      .from('service_types')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!current) throw new Error('Dienst niet gevonden');
    
    const currentDienst = fromDatabase(current);
    
    // Systeemdiensten kunnen alleen actief/inactief worden gezet
    if (currentDienst.system) {
      const allowed: Partial<Dienst> = { 
        actief: patch.actief ?? currentDienst.actief 
      };
      
      const { data: updated, error: updateError } = await supabase
        .from('service_types')
        .update({ 
          actief: allowed.actief,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      const result = fromDatabase(updated);
      
      // Update cache
      const services = await getAllServices();
      setCachedServices(services);
      
      return result;
    }
    
    // Reguliere diensten: valideer en update
    const next = { ...currentDienst, ...patch, updated_at: new Date().toISOString() };
    
    // Validaties
    if (next.code) {
      const existing = await getAllServices();
      if (existing.some(d => d.id !== id && d.code.toLowerCase() === next.code.toLowerCase())) {
        throw new Error('Code moet uniek zijn');
      }
    }
    
    if (next.dienstwaarde != null && !validateDienstwaarde(next.dienstwaarde)) {
      throw new Error('Dienstwaarde moet tussen 0 en 6 liggen in stappen van 0,5');
    }
    
    // Bereken duur opnieuw als tijden zijn gewijzigd
    if (patch.begintijd || patch.eindtijd) {
      next.duur = calculateDuration(next.begintijd, next.eindtijd);
    }
    
    const { data: updated, error: updateError } = await supabase
      .from('service_types')
      .update(toDatabase(next))
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    const result = fromDatabase(updated);
    
    // Update cache
    const services = await getAllServices();
    setCachedServices(services);
    
    return result;
  } catch (error) {
    console.error('❌ Error updating service:', error);
    throw error;
  }
}

// ============================================================================
// REFERENTIAL INTEGRITY CHECKS
// ============================================================================

async function isServiceUsedInSchedules(serviceCode: string): Promise<boolean> {
  try {
    // Check of dienst gebruikt wordt in schedules tabel
    const { data, error } = await supabase
      .from('schedules')
      .select('id')
      .eq('service_type_code', serviceCode)
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking schedules:', error);
      return false;
    }
    
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking schedules:', error);
    return false;
  }
}

async function isServiceMappedToEmployees(serviceCode: string): Promise<boolean> {
  try {
    // Check of dienst gekoppeld is aan medewerkers
    // Assumptie: employees hebben een array veld 'available_services'
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .contains('available_services', [serviceCode])
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking employees:', error);
      return false;
    }
    
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking employees:', error);
    return false;
  }
}

export async function canDeleteService(serviceCode: string): Promise<{ canDelete: boolean; reason?: string }> {
  // Check 1: Systeemdienst?
  if (SYSTEM_CODES.includes(serviceCode)) {
    return { 
      canDelete: false, 
      reason: 'Systeemdienst kan niet verwijderd worden' 
    };
  }
  
  // Check 2: Gebruikt in roosters?
  const usedInSchedules = await isServiceUsedInSchedules(serviceCode);
  if (usedInSchedules) {
    return { 
      canDelete: false, 
      reason: 'Dienst wordt gebruikt in actieve roosters' 
    };
  }
  
  // Check 3: Gekoppeld aan medewerkers?
  const mappedToEmployees = await isServiceMappedToEmployees(serviceCode);
  if (mappedToEmployees) {
    return { 
      canDelete: false, 
      reason: 'Dienst is gekoppeld aan medewerkers' 
    };
  }
  
  return { canDelete: true };
}

export async function removeService(serviceCode: string): Promise<void> {
  const healthy = await checkSupabaseHealth();
  
  if (!healthy) {
    throw new Error('⚠️ Database niet bereikbaar. Kan dienst niet verwijderen.');
  }
  
  const check = await canDeleteService(serviceCode);
  
  if (!check.canDelete) {
    throw new Error(`Kan deze dienst niet verwijderen. ${check.reason ?? ''}`.trim());
  }
  
  try {
    const { error } = await supabase
      .from('service_types')
      .delete()
      .eq('code', serviceCode);
    
    if (error) throw error;
    
    // Update cache
    const services = await getAllServices();
    setCachedServices(services);
    
    console.log('✅ Service deleted:', serviceCode);
  } catch (error) {
    console.error('❌ Error deleting service:', error);
    throw error;
  }
}

// ============================================================================
// LEGACY COMPATIBILITY (voor oude code die deze functies verwacht)
// ============================================================================

// Synchrone wrapper die cached data gebruikt (alleen voor backwards compatibility)
export function getAllServicesSync(): Dienst[] {
  const cached = getCachedServices();
  if (cached) return cached;
  
  // Als geen cache: trigger async load en return lege array
  getAllServices().then(services => {
    console.log('✅ Services loaded asynchronously');
  }).catch(error => {
    console.error('❌ Failed to load services:', error);
  });
  
  return [];
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export {
  checkSupabaseHealth,
  getCachedServices,
  SYSTEM_CODES
};