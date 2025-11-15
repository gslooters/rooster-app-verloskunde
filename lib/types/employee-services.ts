// Type definitions voor employee services koppeling
// FASE 2: UUID-gebaseerde koppeling met dienstwaarde ondersteuning

export interface ServiceType {
  id: string;
  code: string;
  naam: string;
  beschrijving?: string;
  dienstwaarde: number; // Gebruik bestaande kolom voor weging
  begintijd?: string;
  eindtijd?: string;
  duur?: number;
  kleur?: string;
  actief: boolean;
  created_at: string;
  updated_at: string;
}

// Database schema: employee_services tabel
export interface EmployeeService {
  id: string;
  employee_id: string;  // text (foreign key naar employees.id)
  service_id: string;   // uuid (foreign key naar service_types.id)
  aantal: number;       // aantal keer dat deze dienst per periode wordt gedaan
  actief: boolean;      // of deze dienst actief is voor deze medewerker
  created_at: string;
  updated_at: string;
}

export interface EmployeeServiceInput {
  employee_id: string;
  service_id: string;
  aantal: number;
  actief: boolean;
}

export interface EmployeeServiceRow {
  employeeId: string;
  employeeName: string;
  team: string;
  dienstenperiode: number;
  services: {
    [serviceCode: string]: {
      enabled: boolean;     // maps to 'actief'
      count: number;        // maps to 'aantal'
      dienstwaarde: number; // from service_types tabel
    };
  };
  totalDiensten: number; // Som van (aantal × dienstwaarde)
  isOnTarget: boolean;
}
