import { supabase } from '@/lib/supabase';

export interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  service_code: string;
  date: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateRosterAssignmentInput {
  roster_id: string;
  employee_id: string;
  service_code: string;
  date: string;
}

/** Haal alle assignments op voor een rooster */
export async function getAssignmentsByRosterId(rosterId: string): Promise<RosterAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .order('date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij assignments ophalen:', error);
    throw error;
  }
}

/**
 * NIEUW - DRAAD 26O: Haal specifieke assignment op voor medewerker op datum
 * 
 * Retourneert de volledige assignment (inclusief service_code) of null
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum in ISO formaat (YYYY-MM-DD)
 * @returns RosterAssignment object of null als geen assignment bestaat
 */
export async function getAssignmentByDate(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<RosterAssignment | null> {
  try {
    console.log('🔍 Get assignment by date:', { rosterId, employeeId, date });
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Fout bij ophalen assignment:', error);
      return null;
    }
    
    if (data) {
      console.log('✅ Assignment gevonden:', {
        id: data.id,
        service_code: data.service_code,
        date: data.date
      });
    } else {
      console.log('ℹ️  Geen assignment gevonden (null)');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Exception bij get assignment:', error);
    return null;
  }
}

/** Check of medewerker NB heeft op specifieke datum */
export async function isEmployeeUnavailableOnDate(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('service_code')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return false;
      console.error('❌ Fout bij check unavailability:', error);
      return false;
    }
    return data?.service_code === 'NB';
  } catch (error) {
    console.error('❌ Fout bij unavailability check:', error);
    return false;
  }
}

/**
 * GEFIXTE VERSIE - FASE 1D: UUID VALIDATIE VERWIJDERD VOOR EMPLOYEE_ID
 * 
 * Upsert NB assignment (insert/update met constraint)
 * 
 * FIX: employees.id is TEXT type (emp1, emp3, etc.), GEEN UUID!
 *      Verwijder UUID check voor employeeId, behoud voor rosterId
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker (emp1, emp2, etc.)
 * @param date - Datum in ISO formaat (YYYY-MM-DD)
 * @returns RosterAssignment object of null bij fout
 */
export async function upsertNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<RosterAssignment | null> {
  try {
    // Validatie input parameters
    if (!rosterId || !employeeId || !date) {
      console.error('🛑 upsertNBAssignment: Ongeldige input parameters');
      console.error('   rosterId:', rosterId);
      console.error('   employeeId:', employeeId);
      console.error('   date:', date);
      return null;
    }
    
    // Valideer UUID format ALLEEN voor rosterId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rosterId)) {
      console.error('🛑 Ongeldige rosterId UUID:', rosterId);
      return null;
    }
    
    // ✅ FIX FASE 1D: employeeId is TEXT, geen UUID!
    // Valideer alleen dat het een niet-lege string is
    if (typeof employeeId !== 'string' || employeeId.trim() === '') {
      console.error('🛑 Ongeldige employeeId (moet niet-lege string zijn):', employeeId);
      return null;
    }
    
    // Valideer datum format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.error('🛑 Ongeldige datum format:', date, '(verwacht: YYYY-MM-DD)');
      return null;
    }
    
    console.log('🔍 Upsert NB assignment:', { rosterId, employeeId, date });
    
    // Supabase upsert call
    const { data, error } = await supabase
      .from('roster_assignments')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        date: date,
        service_code: 'NB'
      }, {
        onConflict: 'roster_id,employee_id,date'
      })
      .select()
      .single();
    
    if (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ SUPABASE ERROR in upsertNBAssignment');
      console.error('='.repeat(80));
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('='.repeat(80) + '\n');
      
      // Specifieke error messages
      if (error.code === '23503') {
        console.error('⚠️  FOREIGN KEY CONSTRAINT VIOLATION');
        console.error('   Mogelijke oorzaken:');
        console.error('   1. service_code "NB" bestaat niet in service_types tabel');
        console.error('   2. rosterId bestaat niet in roosters tabel');
        console.error('   3. employeeId bestaat niet in employees tabel');
        console.error('   4. Check of employeeId correct is:', employeeId);
      } else if (error.code === '42501') {
        console.error('⚠️  PERMISSION DENIED');
        console.error('   Database permissions zijn niet correct ingesteld');
        console.error('   Check Supabase RLS policies voor roster_assignments');
      } else if (error.code === '23505') {
        console.error('⚠️  UNIQUE CONSTRAINT VIOLATION');
        console.error('   Record bestaat al (onConflict werkt niet correct)');
      }
      
      return null;
    }
    
    if (!data) {
      console.error('🛑 upsertNBAssignment: Geen data returned (maar ook geen error)');
      console.error('   Dit zou niet mogen gebeuren');
      return null;
    }
    
    console.log('✅ NB assignment succesvol aangemaakt:', {
      id: data.id,
      roster_id: data.roster_id,
      employee_id: data.employee_id,
      date: data.date,
      service_code: data.service_code
    });
    
    return data;
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ EXCEPTION in upsertNBAssignment');
    console.error('='.repeat(80));
    console.error('Exception:', error);
    console.error('Stack:', (error as Error).stack);
    console.error('='.repeat(80) + '\n');
    return null;
  }
}

