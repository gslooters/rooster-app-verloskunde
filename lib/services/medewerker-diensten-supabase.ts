import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Haal alle dienst-toewijzingen op uit Supabase
 * Retourneert: { "employee-id": ["dienst1", "dienst2"], ... }
 */
export async function getEmployeeServicesMappings(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('employee_services')
    .select('employee_id, service_code');
  
  if (error) throw error;
  
  // Groepeer per medewerker
  const mappings: Record<string, string[]> = {};
  if (data) {
    data.forEach(row => {
      if (!mappings[row.employee_id]) {
        mappings[row.employee_id] = [];
      }
      mappings[row.employee_id].push(row.service_code);
    });
  }
  
  return mappings;
}

/**
 * Sla diensten op voor een specifieke medewerker
 * Verwijdert eerst alle oude toekenningen, voegt daarna nieuwe toe
 */
export async function setServicesForEmployee(employeeId: string, serviceCodes: string[]) {
  // Stap 1: Verwijder alle bestaande toekenningen voor deze medewerker
  const { error: deleteError } = await supabase
    .from('employee_services')
    .delete()
    .eq('employee_id', employeeId);
  
  if (deleteError) throw deleteError;
  
  // Stap 2: Als geen diensten, klaar
  if (serviceCodes.length === 0) {
    return [];
  }
  
  // Stap 3: Voeg nieuwe rijen toe (één per dienst)
  const newRows = serviceCodes.map(code => ({
    employee_id: employeeId,
    service_code: code,
  }));
  
  const { data, error } = await supabase
    .from('employee_services')
    .insert(newRows)
    .select();
  
  if (error) throw error;
  return data;
}
