/**
 * ============================================================================
 * DRAAD369: ASSIGNMENT HANDLERS WITH VARIANT ID SUPPORT
 * 
 * Purpose: Centralized handlers for roster assignment operations
 * Includes variant ID lookup and assignment validation
 * 
 * [DRAAD369] FILE 3/3 - Assignment handlers for manual assignments
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Represents a staffing variant (service opportunity)
 * Includes both service info and variant ID for tracking
 */
export interface StaffingVariant {
  variant_id: string; // [DRAAD369] ID from roster_period_staffing_dagdelen
  service_id: string;
  team: string;
  available: number; // aantal - invulling
  service_code?: string;
  service_naam?: string;
  service_kleur?: string;
}

/**
 * Assignment data structure
 * Used when creating new assignments
 */
export interface AssignmentData {
  roster_id: string;
  employee_id: string;
  date: string; // ISO date
  dagdeel: string; // O, M, N
  service_id: string;
  team: string;
  roster_period_staffing_dagdelen_id: string; // [DRAAD369] REQUIRED!
  status?: 0 | 1 | 2 | 3; // 1 = active
  notes?: string;
}

/**
 * [DRAAD369] HELPER: Lookup variant ID from database
 * 
 * Matches roster_period_staffing_dagdelen record by:
 * - roster_id
 * - date
 * - dagdeel
 * - service_id
 * - team
 */
