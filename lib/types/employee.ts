// lib/types/employee.ts
export interface Employee {
  id: string;
  voornaam: string;    // verplicht - voor rooster
  achternaam: string;  // verplicht - voor export
  email?: string;      // optioneel
  telefoon?: string;   // optioneel
  actief: boolean;     // verplicht
  created_at: string;
  updated_at: string;
}

// Helper functie voor volledige naam
export function getFullName(employee: Employee): string {
  return `${employee.voornaam} ${employee.achternaam}`.trim();
}

// Helper functie voor rooster weergave (alleen voornaam)
export function getRosterDisplayName(employee: Employee): string {
  return employee.voornaam;
}