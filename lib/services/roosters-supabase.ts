import { supabase } from '@/lib/supabase';

export interface Roster {
  id: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'in_progress' | 'final';
  created_at: string;
  updated_at?: string;
}

export interface CreateRosterInput {
  start_date: string;
  end_date: string;
  status?: 'draft' | 'in_progress' | 'final';
}

export interface UpdateRosterInput {
  start_date?: string;
  end_date?: string;
  status?: 'draft' | 'in_progress' | 'final';
}

/**
 * Haal alle roosters op uit Supabase
 * @returns Array van roosters, gesorteerd op created_at (nieuwste eerst)
 */
export async function getAllRoosters(): Promise<Roster[]> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error bij ophalen roosters:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Fout bij ophalen roosters:', error);
    throw error;
  }
}

/**
 * Haal een specifiek rooster op basis van ID
 * @param id - Rooster ID
 * @returns Rooster object of null als niet gevonden
 */
export async function getRosterById(id: string): Promise<Roster | null> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('❌ Supabase error bij ophalen rooster:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Fout bij ophalen rooster:', error);
    throw error;
  }
}

/**
 * Zoek een rooster op basis van datum range
 * @param startDate - Start datum (YYYY-MM-DD)
 * @param endDate - Eind datum (YYYY-MM-DD)
 * @returns Rooster object of null als niet gevonden
 */
export async function getRosterByDateRange(
  startDate: string,
  endDate: string
): Promise<Roster | null> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .select('*')
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error bij zoeken rooster op datum:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Fout bij zoeken rooster op datum:', error);
    throw error;
  }
}

/**
 * Haal roosters op binnen een specifieke datum range
 * @param fromDate - Vanaf datum (YYYY-MM-DD)
 * @param toDate - Tot datum (YYYY-MM-DD)
 * @returns Array van roosters binnen de datum range
 */
export async function getRostersByDateRange(
  fromDate: string,
  toDate: string
): Promise<Roster[]> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .select('*')
      .gte('start_date', fromDate)
      .lte('end_date', toDate)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('❌ Supabase error bij ophalen roosters op range:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Fout bij ophalen roosters op range:', error);
    throw error;
  }
}

/**
 * Maak een nieuw rooster aan
 * @param input - Rooster data (zonder id en timestamps)
 * @returns Nieuw aangemaakt rooster
 */
export async function createRooster(input: CreateRosterInput): Promise<Roster> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .insert({
        start_date: input.start_date,
        end_date: input.end_date,
        status: input.status || 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error bij aanmaken rooster:', error);
      throw error;
    }

    console.log('✅ Rooster succesvol aangemaakt:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Fout bij aanmaken rooster:', error);
    throw error;
  }
}

/**
 * Update een bestaand rooster
 * @param id - Rooster ID
 * @param updates - Te updaten velden
 * @returns Geüpdatet rooster
 */
export async function updateRooster(
  id: string,
  updates: UpdateRosterInput
): Promise<Roster> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error bij updaten rooster:', error);
      throw error;
    }

    console.log('✅ Rooster succesvol geüpdatet:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Fout bij updaten rooster:', error);
    throw error;
  }
}

/**
 * Verwijder een rooster (en gerelateerde data via CASCADE)
 * @param id - Rooster ID
 * @returns true als succesvol verwijderd
 */
export async function deleteRooster(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('roosters').delete().eq('id', id);

    if (error) {
      console.error('❌ Supabase error bij verwijderen rooster:', error);
      throw error;
    }

    console.log('✅ Rooster succesvol verwijderd:', id);
    return true;
  } catch (error) {
    console.error('❌ Fout bij verwijderen rooster:', error);
    throw error;
  }
}

/**
 * Update de status van een rooster
 * @param id - Rooster ID
 * @param status - Nieuwe status
 * @returns Geüpdatet rooster
 */
export async function updateRosterStatus(
  id: string,
  status: 'draft' | 'in_progress' | 'final'
): Promise<Roster> {
  return updateRooster(id, { status });
}

/**
 * Haal roosters op gefilterd op status
 * @param status - Status filter
 * @returns Array van roosters met opgegeven status
 */
export async function getRostersByStatus(
  status: 'draft' | 'in_progress' | 'final'
): Promise<Roster[]> {
  try {
    const { data, error } = await supabase
      .from('roosters')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error bij ophalen roosters op status:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Fout bij ophalen roosters op status:', error);
    throw error;
  }
}
