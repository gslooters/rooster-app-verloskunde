/**
 * DRAAD64 FIX - Planning Types
 * 
 * TypeScript interfaces voor week dagdelen vaststelling
 * 
 * FIX: Team codes aangepast naar database codes (GRO/ORA/TOT)
 *      Was: 'Groen'/'Oranje' → Nu: 'GRO'/'ORA'
 */

export interface ServiceType {
  id: string;
  code: string;
  naam: string;
  kleur: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RosterPeriod {
  id: string;
  naam: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RosterPeriodStaffing {
  id: string;
  roster_period_id: string;
  service_type_id: string;
  date: string;  // 🔥 FIX: Was 'datum', nu 'date' (matches database)
  created_at?: string;
  updated_at?: string;
}

export interface StaffingDagdeel {
  id: string;
  roster_period_staffing_id: string;
  dagdeel: 'O' | 'M' | 'A';
  team: 'GRO' | 'ORA' | 'TOT';  // 🔥 DRAAD64: Was 'Groen' | 'Oranje' | 'TOT'
  status: 'MOET' | 'MAG' | 'MAG-NIET';
  aantal: number;
  created_at?: string;
  updated_at?: string;
  // Enriched fields (from join)
  service_type_id?: string;
  service_id?: string;  // 🔥 DRAAD45.8 FIX: Toegevoegd voor join compatibiliteit
  date?: string;  // 🔥 FIX: Was 'datum', nu 'date' (matches database)
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dateStr: string;
  fullDate: string;
}

export type Team = 'GRO' | 'ORA' | 'TOT';  // 🔥 DRAAD64: Was 'Groen' | 'Oranje' | 'TOT'
export type Dagdeel = 'O' | 'M' | 'A';
export type Status = 'MOET' | 'MAG' | 'MAG-NIET';