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
    created_at: row.created_at,
    updated_at: row.updated_at || '',
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

// ... rest van de file ongewijzigd ...
