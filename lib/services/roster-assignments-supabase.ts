export async function upsertNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<RosterAssignment | null> {
  try {
    if (!rosterId || !employeeId || !date) {
      console.error('🛑 Invalid upsert input:', { rosterId, employeeId, date });
      return null;
    }
    console.log('🔍 Upsert NB:', { rosterId, employeeId, date });
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
      console.error('❌ Supabase error:', error);
      return null;
    }
    if (!data) {
      console.error('🛑 No data returned from upsert');
      return null;
    }
    console.log('✅ NB assignment created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Exception in upsertNBAssignment:', error);
    return null;
  }
}