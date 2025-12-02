// Database helper functions voor roster planning constraints
// Supabase queries voor roster_planning_constraints tabel
// DRAAD95C Database Table Name Fix
// DRAAD95E Column Name Fix: rosterid -> roster_id
// DRAAD96A Property Name Fix: baseconstraintid -> base_constraint_id

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
    .eq('roster_id', roosterId) // DRAAD95E: Fixed rosterid -> roster_id
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
    is_override: true, // DRAAD96A: Fixed isoverride -> is_override
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

  // Als geen base_constraint_id, kan niet resetten
  if (!constraint.base_constraint_id) { // DRAAD96A: Fixed baseconstraintid -> base_constraint_id
    throw new Error('Constraint heeft geen origineel om terug te zetten');
  }

  // Haal origineel op
  const { data: original, error: origError } = await supabase
    .from('planning_constraints')
    .select('*')
    .eq('id', constraint.base_constraint_id) // DRAAD96A: Fixed baseconstraintid -> base_constraint_id
    .single();

  if (origError || !original) {
    throw new Error('Originele constraint niet gevonden');
  }

  // Update met originele waarden
  return updateRosterPlanningConstraint(id, {
    parameters: original.parameters,
    actief: original.actief,
    priority: original.priority,
    can_relax: original.can_relax, // DRAAD96A: Fixed canrelax -> can_relax
    is_override: false, // DRAAD96A: Fixed isoverride -> is_override
  });
}

/**
 * Maak ad-hoc roster planning constraint aan (zonder base)
 */
export async function createAdHocRosterPlanningConstraint(
  roosterId: string,
  constraintData: Omit<RosterPlanningConstraint, 'id' | 'roster_id' | 'created_at' | 'updated_at'> // DRAAD96A: Fixed createdat/updatedat -> created_at/updated_at
): Promise<RosterPlanningConstraint> {
  const { data, error } = await supabase
    .from('roster_planning_constraints')
    .insert([{
      ...constraintData,
      roster_id: roosterId, // DRAAD95E: Fixed rosterid -> roster_id
      base_constraint_id: null, // DRAAD96A: Fixed baseconstraintid -> base_constraint_id - Ad-hoc heeft geen base
      is_override: false, // DRAAD96A: Fixed isoverride -> is_override - Is geen override, maar nieuwe regel
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating ad-hoc roster planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}
