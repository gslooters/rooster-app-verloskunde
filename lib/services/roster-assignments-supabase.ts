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

/** Haal alle assignments op voor een rooster */
export async function getAssignmentsByRosterId(rosterId: string): Promise<RosterAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .order('date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij assignments ophalen:', error);
    throw error;
  }
}

/** Check of medewerker NB heeft op specifieke datum */
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

/** Upsert NB assignment (insert/update met constraint) */
export async function upsertNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<RosterAssignment | null> {
  try {
    if (!rosterId || !employeeId || !date) {
      console.error('🛑 Invalid upsert input:', { rosterId, employeeId, date });
      return null;
    }
    console.log('🔍 Upsert NB:', { rosterId, employeeId, date });
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
      console.error('❌ Supabase error:', error);
      return null;
    }
    if (!data) {
      console.error('🛑 No data returned from upsert');
      return null;
    }
    console.log('✅ NB assignment created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Exception in upsertNBAssignment:', error);
    return null;
  }
}

/** Verwijder assignment op specifieke datum */
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
    return true;
  } catch (error) {
    console.error('❌ Fout bij delete assignment:', error);
    throw error;
  }
}

/** Bulk alle NB assignments voor rooster */
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
    const nbMap = new Map<string, Set<string>>();
    (data || []).forEach(row => {
      if (!nbMap.has(row.employee_id)) nbMap.set(row.employee_id, new Set());
      nbMap.get(row.employee_id)!.add(row.date);
    });
    console.log(`✅ Loaded ${data?.length || 0} NB assignments for roster ${rosterId}`);
    return nbMap;
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen NB:', error);
    return new Map();
  }
}
