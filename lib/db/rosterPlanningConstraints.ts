// Database helper functions voor roster planning constraints
// Supabase queries voor roster_planning_constraints tabel
// DRAAD95C Database Table Name Fix

import { supabase } from '@/lib/supabase';
import { RosterPlanningConstraint, OverrideConstraintRequest } from '@/lib/types/planning-constraint';

/**
 * Haal alle planning constraints voor een specifiek rooster
 */
export async function getRosterPlanningConstraintsByRoosterId(
  roosterId: string
): Promise<RosterPlanningConstraint[]> {
  const { data, error } = await supabase
    .from('roster_planning_constraints')
    .select('*')
    .eq('rosterid', roosterId)
    .order('priority', { ascending: true })
    .order('naam', { ascending: true });

  if (error) {
    console.error('Error fetching roster planning constraints:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal één roster planning constraint op via ID
 */
export async function getRosterPlanningConstraintById(
  id: string
): Promise<RosterPlanningConstraint | null> {
  const { data, error } = await supabase
    .from('roster_planning_constraints')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching roster planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Update roster planning constraint (voor overrides)
 */
export async function updateRosterPlanningConstraint(
  id: string,
  updates: Partial<OverrideConstraintRequest>
): Promise<RosterPlanningConstraint> {
  // Zet isoverride op true als er wijzigingen zijn
  const updateData = {
    ...updates,
    isoverride: true,
  };

  const { data, error } = await supabase
    .from('roster_planning_constraints')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating roster planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Verwijder roster planning constraint (ad-hoc regel)
 */
export async function deleteRosterPlanningConstraint(id: string): Promise<void> {
  const { error } = await supabase
    .from('roster_planning_constraints')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting roster planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Reset override: zet constraint terug naar originele waarden
 */
export async function resetRosterPlanningConstraintToOriginal(
  id: string
): Promise<RosterPlanningConstraint> {
  // Haal eerst de constraint op
  const constraint = await getRosterPlanningConstraintById(id);
  if (!constraint) {
    throw new Error('Constraint not found');
  }

  // Als geen baseconstraintid, kan niet resetten
  if (!constraint.baseconstraintid) {
    throw new Error('Constraint heeft geen origineel om terug te zetten');
  }

  // Haal origineel op
  const { data: original, error: origError } = await supabase
    .from('planning_constraints')
    .select('*')
    .eq('id', constraint.baseconstraintid)
    .single();

  if (origError || !original) {
    throw new Error('Originele constraint niet gevonden');
  }

  // Update met originele waarden
  return updateRosterPlanningConstraint(id, {
    parameters: original.parameters,
    actief: original.actief,
    priority: original.priority,
    canrelax: original.canrelax,
    isoverride: false,
  });
}

/**
 * Maak ad-hoc roster planning constraint aan (zonder base)
 */
export async function createAdHocRosterPlanningConstraint(
  roosterId: string,
  constraintData: Omit<RosterPlanningConstraint, 'id' | 'rosterid' | 'createdat' | 'updatedat'>
): Promise<RosterPlanningConstraint> {
  const { data, error } = await supabase
    .from('roster_planning_constraints')
    .insert([{
      ...constraintData,
      rosterid: roosterId,
      baseconstraintid: null, // Ad-hoc heeft geen base
      isoverride: false, // Is geen override, maar nieuwe regel
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating ad-hoc roster planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}
