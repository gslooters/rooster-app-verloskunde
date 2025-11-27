/**
 * Type definitions voor het "Diensten per medewerker aanpassen" scherm
 * DRAAD64
 */

/**
 * Roster periode informatie
 */
export interface RosterInfo {
  id: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  startWeek: number;
  endWeek: number;
}

/**
 * Dienst-type definitie met kleur
 */
export interface ServiceType {
  id: string;
  code: string;      // DDA, DDO, DIA, etc.
  naam: string;
  kleur: string;     // Hex kleur voor badge
}

/**
 * Dienst-toewijzing voor één medewerker + één dienst-type
 */
export interface EmployeeService {
  serviceId: string;
  code: string;      // Voor snelle lookup
  aantal: number;
  actief: boolean;   // Checkbox staat
}

/**
 * Medewerker met al zijn dienst-toewijzingen
 */
export interface Employee {
  id: string;
  voornaam: string;
  achternaam: string;
  team: string;      // Groen, Oranje, Overig
  services: EmployeeService[];
}

/**
 * Complete response van GET /api/diensten-aanpassen
 */
export interface DienstenAanpassenData {
  roster: RosterInfo;
  serviceTypes: ServiceType[];
  employees: Employee[];
}

/**
 * Request body voor PUT /api/diensten-aanpassen
 */
export interface UpdateServiceRequest {
  rosterId: string;
  employeeId: string;
  serviceId: string;
  aantal: number;
  actief: boolean;
}

/**
 * Response van PUT /api/diensten-aanpassen
 */
export interface UpdateServiceResponse {
  success: boolean;
  data: {
    aantal: number;
    actief: boolean;
    updated_at: string;
  };
}

/**
 * Team totalen voor footer
 */
export interface TeamTotals {
  [serviceId: string]: {
    groen: number;
    oranje: number;
    overig: number;
    totaal: number;
  };
}