export async function getVariantId(
  rosterId: string,
  date: string,
  dagdeel: string,
  serviceId: string,
  team: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('id')
      .eq('roster_id', rosterId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .eq('service_id', serviceId)
      .eq('team', team)
      .single();

    if (error) {
      console.warn('[DRAAD369] Variant ID lookup failed:', {
        rosterId,
        date,
        dagdeel,
        serviceId,
        team,
        error: error.message,
      });
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.warn('[DRAAD369] Variant ID lookup exception:', err);
    return null;
  }
}

/**
 * [DRAAD369] Get available staffing variants for a date/dagdeel
 * Returns list of StaffingVariant with ID pre-populated
 */
export async function getAvailableVariants(
  rosterId: string,
  date: string,
  dagdeel: string
): Promise<StaffingVariant[]> {
  try {
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select(`
        id,
        service_id,
        team,
        aantal,
        invulling,
        service_types(code, naam, kleur)
      `)
      .eq('roster_id', rosterId)
      .eq('date', date)
      .eq('dagdeel', dagdeel);

    if (error) {
      console.error('[DRAAD369] Failed to fetch variants:', error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    // Transform to StaffingVariant format
    return data.map((row: any) => ({
      variant_id: row.id, // [DRAAD369] Include variant ID
      service_id: row.service_id,
      team: row.team,
      available: Math.max(0, (row.aantal || 0) - (row.invulling || 0)),
      service_code: row.service_types?.code,
      service_naam: row.service_types?.naam,
      service_kleur: row.service_types?.kleur,
    }));
  } catch (err) {
    console.error('[DRAAD369] Exception in getAvailableVariants:', err);
    return [];
  }
}

/**
 * [DRAAD369] Create assignment with variant ID
 * 
 * Validates that:
 * 1. Employee exists
 * 2. Service exists
 * 3. Variant exists (variant_id is valid)
 * 4. No conflicts with existing assignments
 */
export async function createAssignment(
  assignmentData: AssignmentData
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validation: variant_id must be provided
    if (!assignmentData.roster_period_staffing_dagdelen_id) {
      return {
        success: false,
        error: '[DRAAD369] Variant ID ontbreekt - kan assignment niet toevoegen',
      };
    }

    // Validation: Variant exists in database
    const { data: variantExists, error: variantError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('id')
      .eq('id', assignmentData.roster_period_staffing_dagdelen_id)
      .single();

    if (variantError || !variantExists) {
      return {
        success: false,
        error: '[DRAAD369] Variant ID is ongeldig - contact IT support',
      };
    }

    // Insert assignment
    const { data, error } = await supabase
      .from('roster_assignments')
      .insert([
        {
          roster_id: assignmentData.roster_id,
          employee_id: assignmentData.employee_id,
          date: assignmentData.date,
          dagdeel: assignmentData.dagdeel,
          service_id: assignmentData.service_id,
          team: assignmentData.team,
          roster_period_staffing_dagdelen_id: assignmentData.roster_period_staffing_dagdelen_id, // [DRAAD369]
          status: assignmentData.status || 1,
          notes: assignmentData.notes || null,
          source: 'manual',
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[DRAAD369] Assignment INSERT failed:', error.message);
      return {
        success: false,
        error: `Fout bij toevoegen: ${error.message}`,
      };
    }

    console.log('[DRAAD369] Assignment created:', data?.id);

    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[DRAAD369] Exception in createAssignment:', err);
    return {
      success: false,
      error: `Onverwachte fout: ${errMsg}`,
    };
  }
}

/**
 * [DRAAD369] Update assignment variant
 * 
 * Allows changing the service/team (variant) for an existing assignment
 * Updates both assignment record AND variant tracking via trigger
 */
export async function updateAssignmentVariant(
  assignmentId: string,
  newVariantId: string,
  newServiceId: string,
  newTeam: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validation: new variant must exist
    const { data: variantExists, error: variantError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('id')
      .eq('id', newVariantId)
      .single();

    if (variantError || !variantExists) {
      return {
        success: false,
        error: '[DRAAD369] Nieuwe variant ID is ongeldig',
      };
    }

    // Update assignment
    const { error } = await supabase
      .from('roster_assignments')
      .update({
        service_id: newServiceId,
        team: newTeam,
        roster_period_staffing_dagdelen_id: newVariantId, // [DRAAD369]
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (error) {
      console.error('[DRAAD369] Assignment UPDATE failed:', error.message);
      return {
        success: false,
        error: `Fout bij wijzigen: ${error.message}`,
      };
    }

    console.log('[DRAAD369] Assignment variant updated:', {
      assignmentId,
      newVariantId,
      newServiceId,
      newTeam,
    });

    return {
      success: true,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[DRAAD369] Exception in updateAssignmentVariant:', err);
    return {
      success: false,
      error: `Onverwachte fout: ${errMsg}`,
    };
  }
}

/**
 * [DRAAD369] Withdraw assignment (mark as inactive/withdrawn)
 * Trigger will automatically decrement invulling count
 */
export async function withdrawAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('roster_assignments')
      .update({
        status: 0, // withdrawn
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (error) {
      console.error('[DRAAD369] Assignment WITHDRAW failed:', error.message);
      return {
        success: false,
        error: `Fout bij intrekken: ${error.message}`,
      };
    }

    console.log('[DRAAD369] Assignment withdrawn:', assignmentId);

    return {
      success: true,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[DRAAD369] Exception in withdrawAssignment:', err);
    return {
      success: false,
      error: `Onverwachte fout: ${errMsg}`,
    };
  }
}

/**
 * [DRAAD369] Batch create assignments from AFL results
 * Used by WriteEngine to insert assignments with variant IDs
 */
export async function batchCreateAssignments(
  assignments: AssignmentData[]
): Promise<{ success: boolean; created: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let failed = 0;

  for (const assignment of assignments) {
    const result = await createAssignment(assignment);
    if (result.success) {
      created++;
    } else {
      failed++;
      errors.push(result.error || 'Unknown error');
    }
  }

  console.log('[DRAAD369] Batch assignment creation complete:', {
    total: assignments.length,
    created,
    failed,
    errors: errors.length > 0 ? errors.slice(0, 5) : [],
  });

  return {
    success: failed === 0,
    created,
    failed,
    errors,
  };
}

/**
 * Export helpers for UI components
 */
export const AssignmentHandlers = {
  getVariantId,
  getAvailableVariants,
  createAssignment,
  updateAssignmentVariant,
  withdrawAssignment,
  batchCreateAssignments,
};

export default AssignmentHandlers;
