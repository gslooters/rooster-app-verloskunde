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

/**
 * Converteer database row naar RosterDesignData object
 */
function rowToDesignData(row: RosterDesignRow): RosterDesignData {
  return {
    rosterId: row.roster_id,
    employees: row.employees,
    unavailabilityData: row.unavailability_data,
    shiftCounts: row.shift_counts,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Converteer RosterDesignData naar database row format
 */
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

/**
 * Haal roster design data op voor een specifiek rooster
 * @param rosterId - Rooster ID
 * @returns RosterDesignData of null als niet gevonden
 */
export async function getRosterDesignByRosterId(
  rosterId: string
): Promise<RosterDesignData | null> {
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

    if (!data) {
      return null;
    }

    return rowToDesignData(data as RosterDesignRow);
  } catch (error) {
    console.error('❌ Fout bij ophalen roster design:', error);
    throw error;
  }
}

/**
 * Maak een nieuw roster design aan
 * @param data - RosterDesignData zonder timestamps
 * @returns Nieuw aangemaakt RosterDesignData
 */
export async function createRosterDesign(
  data: Omit<RosterDesignData, 'createdAt' | 'updatedAt'>
): Promise<RosterDesignData> {
  try {
    const row = designDataToRow(data as RosterDesignData);
    
    const { data: result, error } = await supabase
      .from('roster_design')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error bij aanmaken roster design:', error);
      throw error;
    }

    console.log('✅ Roster design succesvol aangemaakt:', result.roster_id);
    return rowToDesignData(result as RosterDesignRow);
  } catch (error) {
    console.error('❌ Fout bij aanmaken roster design:', error);
    throw error;
  }
}

/**
 * Update een bestaand roster design
 * @param rosterId - Rooster ID
 * @param updates - Te updaten velden (partial update)
 * @returns Geüpdatet RosterDesignData
 */
export async function updateRosterDesign(
  rosterId: string,
  updates: Partial<RosterDesignData>
): Promise<RosterDesignData> {
  try {
    const row = designDataToRow({ rosterId, ...updates } as RosterDesignData);

    const { data, error } = await supabase
      .from('roster_design')
      .update(row)
      .eq('roster_id', rosterId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error bij updaten roster design:', error);
      throw error;
    }

    console.log('✅ Roster design succesvol geüpdatet:', rosterId);
    return rowToDesignData(data as RosterDesignRow);
  } catch (error) {
    console.error('❌ Fout bij updaten roster design:', error);
    throw error;
  }
}

/**
 * Verwijder een roster design
 * @param rosterId - Rooster ID
 * @returns true als succesvol verwijderd
 */
export async function deleteRosterDesign(rosterId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roster_design')
      .delete()
      .eq('roster_id', rosterId);

    if (error) {
      console.error('❌ Supabase error bij verwijderen roster design:', error);
      throw error;
    }

    console.log('✅ Roster design succesvol verwijderd:', rosterId);
    return true;
  } catch (error) {
    console.error('❌ Fout bij verwijderen roster design:', error);
    throw error;
  }
}

/**
 * Update medewerkers lijst voor een rooster
 * @param rosterId - Rooster ID
 * @param employees - Volledige medewerkers array
 * @returns Geüpdatet RosterDesignData
 */
export async function updateEmployees(
  rosterId: string,
  employees: RosterEmployee[]
): Promise<RosterDesignData> {
  return updateRosterDesign(rosterId, { employees });
}

/**
 * Update beschikbaarheid van een medewerker op een specifieke datum
 * @param rosterId - Rooster ID
 * @param employeeId - Medewerker ID
 * @param date - Datum (YYYY-MM-DD)
 * @param isUnavailable - true = niet beschikbaar, false = beschikbaar
 * @returns Geüpdatet RosterDesignData
 */
