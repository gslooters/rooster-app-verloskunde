/**
 * PrePlanning Type Definitions
 * Voor het toewijzen van diensten aan medewerkers in de ontwerpfase
 * Data wordt opgeslagen in Supabase roster_assignments tabel
 * 
 * DRAAD 77: Uitgebreid met dagdeel ondersteuning en cel status structuur
 * DRAAD 79: ServiceTypeWithTimes toegevoegd voor modal component
 * DRAAD399: team_variant + variant_id velden toegevoegd voor team-aware diensten
 * DRAAD402-HOTFIX: ✅ Added service_id field to fix TypeScript compilation error
 */

/**
 * Status van een cel in het rooster
 * 0 = Leeg (geen assignment)
 * 1 = Dienst (heeft service_id)
 * 2 = Geblokkeerd (kan niet ingepland worden)
 * 3 = Niet Beschikbaar (medewerker afwezig)
 */
export type CellStatus = 0 | 1 | 2 | 3;

/**
 * Dagdeel type (Ochtend, Middag, Avond)
 */
export type Dagdeel = 'O' | 'M' | 'A';

/**
 * Informatie over cel status met display properties
 */
export interface CellStatusInfo {
  status: CellStatus;
  label: string;
  serviceCode?: string;
  serviceColor?: string;
}

/**
 * PrePlanning Assignment - Uitgebreid met dagdeel en status
 */
export interface PrePlanningAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string; // ISO date format YYYY-MM-DD
  
  // DRAAD 77: Nieuwe velden
  dagdeel: Dagdeel; // 'O', 'M', of 'A'
  status: CellStatus; // 0, 1, 2, of 3
  service_id: string | null; // UUID of null (bij status 0, 2, 3)
  
  // BACKWARDS COMPATIBILITY: Blijft bestaan voor legacy code
  service_code: string; // Computed van service_id voor backwards compatibility
  
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithServices {
  id: string;
  voornaam: string;
  achternaam: string;
  team: string;
  dienstverband: string;
  serviceCodes: string[]; // Array van dienst codes die medewerker kan uitvoeren
}

export interface PrePlanningData {
  rosterId: string;
  employees: EmployeeWithServices[];
  assignments: PrePlanningAssignment[];
  startDate: string;
  endDate: string;
}

/**
 * DRAAD 79: Service type met tijden voor modal component
 * DRAAD399: Uitgebreid met team_variant en variant_id voor team-aware diensten
 * DRAAD402-HOTFIX: ✅ Added service_id field for FK integrity
 * 
 * Simplified versie van ServiceType met alleen benodigde velden
 * 
 * Field mapping:
 * - id: roster_period_staffing_dagdelen.id (VARIANT ID - unique per date/dagdeel/team)
 * - service_id: service_types.id (SERVICE ID - FK for database)
 * - code: service_types.code (SERVICE CODE - e.g., "DIO", "NB")
 * - team_variant: roster_period_staffing_dagdelen.team (TEAM - 'GRO', 'ORA', 'TOT')
 * - variant_id: duplicate of 'id' (for backwards compatibility)
 */
export interface ServiceTypeWithTimes {
  id: string;                           // variant_id: roster_period_staffing_dagdelen.id
  code: string;                         // service code
  naam: string;                         // service name
  kleur: string;                        // service color
  start_tijd: string;                   // HH:MM format
  eind_tijd: string;                    // HH:MM format
  service_id: string;                   // ✅ NEW - service_types.id (for database FK)
  team_variant?: string;                // 'GRO' | 'ORA' | 'TOT'
  variant_id?: string;                  // duplicate of 'id' for backwards compat
}

/**
 * Helper functie om een cell key te maken voor assignment lookup
 */
export function makePrePlanningCellKey(employeeId: string, dateIndex: number): string {
  return `${employeeId}_${dateIndex}`;
}

/**
 * Helper functie om een cell key te maken MET dagdeel voor assignment lookup
 * Voor het nieuwe dagdeel-gebaseerde systeem
 */
export function makePrePlanningCellKeyWithDagdeel(
  employeeId: string, 
  dateIndex: number, 
  dagdeel: Dagdeel
): string {
  return `${employeeId}_${dateIndex}_${dagdeel}`;
}

/**
 * Status labels voor display
 */
export const CELL_STATUS_LABELS: Record<CellStatus, string> = {
  0: '-', // Leeg
  1: '', // Dienst (wordt gevuld met service code)
  2: '▓', // Geblokkeerd
  3: 'NB' // Niet Beschikbaar
};

/**
 * Status kleuren voor display
 */
export const CELL_STATUS_COLORS: Record<CellStatus, { bg: string; text: string }> = {
  0: { bg: '#FFFFFF', text: '#9CA3AF' }, // Wit met grijze text
  1: { bg: '#3B82F6', text: '#FFFFFF' }, // Blauw met witte text (overridden door service kleur)
  2: { bg: '#F3F4F6', text: '#6B7280' }, // Lichtgrijs met grijze text
  3: { bg: '#FEF3C7', text: '#1F2937' }  // Geel met zwarte text
};