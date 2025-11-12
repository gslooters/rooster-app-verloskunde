import { supabase } from '@/lib/supabase';
import type { RosterDesignData, RosterEmployee, RosterStatus } from '@/lib/types/roster';

export interface RosterDesignRow {
  roster_id: string;
  employees: RosterEmployee[];
  unavailability_data: Record<string, Record<string, boolean>>;
  shift_counts: Record<string, Record<string, number>>;
  status: RosterStatus;
  created_at: string;
  updated_at?: string;
}

function rowToDesignData(row: RosterDesignRow): RosterDesignData {
  return {
    rosterId: row.roster_id,
    employees: row.employees,
    unavailabilityData: row.unavailability_data,
    shiftCounts: row.shift_counts,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at || '',
  };
}

function designDataToRow(data: RosterDesignData): Partial<RosterDesignRow> {
  return {
    roster_id: data.rosterId,
    employees: data.employees,
    unavailability_data: data.unavailabilityData || {},
    shift_counts: data.shiftCounts || {},
    status: data.status,
    updated_at: new Date().toISOString(),
  };
}

export async function getRosterDesignByRosterId(rosterId: string): Promise<RosterDesignData | null> {
  try {
    const { data, error } = await supabase
      .from('roster_design')
      .select('*')
      .eq('roster_id', rosterId)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error bij ophalen roster design:', error);
      throw error;
    }
    if (!data) return null;
    return rowToDesignData(data as RosterDesignRow);
  } catch (error) {
    console.error('❌ Fout bij ophalen roster design:', error);
    throw error;
  }
}

export async function createRosterDesign(data: Omit<RosterDesignData, 'created_at' | 'updated_at'>): Promise<RosterDesignData> {
  try {
    const row = designDataToRow(data as RosterDesignData);
    const { data: result, error } = await supabase
      .from('roster_design')
      .insert(row)
      .select()
      .single();
    if (error) { throw error; }
    return rowToDesignData(result as RosterDesignRow);
  } catch (error) {
    throw error;
  }
}

export async function updateRosterDesign(rosterId: string, updates: Partial<RosterDesignData>): Promise<RosterDesignData> {
  try {
    const row = designDataToRow({ rosterId, ...updates } as RosterDesignData);
    const { data, error } = await supabase
      .from('roster_design')
      .update(row)
      .eq('roster_id', rosterId)
      .select()
      .single();
    if (error) { throw error; }
    return rowToDesignData(data as RosterDesignRow);
  } catch (error) {
    throw error;
  }
}

export async function bulkUpdateUnavailability(rosterId: string, employeeId: string, dates: string[], isUnavailable: boolean): Promise<RosterDesignData> {
  // Dummy implementatie
  throw new Error('Not implemented.');
}
