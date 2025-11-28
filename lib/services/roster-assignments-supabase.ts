import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & ENUMS - DRAAD68
// ============================================================================

/**
 * Assignment Status Enum
 * 0 = Beschikbaar (available for assignment)
 * 1 = Ingepland (assigned with service)
 * 2 = Geblokkeerd (blocked)
 * 3 = NB (niet beschikbaar / not available)
 */
export enum AssignmentStatus {
  AVAILABLE = 0,
  ASSIGNED = 1,
  BLOCKED = 2,
  NOT_AVAILABLE = 3
}

/**
 * Dagdeel Type
 * O = Ochtend (morning)
 * M = Middag (afternoon)
 * A = Avond/Nacht (evening/night)
 */
export type Dagdeel = 'O' | 'M' | 'A';

/**
 * Dagdeel Labels voor UI
 */
export const DAGDEEL_LABELS: Record<Dagdeel, string> = {
  'O': 'Ochtend',
  'M': 'Middag',
  'A': 'Avond/Nacht'
};

/**
 * RosterAssignment Interface - DRAAD68 Updated
 * Nieuwe structuur met dagdeel, status en service_id ipv service_code
 */
export interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: Dagdeel;
  status: AssignmentStatus;
  service_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input voor het aanmaken van een nieuwe assignment
 */
export interface CreateRosterAssignmentInput {
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: Dagdeel;
  status: AssignmentStatus;
  service_id?: string | null;
  notes?: string | null;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Haal alle assignments op voor een rooster, optioneel gefilterd op dagdeel
 * @param rosterId - UUID van het rooster
 * @param dagdeel - Optioneel: filter op specifiek dagdeel
 */
export async function getAssignmentsByRosterId(
  rosterId: string,
  dagdeel?: Dagdeel
): Promise<RosterAssignment[]> {
  try {
    let query = supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId);
    
    if (dagdeel) {
      query = query.eq('dagdeel', dagdeel);
    }
    
    const { data, error } = await query.order('date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij assignments ophalen:', error);
    throw error;
  }
}

/**
 * DRAAD68: Haal specifieke assignment op voor medewerker op datum en dagdeel
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum in ISO formaat (YYYY-MM-DD)
 * @param dagdeel - Dagdeel ('O', 'M', 'A')
 * @returns RosterAssignment object of null
 */
