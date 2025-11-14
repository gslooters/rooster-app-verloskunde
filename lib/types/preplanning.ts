/**
 * PrePlanning Type Definitions
 * Voor het toewijzen van diensten aan medewerkers in de ontwerpfase
 * Data wordt opgeslagen in Supabase roster_assignments tabel
 */

export interface PrePlanningAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  service_code: string;
  date: string; // ISO date format YYYY-MM-DD
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
 * Helper functie om een cell key te maken voor assignment lookup
 */
export function makePrePlanningCellKey(employeeId: string, dateIndex: number): string {
  return `${employeeId}_${dateIndex}`;
}
