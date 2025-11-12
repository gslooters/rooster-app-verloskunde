import { supabase } from '@/lib/supabase';

export interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  service_code: string;
  date: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateRosterAssignmentInput {
  roster_id: string;
  employee_id: string;
  service_code: string;
  date: string;
}

/**
 * Haal alle assignments op voor een rooster
 */
export async function getAssignmentsByRosterId(rosterId: string): Promise<RosterAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Supabase error bij ophalen assignments:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij assignments ophalen:', error);
    throw error;
  }
}

/**
 * Haal alle assignments op voor een medewerker
 */
export async function getAssignmentsByEmployeeId(employeeId: string): Promise<RosterAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Supabase error bij ophalen assignments:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij assignments ophalen:', error);
    throw error;
  }
}

/**
 * Maak een nieuwe assignment aan
 */
export async function createRosterAssignment(input: CreateRosterAssignmentInput): Promise<RosterAssignment> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .insert({ ...input })
      .select()
      .single();
    if (error) {
      console.error('❌ Supabase error bij assignment aanmaken:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('❌ Fout bij assignment aanmaken:', error);
    throw error;
  }
}

/**
 * Update een bestaande assignment
 */
export async function updateRosterAssignment(id: string, updates: Partial<CreateRosterAssignmentInput>): Promise<RosterAssignment> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('❌ Supabase error bij assignment update:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('❌ Fout bij assignment update:', error);
    throw error;
  }
}

/**
 * Verwijder assignment
 */
export async function deleteRosterAssignment(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('❌ Supabase error bij assignment verwijderen:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('❌ Fout bij assignment verwijderen:', error);
    throw error;
  }
}

/**
 * Bulk fetch alle assignments voor meerdere roosters
 */
export async function getAssignmentsByRosterIds(rosterIds: string[]): Promise<RosterAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .in('roster_id', rosterIds);
    if (error) {
      console.error('❌ Supabase error bulk ophalen assignments:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen assignments:', error);
    throw error;
  }
}

// ============================================================================
// NB TOGGLE FUNCTIES (DRAAD26K)
// ============================================================================

/**
 * Check of medewerker NB heeft op specifieke datum
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param date - Datum in YYYY-MM-DD formaat
 * @returns true als medewerker NB heeft op deze datum
 */
export async function isEmployeeUnavailableOnDate(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('service_code')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .single();
    
    if (error) {
      // PGRST116 = no rows returned - betekent geen assignment = beschikbaar
      if (error.code === 'PGRST116') return false;
      console.error('❌ Fout bij check unavailability:', error);
      return false;
    }
    
    return data?.service_code === 'NB';
  } catch (error) {
    console.error('❌ Fout bij unavailability check:', error);
    return false;
  }
}

/**
 * Upsert NB assignment (insert of update bestaande assignment naar NB)
 * Gebruikt UNIQUE constraint (roster_id, employee_id, date) voor conflict resolution
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param date - Datum in YYYY-MM-DD formaat
 * @returns RosterAssignment object
 */
export async function upsertNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<RosterAssignment> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        service_code: 'NB'
      }, {
        onConflict: 'roster_id,employee_id,date'
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Fout bij upsert NB assignment:', error);
      throw error;
    }
    
    console.log('✅ NB assignment created/updated:', { employeeId, date });
    return data;
  } catch (error) {
    console.error('❌ Fout bij NB upsert:', error);
    throw error;
  }
}

/**
 * Verwijder assignment op specifieke datum (maakt medewerker beschikbaar)
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - ID van de medewerker
 * @param date - Datum in YYYY-MM-DD formaat
 * @returns true als succesvol verwijderd
 */
export async function deleteAssignmentByDate(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date);
    
    if (error) {
      console.error('❌ Fout bij verwijderen assignment:', error);
      throw error;
    }
    
    console.log('✅ Assignment verwijderd:', { employeeId, date });
    return true;
  } catch (error) {
    console.error('❌ Fout bij delete assignment:', error);
    throw error;
  }
}

/**
 * Bulk ophalen alle NB assignments voor een rooster
 * Gebruikt voor efficiënte UI rendering
 * 
 * @param rosterId - UUID van het rooster
 * @returns Map<employeeId, Set<dateString>> voor snelle lookup
 */
export async function getNBAssignmentsByRosterId(rosterId: string): Promise<Map<string, Set<string>>> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('employee_id, date')
      .eq('roster_id', rosterId)
      .eq('service_code', 'NB');
    
    if (error) {
      console.error('❌ Fout bij bulk ophalen NB assignments:', error);
      throw error;
    }
    
    // Converteer naar Map<employeeId, Set<dateString>> voor O(1) lookup
    const nbMap = new Map<string, Set<string>>();
    
    (data || []).forEach(row => {
      if (!nbMap.has(row.employee_id)) {
        nbMap.set(row.employee_id, new Set());
      }
      nbMap.get(row.employee_id)!.add(row.date);
    });
    
    console.log(`✅ Loaded ${data?.length || 0} NB assignments for roster ${rosterId}`);
    return nbMap;
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen NB:', error);
    return new Map();
  }
}
