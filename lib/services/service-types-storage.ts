// lib/services/service-types-storage.ts
// ============================================================================
// SERVICE TYPES STORAGE - AP42 Database Herstructurering
// ============================================================================
// Complete CRUD operaties voor service_types met UUID en JSONB team regels
// Datum: 2025-11-15
// ============================================================================

import { supabase } from '@/lib/supabase';
import { ServiceType, isValidServiceCode, berekenDuur } from '@/lib/types/service';

// ============================================================================
// READ OPERATIES
// ============================================================================

/**
 * Haal alle actieve service types op
 * Gesorteerd op code (alfabetisch)
 * 
 * @returns Array van ServiceType objecten
 */
export async function getAllServiceTypes(): Promise<ServiceType[]> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('actief', true)
      .order('code', { ascending: true });
    
    if (error) {
      console.error('❌ Fout bij ophalen service types:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ getAllServiceTypes failed:', error);
    return [];
  }
}

/**
 * Haal ÉÉN service type op via UUID
 * 
 * @param id - UUID van de service type
 * @returns ServiceType object of null
 */
export async function getServiceTypeById(id: string): Promise<ServiceType | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`❌ Service type met id ${id} niet gevonden:`, error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ getServiceTypeById failed:', error);
    return null;
  }
}

/**
 * Haal service type op via code (2-3 chars)
 * Backward compatibility voor bestaande code die op code zoekt
 * 
 * @param code - Service code (bijv. 'DAG', 'ECH', 'D24')
 * @returns ServiceType object of null
 */
export async function getServiceTypeByCode(code: string): Promise<ServiceType | null> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) {
      console.error(`❌ Service type met code ${code} niet gevonden:`, error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ getServiceTypeByCode failed:', error);
    return null;
  }
}

/**
 * Haal alle service types op (inclusief inactieve)
 * Gebruik voor beheer schermen
 * 
 * @returns Array van alle ServiceType objecten
 */
export async function getAllServiceTypesIncludingInactive(): Promise<ServiceType[]> {
  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .order('code', { ascending: true });
    
    if (error) {
      console.error('❌ Fout bij ophalen alle service types:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ getAllServiceTypesIncludingInactive failed:', error);
    return [];
  }
}

// ============================================================================
// CREATE OPERATIE
// ============================================================================

/**
 * Maak een nieuwe service type aan
 * Valideert code format en berekent duur automatisch
 * 
 * @param service - ServiceType data (zonder id, created_at, updated_at)
 * @returns Nieuwe ServiceType of null bij fout
 */
export async function createServiceType(
  service: Omit<ServiceType, 'id' | 'created_at' | 'updated_at'>
): Promise<ServiceType | null> {
  try {
    // Validatie
    if (!isValidServiceCode(service.code)) {
      throw new Error('Code moet 2-3 UPPERCASE karakters zijn');
    }
    
    if (!service.naam || service.naam.trim().length === 0) {
      throw new Error('Naam is verplicht');
    }
    
    // Bereken duur automatisch
    const duur = berekenDuur(service.begintijd, service.eindtijd);
    
    // Insert in database (UUID wordt automatisch gegenereerd)
    const { data, error } = await supabase
      .from('service_types')
      .insert([{
        ...service,
        duur,
        code: service.code.toUpperCase() // Force uppercase
      }])
      .select()
      .single();
    
    if (error) {
      // Check voor UNIQUE constraint violations
      if (error.message.includes('service_types_code_key')) {
        throw new Error(`Code '${service.code}' bestaat al`);
      }
      if (error.message.includes('service_types_naam_key')) {
        throw new Error(`Naam '${service.naam}' bestaat al`);
      }
      throw error;
    }
    
    console.log('✅ Service type aangemaakt:', data.code);
    return data;
  } catch (error: any) {
    console.error('❌ createServiceType failed:', error);
    throw error;
  }
}

// ============================================================================
// UPDATE OPERATIE
// ============================================================================

/**
 * Update een bestaande service type
 * Herberekent duur als tijden wijzigen
 * 
 * @param id - UUID van de service type
 * @param updates - Velden om te updaten (partial)
 * @returns Geupdate ServiceType of null bij fout
 */