export async function getAssignmentByDate(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<RosterAssignment | null> {
  try {
    console.log('🔍 Get assignment by date:', { rosterId, employeeId, date, dagdeel });
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Fout bij ophalen assignment:', error);
      return null;
    }
    
    if (data) {
      console.log('✅ Assignment gevonden:', {
        id: data.id,
        dagdeel: data.dagdeel,
        status: data.status,
        service_id: data.service_id,
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

/**
 * DRAAD68: Check of medewerker NB (status=3) heeft op specifieke datum/dagdeel
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum in ISO formaat
 * @param dagdeel - Dagdeel
 * @returns true als status = 3 (NB)
 */
export async function isEmployeeUnavailableOnDate(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('status')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST116') return false;
      console.error('❌ Fout bij check unavailability:', error);
      return false;
    }
    
    return data?.status === AssignmentStatus.NOT_AVAILABLE;
  } catch (error) {
    console.error('❌ Fout bij unavailability check:', error);
    return false;
  }
}

/**
 * DRAAD68: Verwijder assignment op specifieke datum en dagdeel
 * 
 * @param rosterId - UUID van het rooster
 * @param employeeId - TEXT ID van de medewerker
 * @param date - Datum in ISO formaat
 * @param dagdeel - Dagdeel
 */
export async function deleteAssignmentByDate(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel
): Promise<boolean> {
  try {
    console.log('🔍 Delete assignment:', { rosterId, employeeId, date, dagdeel });
    
    const { error } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel);
    
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

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * DRAAD68: BULK LOAD ALLE ASSIGNMENTS voor Unavailability scherm
 * Retourneert Map<employeeId, Map<date, Map<dagdeel, assignment>>>
 * 
 * @param rosterId - UUID van het rooster
 * @returns Nested map: employee → date → dagdeel → assignment
 */
export async function getAllAssignmentsByRosterId(
  rosterId: string
): Promise<Map<string, Map<string, Map<Dagdeel, RosterAssignment>>>> {
  try {
    console.log('🔍 Bulk load ALL assignments voor roster:', rosterId);
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('❌ Fout bij bulk ophalen assignments:', error);
      throw error;
    }
    
    const assignmentMap = new Map<string, Map<string, Map<Dagdeel, RosterAssignment>>>();
    
    (data || []).forEach(row => {
      if (!assignmentMap.has(row.employee_id)) {
        assignmentMap.set(row.employee_id, new Map());
      }
      
      const employeeMap = assignmentMap.get(row.employee_id)!;
      
      if (!employeeMap.has(row.date)) {
        employeeMap.set(row.date, new Map());
      }
      
      const dateMap = employeeMap.get(row.date)!;
      dateMap.set(row.dagdeel as Dagdeel, row as RosterAssignment);
    });
    
    console.log(`✅ Loaded ${data?.length || 0} total assignments voor roster ${rosterId}`);
    console.log(`   Verdeeld over ${assignmentMap.size} medewerkers`);
    
    return assignmentMap;
  } catch (error) {
    console.error('❌ Fout bij bulk ophalen assignments:', error);
    return new Map();
  }
}

/**
 * DRAAD68: Bulk alle NB assignments (status=3) voor rooster
 * Retourneert Map<employeeId, Set<date>> (zonder dagdeel detail)
 * 
 * @param rosterId - UUID van het rooster
 * @returns Map: employee → set van dates met NB status
 */
export async function getNBAssignmentsByRosterId(
  rosterId: string
): Promise<Map<string, Set<string>>> {
  try {
    console.log('🔍 Bulk load NB assignments voor roster:', rosterId);
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel')
      .eq('roster_id', rosterId)
      .eq('status', AssignmentStatus.NOT_AVAILABLE);
    
    if (error) {
      console.error('❌ Fout bij bulk ophalen NB assignments:', error);
      throw error;
    }
    
    const nbMap = new Map<string, Set<string>>();
    
    (data || []).forEach(row => {
      if (!nbMap.has(row.employee_id)) {
        nbMap.set(row.employee_id, new Set());
      }
      // Voeg datum toe aan set (ongeacht dagdeel)
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

// ============================================================================
// NIEUWE FUNCTIES - DRAAD68
// ============================================================================

/**
 * Maak rooster aan inclusief alle assignments via stored procedure
 * Gebruikt initialize_roster_assignments() uit DRAAD67
 * 
 * @param startDate - Start datum in ISO formaat (YYYY-MM-DD)
 * @param employeeIds - Array van employee IDs
 * @returns Object met rosterId en aantal aangemaakte assignments
 */
export async function createRosterWithAssignments(
  startDate: string,
  employeeIds: string[]
): Promise<{ rosterId: string; assignmentCount: number }> {
  try {
    console.log('🔄 Creating roster with assignments via stored procedure');
    console.log(`   Start date: ${startDate}`);
    console.log(`   Employees: ${employeeIds.length}`);
    
    // Eerst rooster aanmaken
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .insert({
        start_date: startDate,
        status: 'draft'
      })
      .select()
      .single();
    
    if (rosterError) throw rosterError;
    
    const rosterId = roster.id;
    console.log(`✅ Rooster created: ${rosterId}`);
    
    // Dan stored procedure aanroepen om assignments aan te maken
    const { data, error } = await supabase.rpc('initialize_roster_assignments', {
      p_roster_id: rosterId,
      p_start_date: startDate,
      p_employee_ids: employeeIds
    });
    
    if (error) {
      console.error('❌ Stored procedure failed:', error);
      throw error;
    }
    
    const assignmentCount = data || 0;
    console.log(`✅ Created ${assignmentCount} assignments`);
    console.log(`   Expected: ${employeeIds.length * 35 * 3} (${employeeIds.length} emp × 35 days × 3 dagdelen)`);
    
    return { rosterId, assignmentCount };
  } catch (error) {
    console.error('❌ Fout bij createRosterWithAssignments:', error);
    throw error;
  }
}

/**
 * Update status van een assignment
 * 
 * @param assignmentId - UUID van de assignment
 * @param status - Nieuwe status (0-3)
 * @param serviceId - Optioneel: service UUID (required als status=1)
 */
export async function updateAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
  serviceId?: string | null
): Promise<void> {
  try {
    console.log('🔄 Update assignment status:', { assignmentId, status, serviceId });
    
    const updateData: any = { status };
    
    // Als status = ASSIGNED (1), moet service_id gezet worden
    if (status === AssignmentStatus.ASSIGNED) {
      if (!serviceId) {
        throw new Error('service_id is required when status = ASSIGNED');
      }
      updateData.service_id = serviceId;
    }
    
    // Als status != ASSIGNED, clear service_id
    if (status !== AssignmentStatus.ASSIGNED) {
      updateData.service_id = null;
    }
    
    const { error } = await supabase
      .from('roster_assignments')
      .update(updateData)
      .eq('id', assignmentId);
    
    if (error) throw error;
    
    console.log('✅ Status updated successfully');
  } catch (error) {
    console.error('❌ Fout bij updateAssignmentStatus:', error);
    throw error;
  }
}

/**
 * Update service van een assignment (en zet status automatisch op ASSIGNED)
 * 
 * @param assignmentId - UUID van de assignment
 * @param serviceId - Service UUID (null = clear assignment, status→AVAILABLE)
 */
export async function updateAssignmentService(
  assignmentId: string,
  serviceId: string | null
): Promise<void> {
  try {
    console.log('🔄 Update assignment service:', { assignmentId, serviceId });
    
    const updateData: any = {
      service_id: serviceId,
      status: serviceId ? AssignmentStatus.ASSIGNED : AssignmentStatus.AVAILABLE
    };
    
    const { error } = await supabase
      .from('roster_assignments')
      .update(updateData)
      .eq('id', assignmentId);
    
    if (error) throw error;
    
    console.log('✅ Service updated successfully');
  } catch (error) {
    console.error('❌ Fout bij updateAssignmentService:', error);
    throw error;
  }
}

/**
 * Haal assignments op gefilterd op status
 * 
 * @param rosterId - UUID van het rooster
 * @param status - Status filter (0-3)
 * @returns Array van assignments met deze status
 */
export async function getAssignmentsByStatus(
  rosterId: string,
  status: AssignmentStatus
): Promise<RosterAssignment[]> {
  try {
    console.log('🔍 Get assignments by status:', { rosterId, status });
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('*')
      .eq('roster_id', rosterId)
      .eq('status', status)
      .order('date', { ascending: true })
      .order('employee_id', { ascending: true })
      .order('dagdeel', { ascending: true });
    
    if (error) throw error;
    
    console.log(`✅ Found ${data?.length || 0} assignments with status ${status}`);
    
    return data || [];
  } catch (error) {
    console.error('❌ Fout bij getAssignmentsByStatus:', error);
    throw error;
  }
}

/**
 * Bulk update meerdere assignments in één keer
 * 
 * @param updates - Array van update objecten met id en velden om te updaten
 */
export async function bulkUpdateAssignments(
  updates: Array<{
    id: string;
    status?: AssignmentStatus;
    service_id?: string | null;
    notes?: string | null;
  }>
): Promise<void> {
  try {
    console.log(`🔄 Bulk update ${updates.length} assignments`);
    
    // Voer updates sequentieel uit (Supabase heeft geen native bulk update)
    for (const update of updates) {
      const { id, ...fields } = update;
      
      const { error } = await supabase
        .from('roster_assignments')
        .update(fields)
        .eq('id', id);
      
      if (error) {
        console.error(`❌ Failed to update assignment ${id}:`, error);
        throw error;
      }
    }
    
    console.log('✅ Bulk update completed successfully');
  } catch (error) {
    console.error('❌ Fout bij bulkUpdateAssignments:', error);
    throw error;
  }
}

/**
 * LEGACY SUPPORT: Maak nieuwe assignment aan (backwards compatible)
 * Voor bestaande code die nog direct assignments maakt
 */
export async function createAssignment(
  input: CreateRosterAssignmentInput
): Promise<RosterAssignment> {
  try {
    console.log('🔄 Creating assignment:', input);
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .insert(input)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Assignment created:', data.id);
    
    return data as RosterAssignment;
  } catch (error) {
    console.error('❌ Fout bij createAssignment:', error);
    throw error;
  }
}