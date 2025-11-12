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

// ... alle bestaande exports ...

export async function deleteRoster(id: string): Promise<boolean> {
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

// ... alle bestaande exports ...