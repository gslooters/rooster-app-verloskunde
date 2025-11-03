// Export Types & Interfaces

export type ExportFormat = 'excel' | 'pdf' | 'csv';

export type RosterCell = {
  service: string | null;
  locked: boolean;
  unavailable?: boolean;
};

export type ExportEmployee = {
  id: string;
  name: string;
};

export type ExportRoster = {
  id: string;
  start_date: string;
  end_date: string;
  period: string; // "24-11-2025 t/m 28-12-2025"
  employees: ExportEmployee[];
  days: string[]; // ISO dates
  cells: Record<string, Record<string, RosterCell>>; // [date][empId]
};

export type ServiceConfig = {
  code: string;
  label: string;
  color: string;
};

export type ExportStats = {
  employeeStats: Record<string, Record<string, number>>; // [empId][serviceCode] = count
  dailyOccupancy: Record<string, { occupied: number; total: number }>; // [date]
  serviceBreakdown: Record<string, number>; // [serviceCode] = total count
};