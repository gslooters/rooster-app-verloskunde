import { supabase } from '@/lib/supabase';
import type { RosterDesignData, RosterEmployee, RosterStatus } from '@/lib/types/roster';
import { parseUTCDate, toUTCDateString } from '@/lib/utils/date-utc';
import { copyEmployeeServicesToRoster } from './roster-employee-services';

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
// DRAAD57: Dates uit database worden als strings opgeslagen (YYYY-MM-DD)
// Als je Date objects nodig hebt in de app, gebruik parseUTCDate()
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
  // Deze zijn al in YYYY-MM-DD formaat (database constraint)
  // Als conversie naar Date nodig is: parseUTCDate(row.roosters.start_date)
  if (row.roosters) {
    designData.start_date = row.roosters.start_date;
    designData.end_date = row.roosters.end_date;
  }
  
  return designData;
}

// Convert app data model naar database row
// DRAAD57: Als input Date objects zijn, converteer naar YYYY-MM-DD met toUTCDateString()
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
    
    // DRAAD66A: Kopieer employee_services naar roster_employee_services
    // Dit maakt een snapshot van welke diensten medewerkers kunnen uitvoeren
    try {
      console.log('🔄 [createRosterDesign] Start kopiëren employee services...');
      
      // Extract employee IDs uit de employee_snapshot
      const employeeIds = data.employees
        .filter(emp => emp.isSnapshotActive) // Alleen actieve medewerkers
        .map(emp => emp.originalEmployeeId); // Gebruik originele employee ID
      
      if (employeeIds.length === 0) {
        console.warn('⚠️ [createRosterDesign] Geen actieve medewerkers in snapshot');
      } else {
        const copiedCount = await copyEmployeeServicesToRoster(
          data.rosterId,
          employeeIds
        );
        
        console.log(`✅ [createRosterDesign] ${copiedCount} employee services gekopieerd naar roster`);
      }
    } catch (serviceError) {
      // Log de fout maar laat createRosterDesign niet falen
      // De roster_design is al succesvol aangemaakt
      console.error('❌ [createRosterDesign] Fout bij kopiëren employee services:', serviceError);
      console.error('⚠️ [createRosterDesign] Roster design is aangemaakt, maar employee services snapshot is NIET gelukt');
      console.error('⚠️ [createRosterDesign] Dit kan problemen veroorzaken bij planning. Controleer roster_employee_services tabel.');
      
      // TODO: In toekomstige versie kunnen we overwegen om de roster_design te verwijderen
      // en de hele transactie te rollbacken. Voor nu loggen we alleen de fout.
    }
    
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