// lib/services/service-types-storage.ts
// ============================================================================
// SERVICE TYPES LOOKUP - DRAAD26K
// ============================================================================
// Datum: 2025-11-12
// 
// Features:
// - Service type lookup via code
// - NB service validation
// - Support voor dienstwaarde ophalen
// ============================================================================

import { supabase } from '@/lib/supabase';

export interface ServiceType {
  id: string;
  code: string;
  naam: string;
  dienstwaarde: number;
}

/**
 * Haal service type op via code
 * Gebruikt voor NB toggle om dienstwaarde te valideren
 * 
 * @param code - Service code (bijv. 'NB', 'MPS', '===')
 * @returns ServiceType object of null als niet gevonden
 */
export async function getServiceTypeByCode(code: string): Promise<ServiceType | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, code, naam, dienstwaarde')
      .eq('code', code)
      .single();
    
    if (error) {
      console.error('❌ Fout bij ophalen service type:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ Fout bij service type lookup:', error);
    return null;
  }
}

/**
 * Controleer of NB service type bestaat (voor veiligheid)
 * Valideert ook of dienstwaarde correct is (moet 0.0 zijn)
 * 
 * @returns true als NB service correct is geconfigureerd
 */
export async function validateNBServiceExists(): Promise<boolean> {
  const nbService = await getServiceTypeByCode('NB');
  
  if (!nbService) {
    console.error('❌ CRITICAL: NB service type niet gevonden in database!');
    return false;
  }
  
  if (nbService.dienstwaarde !== 0.0) {
    console.warn(`⚠️ WARNING: NB dienstwaarde is ${nbService.dienstwaarde}, verwacht 0.0`);
  }
  
  console.log('✅ NB service type validated:', nbService);
  return true;
}

/**
 * Haal alle actieve service types op
 * 
 * @returns Array van ServiceType objecten
 */
export async function getAllServiceTypes(): Promise<ServiceType[]> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, code, naam, dienstwaarde')
      .eq('actief', true)
      .order('code', { ascending: true });
    
    if (error) {
      console.error('❌ Fout bij ophalen service types:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij ophalen service types:', error);
    return [];
  }
}
