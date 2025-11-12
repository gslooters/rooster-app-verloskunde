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
