import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Medewerker-Diensten toewijzing CRUD
export async function getEmployeeServicesMappings() {
  const { data, error } = await supabase.from('employee_services').select('*');
  if (error) throw error;
  const mappings: Record<string, string[]> = {};
  data.forEach(row => {
    mappings[row.employee_id] = row.service_codes;
  });
  return mappings;
}

export async function setServicesForEmployee(employeeId: string, serviceCodes: string[]) {
  const { data, error } = await supabase.from('employee_services')
    .upsert([{ employee_id: employeeId, service_codes: serviceCodes }], { onConflict: 'employee_id' })
    .select();
  if (error) throw error;
  return data;
}
