import { supabase } from '@/lib/supabase';
import type { RosterDesignData, RosterEmployee, RosterStatus } from '@/lib/types/roster';

// Database row structure (EXACT match met Supabase tabel)
export interface RosterDesignRow {
  roster_id: string;
  employee_snapshot: RosterEmployee[];
  unavailability_data: Record<string, Record<string, boolean>>;
  status: RosterStatus;
  created_at: string;
  updated_at?: string;
  // GEEN shift_counts - bestaat niet in database!
}

// Extended row met roster info via JOIN
export interface RosterDesignWithPeriod extends RosterDesignRow {
  roosters?: {
    start_date: string;
    end_date: string;
  } | null;
}

// Convert database row naar app data model
function rowToDesignData(row: RosterDesignWithPeriod): RosterDesignData {
  const designData: RosterDesignData & { start_date?: string; end_date?: string } = {
    rosterId: row.roster_id,
    employees: row.employee_snapshot,
    unavailabilityData: row.unavailability_data,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at || '',
  };
  
  // Voeg start_date en end_date toe uit roosters tabel
  if (row.roosters) {
    designData.start_date = row.roosters.start_date;
    designData.end_date = row.roosters.end_date;
  }
  
  return designData;
}

// Convert app data model naar database row
function designDataToRow(data: RosterDesignData): Partial<RosterDesignRow> {
  return {
    roster_id: data.rosterId,
    employee_snapshot: data.employees,
    unavailability_data: data.unavailabilityData || {},
    status: data.status,
    updated_at: new Date().toISOString(),
    // shift_counts VERWIJDERD - bestaat niet in database tabel!
  };
}

export async function getRosterDesignByRosterId(rosterId: string): Promise<RosterDesignData | null> {
  try {
    // JOIN met roosters tabel om start_date en end_date op te halen
    const { data, error } = await supabase
      .from('roster_design')
      .select(`
        *,
        roosters!inner(
          start_date,
          end_date
        )
      `)
      .eq('roster_id', rosterId)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error bij ophalen roster design:', error);
      throw error;
    }
    if (!data) return null;
    
    console.log('✅ Roster design opgehaald met periode data:', {
      roster_id: data.roster_id,
      start_date: (data as any).roosters?.start_date,
      end_date: (data as any).roosters?.end_date
    });
    
    return rowToDesignData(data as RosterDesignWithPeriod);
  } catch (error) {
    console.error('❌ Fout bij ophalen roster design:', error);
    throw error;
  }
}

export async function createRosterDesign(data: Omit<RosterDesignData, 'created_at' | 'updated_at'>): Promise<RosterDesignData> {
  try {
    const row = designDataToRow(data as RosterDesignData);
    
    // DEBUG: Log payload naar Supabase
    console.log('🔍 INSERT roster_design payload:', JSON.stringify(row, null, 2));
    
    const { data: result, error } = await supabase
      .from('roster_design')
      .insert(row)
      .select(`
        *,
        roosters!inner(
          start_date,
          end_date
        )
      `)
      .single();
      
    if (error) { 
      console.error('❌ Supabase INSERT error:', error);
      throw error; 
    }
    
    console.log('✅ Roster design succesvol aangemaakt:', result);
    return rowToDesignData(result as RosterDesignWithPeriod);
  } catch (error) {
    console.error('❌ createRosterDesign failed:', error);
    throw error;
  }
}

export async function updateRosterDesign(rosterId: string, updates: Partial<RosterDesignData>): Promise<RosterDesignData> {
  try {
    const row = designDataToRow({ rosterId, ...updates } as RosterDesignData);
    
    // DEBUG: Log payload
    console.log('🔍 UPDATE roster_design payload:', JSON.stringify(row, null, 2));
    
    const { data, error } = await supabase
      .from('roster_design')
      .update(row)
      .eq('roster_id', rosterId)
      .select(`
        *,
        roosters!inner(
          start_date,
          end_date
        )
      `)
      .single();
      
    if (error) { 
      console.error('❌ Supabase UPDATE error:', error);
      throw error; 
    }
    
    console.log('✅ Roster design succesvol geüpdatet');
    return rowToDesignData(data as RosterDesignWithPeriod);
  } catch (error) {
    console.error('❌ updateRosterDesign failed:', error);
    throw error;
  }
}

export async function bulkUpdateUnavailability(rosterId: string, employeeId: string, dates: string[], isUnavailable: boolean): Promise<RosterDesignData> {
  throw new Error('Not implemented.');
}
