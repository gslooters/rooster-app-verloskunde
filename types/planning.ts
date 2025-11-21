/**
 * DRAAD42 - Planning Types
 * 
 * TypeScript interfaces voor week dagdelen vaststelling
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
  datum: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffingDagdeel {
  id: string;
  roster_period_staffing_id: string;
  dagdeel: 'O' | 'M' | 'A';
  team: 'Groen' | 'Oranje' | 'TOT';
  status: 'MOET' | 'MAG' | 'MAG-NIET';
  aantal: number;
  created_at?: string;
  updated_at?: string;
  // Enriched fields (from join)
  service_type_id?: string;
  datum?: string;
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dateStr: string;
  fullDate: string;
}

export type Team = 'Groen' | 'Oranje' | 'TOT';
export type Dagdeel = 'O' | 'M' | 'A';
export type Status = 'MOET' | 'MAG' | 'MAG-NIET';