export async function updateUnavailability(
  rosterId: string,
  employeeId: string,
  date: string,
  isUnavailable: boolean
): Promise<RosterDesignData> {
  try {
    // Haal huidige data op
    const current = await getRosterDesignByRosterId(rosterId);
    if (!current) {
      throw new Error(`Roster design niet gevonden: ${rosterId}`);
    }

    // Update unavailability data
    const unavailabilityData = { ...current.unavailabilityData };
    if (!unavailabilityData[employeeId]) {
      unavailabilityData[employeeId] = {};
    }
    unavailabilityData[employeeId][date] = isUnavailable;

    // Save terug naar database
    return updateRosterDesign(rosterId, { unavailabilityData });
  } catch (error) {
    console.error('❌ Fout bij updaten beschikbaarheid:', error);
    throw error;
  }
}

/**
 * Update shift counts voor een medewerker en dienst type
 * @param rosterId - Rooster ID
 * @param employeeId - Medewerker ID
 * @param shiftType - Dienst type (bijv. 'D', 'N', 'A')
 * @param count - Aantal diensten
 * @returns Geüpdatet RosterDesignData
 */
export async function updateShiftCount(
  rosterId: string,
  employeeId: string,
  shiftType: string,
  count: number
): Promise<RosterDesignData> {
  try {
    // Haal huidige data op
    const current = await getRosterDesignByRosterId(rosterId);
    if (!current) {
      throw new Error(`Roster design niet gevonden: ${rosterId}`);
    }

    // Update shift counts
    const shiftCounts = { ...current.shiftCounts };
    if (!shiftCounts[employeeId]) {
      shiftCounts[employeeId] = {};
    }
    shiftCounts[employeeId][shiftType] = count;

    // Save terug naar database
    return updateRosterDesign(rosterId, { shiftCounts });
  } catch (error) {
    console.error('❌ Fout bij updaten shift counts:', error);
    throw error;
  }
}

/**
 * Update de status van een roster design
 * @param rosterId - Rooster ID
 * @param status - Nieuwe status
 * @returns Geüpdatet RosterDesignData
 */
export async function updateRosterDesignStatus(
  rosterId: string,
  status: RosterStatus
): Promise<RosterDesignData> {
  return updateRosterDesign(rosterId, { status });
}

/**
 * Bulk update: Zet unavailability voor meerdere dagen tegelijk
 * @param rosterId - Rooster ID
 * @param employeeId - Medewerker ID
 * @param dates - Array van datums (YYYY-MM-DD)
 * @param isUnavailable - true = niet beschikbaar, false = beschikbaar
 * @returns Geüpdatet RosterDesignData
 */
export async function bulkUpdateUnavailability(
  rosterId: string,
  employeeId: string,
  dates: string[],
  isUnavailable: boolean
): Promise<RosterDesignData> {
  try {
    // Haal huidige data op
    const current = await getRosterDesignByRosterId(rosterId);
    if (!current) {
      throw new Error(`Roster design niet gevonden: ${rosterId}`);
    }

    // Update alle datums in één keer
    const unavailabilityData = { ...current.unavailabilityData };
    if (!unavailabilityData[employeeId]) {
      unavailabilityData[employeeId] = {};
    }

    dates.forEach((date) => {
      unavailabilityData[employeeId][date] = isUnavailable;
    });

    // Save terug naar database (één database call)
    return updateRosterDesign(rosterId, { unavailabilityData });
  } catch (error) {
    console.error('❌ Fout bij bulk updaten beschikbaarheid:', error);
    throw error;
  }
}

/**
 * Haal alle roster designs op voor meerdere roosters
 * @param rosterIds - Array van rooster IDs
 * @returns Array van RosterDesignData objecten
 */
export async function getRosterDesignsByRosterIds(
  rosterIds: string[]
): Promise<RosterDesignData[]> {
  try {
    const { data, error } = await supabase
      .from('roster_design')
      .select('*')
      .in('roster_id', rosterIds);

    if (error) {
      console.error('❌ Supabase error bij ophalen meerdere roster designs:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDesignData(row as RosterDesignRow));
  } catch (error) {
    console.error('❌ Fout bij ophalen meerdere roster designs:', error);
    throw error;
  }
}
