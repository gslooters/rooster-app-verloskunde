// lib/services/service-types-loader.ts
// ============================================================================
// SERVICE TYPES LOADER - DRAAD27E
// ============================================================================
// Datum: 2025-11-14
// 
// Features:
// - Database-driven service type loading met kleuren
// - In-memory caching voor performance
// - Color utilities voor leesbaarheid (contrast, darkening)
// - Fallback logica voor onbekende diensten
// ============================================================================

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceTypeWithColor {
  id: string;
  code: string;
  naam: string;
  kleur: string; // hex color voor achtergrond
  dienstwaarde: number;
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

let serviceTypesCache: ServiceTypeWithColor[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuten

// ============================================================================
// DATABASE FUNCTIES
// ============================================================================

/**
 * Laad alle actieve service types uit database
 * Gebruikt in-memory cache voor performance
 * 
 * @returns Array van ServiceTypeWithColor objecten
 */
export async function loadServiceTypes(): Promise<ServiceTypeWithColor[]> {
  const now = Date.now();
  
  // Return cached data als nog geldig
  if (serviceTypesCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('✅ Using cached service types');
    return serviceTypesCache;
  }
  
  try {
    console.log('🔄 Loading service types from database...');
    
    const { data, error } = await supabase
      .from('service_types')
      .select('id, code, naam, kleur, dienstwaarde')
      .eq('actief', true)
      .order('code', { ascending: true });
    
    if (error) {
      console.error('❌ Error loading service types:', error);
      
      // Fallback naar oude cache als beschikbaar
      if (serviceTypesCache) {
        console.warn('⚠️ Using stale cache due to error');
        return serviceTypesCache;
      }
      
      throw error;
    }
    
    // Map naar ServiceTypeWithColor interface
    const serviceTypes: ServiceTypeWithColor[] = (data || []).map(row => ({
      id: row.id,
      code: row.code,
      naam: row.naam,
      kleur: row.kleur || '#10B981', // Default groen
      dienstwaarde: row.dienstwaarde ?? 1
    }));
    
    // Update cache
    serviceTypesCache = serviceTypes;
    cacheTimestamp = now;
    
    console.log(`✅ Loaded ${serviceTypes.length} service types from database`);
    
    return serviceTypes;
  } catch (error) {
    console.error('❌ Failed to load service types:', error);
    
    // Return lege array als fallback
    return [];
  }
}

/**
 * Haal specifieke service type op via code
 * Gebruikt cached data voor snelheid
 * 
 * @param code - Service code (bijv. 'MPS', 'AVD', 'NB')
 * @returns ServiceTypeWithColor of null als niet gevonden
 */
export async function getServiceTypeByCode(code: string): Promise<ServiceTypeWithColor | null> {
  const serviceTypes = await loadServiceTypes();
  
  const found = serviceTypes.find(st => st.code === code);
  
  if (!found) {
    console.warn(`⚠️ Service type niet gevonden: ${code}`);
    return null;
  }
  
  return found;
}

/**
 * Haal service type op met fallback naar default
 * Gebruikt voor rendering waar altijd een kleur nodig is
 * 
 * @param code - Service code
 * @returns ServiceTypeWithColor met fallback naar grijs
 */
export async function getServiceTypeOrDefault(code: string): Promise<ServiceTypeWithColor> {
  const serviceType = await getServiceTypeByCode(code);
  
  if (serviceType) {
    return serviceType;
  }
  
  // Fallback voor onbekende diensten
  return {
    id: 'unknown',
    code: code,
    naam: code,
    kleur: '#94a3b8', // Slate gray
    dienstwaarde: 0
  };
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Bereken contrast kleur (wit of zwart) voor leesbaarheid
 * Gebruikt relative luminance volgens WCAG guidelines
 * 
 * @param hexColor - Hex kleur string (bijv. '#10B981')
 * @returns '#FFFFFF' (wit) of '#000000' (zwart)
 */
export function getContrastColor(hexColor: string): string {
  // Verwijder # als aanwezig
  const hex = hexColor.replace('#', '');
  
  // Parse RGB waarden
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Bereken relative luminance
  const luminance = (channel: number) => {
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  
  const L = 0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);
  
  // Return wit voor donkere achtergronden, zwart voor lichte
  return L > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Maak kleur donkerder voor border
 * Gebruikt HSL conversie voor consistent resultaat
 * 
 * @param hexColor - Hex kleur string
 * @param percent - Percentage donkerder (0-100, default 20)
 * @returns Donkerdere hex kleur
 */
export function darkenColor(hexColor: string, percent: number = 20): string {
  // Verwijder # als aanwezig
  const hex = hexColor.replace('#', '');
  
  // Parse RGB waarden
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Verminder elke component met percentage
  const factor = 1 - (percent / 100);
  r = Math.round(r * factor);
  g = Math.round(g * factor);
  b = Math.round(b * factor);
  
  // Zorg ervoor dat waarden binnen 0-255 blijven
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  
  // Convert terug naar hex
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Invalidate cache (voor gebruik na database updates)
 */
export function clearServiceTypesCache(): void {
  serviceTypesCache = null;
  cacheTimestamp = 0;
  console.log('🗑️ Service types cache cleared');
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  loadServiceTypes as default
};