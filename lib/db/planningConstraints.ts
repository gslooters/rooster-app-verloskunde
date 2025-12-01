// Database helper functions voor planning constraints
// Supabase queries voor planning_constraints tabel
// DRAAD95C Database Table Name Fix

import { supabase } from '@/lib/supabase';
import { PlanningConstraint, CreateConstraintRequest, UpdateConstraintRequest } from '@/lib/types/planning-constraint';

/**
 * Haal alle planning constraints op, gesorteerd op priority
 */
export async function getAllPlanningConstraints(): Promise<PlanningConstraint[]> {
  const { data, error } = await supabase
    .from('planning_constraints')
    .select('*')
    .order('priority', { ascending: true })
    .order('naam', { ascending: true });

  if (error) {
    console.error('Error fetching planning constraints:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal één planning constraint op via ID
 */
export async function getPlanningConstraintById(id: string): Promise<PlanningConstraint | null> {
  const { data, error } = await supabase
    .from('planning_constraints')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Maak nieuwe planning constraint
 */
export async function createPlanningConstraint(request: CreateConstraintRequest): Promise<PlanningConstraint> {
  const { data, error } = await supabase
    .from('planning_constraints')
    .insert([request])
    .select()
    .single();

  if (error) {
    console.error('Error creating planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Update bestaande planning constraint
 */
export async function updatePlanningConstraint(
  id: string,
  updates: Partial<UpdateConstraintRequest>
): Promise<PlanningConstraint> {
  const { data, error } = await supabase
    .from('planning_constraints')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Verwijder planning constraint
 */
export async function deletePlanningConstraint(id: string): Promise<void> {
  const { error } = await supabase
    .from('planning_constraints')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting planning constraint:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Toggle actief status van planning constraint
 */
export async function togglePlanningConstraintActive(
  id: string,
  actief: boolean
): Promise<PlanningConstraint> {
  return updatePlanningConstraint(id, { actief });
}