export async function updateServiceType(
  id: string,
  updates: Partial<Omit<ServiceType, 'id' | 'created_at' | 'updated_at'>>
): Promise<ServiceType | null> {
  try {
    // Validatie code indien gewijzigd
    if (updates.code && !isValidServiceCode(updates.code)) {
      throw new Error('Code moet 2-3 UPPERCASE karakters zijn');
    }
    
    // Force uppercase code
    if (updates.code) {
      updates.code = updates.code.toUpperCase();
    }
    
    // Bereken duur opnieuw als tijden wijzigen
    if (updates.begintijd || updates.eindtijd) {
      // Haal huidige service op voor tijden
      const current = await getServiceTypeById(id);
      if (!current) {
        throw new Error('Service type niet gevonden');
      }
      
      const begintijd = updates.begintijd || current.begintijd;
      const eindtijd = updates.eindtijd || current.eindtijd;
      updates.duur = berekenDuur(begintijd, eindtijd);
    }
    
    // Update in database
    const { data, error } = await supabase
      .from('service_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      // Check voor UNIQUE constraint violations
      if (error.message.includes('service_types_code_key')) {
        throw new Error(`Code '${updates.code}' bestaat al`);
      }
      if (error.message.includes('service_types_naam_key')) {
        throw new Error(`Naam '${updates.naam}' bestaat al`);
      }
      throw error;
    }
    
    console.log('✅ Service type geupdate:', data.code);
    return data;
  } catch (error: any) {
    console.error('❌ updateServiceType failed:', error);
    throw error;
  }
}

/**
 * Toggle actief status van service type
 * Handig voor snel in/uitschakelen
 * 
 * @param id - UUID van de service type
 * @returns true bij succes
 */
export async function toggleServiceTypeActive(id: string): Promise<boolean> {
  try {
    const current = await getServiceTypeById(id);
    if (!current) {
      throw new Error('Service type niet gevonden');
    }
    
    const updated = await updateServiceType(id, {
      actief: !current.actief
    });
    
    return !!updated;
  } catch (error) {
    console.error('❌ toggleServiceTypeActive failed:', error);
    return false;
  }
}

// ============================================================================
// DELETE OPERATIE
// ============================================================================

/**
 * Verwijder een service type
 * WAARSCHUWING: Checkt eerst of dienst gebruikt wordt in roosters
 * 
 * @param id - UUID van de service type
 * @returns true bij succes, false bij fout
 */
export async function deleteServiceType(id: string): Promise<boolean> {
  try {
    // Check of service type bestaat
    const service = await getServiceTypeById(id);
    if (!service) {
      throw new Error('Service type niet gevonden');
    }
    
    // TODO: Check of dienst gebruikt wordt in roster_assignments
    // Dit moet later geïmplementeerd worden als de roster structuur duidelijk is
    
    // Verwijder uit database
    const { error } = await supabase
      .from('service_types')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Service type verwijderd:', service.code);
    return true;
  } catch (error) {
    console.error('❌ deleteServiceType failed:', error);
    return false;
  }
}

// ============================================================================
// VALIDATIE HELPERS
// ============================================================================

/**
 * Check of een code al bestaat (voor validatie bij invoer)
 * 
 * @param code - Code om te checken
 * @param excludeId - Optioneel: ID om uit te sluiten (voor edit)
 * @returns true als code beschikbaar is
 */
export async function isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('service_types')
      .select('id')
      .eq('code', code.toUpperCase());
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return !data || data.length === 0;
  } catch (error) {
    console.error('❌ isCodeAvailable failed:', error);
    return false;
  }
}

/**
 * Check of een naam al bestaat (voor validatie bij invoer)
 * 
 * @param naam - Naam om te checken
 * @param excludeId - Optioneel: ID om uit te sluiten (voor edit)
 * @returns true als naam beschikbaar is
 */
export async function isNaamAvailable(naam: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('service_types')
      .select('id')
      .eq('naam', naam);
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return !data || data.length === 0;
  } catch (error) {
    console.error('❌ isNaamAvailable failed:', error);
    return false;
  }
}
