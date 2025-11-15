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

export interface EmployeeService {
  id: string;
  employee_id: string;
  service_id: string;
  can_perform_service: boolean;
  target_count_per_period: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeServiceInput {
  employee_id: string;
  service_id: string;
  can_perform_service: boolean;
  target_count_per_period: number;
}

export interface EmployeeServiceRow {
  employeeId: string;
  employeeName: string;
  team: string;
  dienstenperiode: number;
  services: {
    [serviceCode: string]: {
      enabled: boolean;
      count: number;
      dienstwaarde: number;
    };
  };
  totalDiensten: number; // Som van (count × dienstwaarde)
  isOnTarget: boolean;
}