/** Verwijder assignment op specifieke datum */
export async function deleteAssignmentByDate(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    console.log('🔍 Delete assignment:', { rosterId, employeeId, date });
    
    const { error } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date);
    
    if (error) {
      console.error('❌ Fout bij verwijderen assignment:', error);
      throw error;
    }
    
    console.log('✅ Assignment succesvol verwijderd');
    return true;
  } catch (error) {
    console.error('❌ Fout bij delete assignment:', error);
    throw error;
  }
}

/** 
 * BULK LOAD ALLE ASSIGNMENTS (niet alleen NB) voor Unavailability scherm
 * Retourneert Map<employeeId, Map<date, service_code>>
 * 
 * @param rosterId - UUID van het rooster
 * @returns Nested map met alle assignments per medewerker per datum
 */
export async function getAllAssignmentsByRosterId(
  rosterId: string
): Promise<Map<string, Map<string, string>>> {
  try {
    console.log('🔍 Bulk load ALL assignments voor roster:', rosterId);
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, service_code')
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('❌ Fout bij bulk ophalen assignments:', error);
      throw error;
    }
    
    const assignmentMap = new Map<string, Map<string, string>>();
    (data || []).forEach(row => {
      if (!assignmentMap.has(row.employee_id)) {
        assignmentMap.set(row.employee_id, new Map());
      }
      assignmentMap.get(row.employee_id)!.set(row.date, row.service_code);
    });
    
    console.log(`✅ Loaded ${data?.length || 0} total assignments voor roster ${rosterId}`);
    console.log(`   Verdeeld over ${assignmentMap.size} medewerkers`);
    
    return assignmentMap;
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen assignments:', error);
    return new Map();
  }
}

/** Bulk alle NB assignments voor rooster */
export async function getNBAssignmentsByRosterId(rosterId: string): Promise<Map<string, Set<string>>> {
  try {
    console.log('🔍 Bulk load NB assignments voor roster:', rosterId);
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('employee_id, date')
      .eq('roster_id', rosterId)
      .eq('service_code', 'NB');
    
    if (error) {
      console.error('❌ Fout bij bulk ophalen NB assignments:', error);
      throw error;
    }
    
    const nbMap = new Map<string, Set<string>>();
    (data || []).forEach(row => {
      if (!nbMap.has(row.employee_id)) nbMap.set(row.employee_id, new Set());
      nbMap.get(row.employee_id)!.add(row.date);
    });
    
    console.log(`✅ Loaded ${data?.length || 0} NB assignments voor roster ${rosterId}`);
    console.log(`   Verdeeld over ${nbMap.size} medewerkers`);
    
    return nbMap;
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen NB:', error);
    return new Map();
  }
}