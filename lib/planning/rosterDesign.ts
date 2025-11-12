export async function toggleNBAssignment(
  rosterId: string,
  employeeId: string,
  date: string
): Promise<boolean> {
  try {
    if (!rosterId || !employeeId || !date || typeof rosterId !== 'string' || typeof employeeId !== 'string' || typeof date !== 'string') {
      console.error("🛑 toggleNBAssignment: ongeldige input", { rosterId, employeeId, date });
      throw new Error("NB toggle: ongeldige input");
    }
    // Check huidige status
    const isCurrentlyNB = await isEmployeeUnavailableOnDate(
      rosterId,
      employeeId,
      date
    );
    console.log("🔍 NB toggle params", { rosterId, employeeId, date, isCurrentlyNB });
    if (isCurrentlyNB) {
      await deleteAssignmentByDate(rosterId, employeeId, date);
      console.log('✅ NB verwijderd - medewerker beschikbaar gemaakt:', { employeeId, date });
      return true;
    } else {
      const result = await upsertNBAssignment(rosterId, employeeId, date);
      if (!result || !result.id) {
        console.error('🛑 NB upsert faalt: geen resultaat', { rosterId, employeeId, date, result });
        throw new Error('NB opslag is mislukt');
      }
      console.log('✅ NB toegevoegd - medewerker niet-beschikbaar gemaakt:', { employeeId, date, newId: result.id });
      return true;
    }
  } catch (error) {
    console.error('❌ Fout bij toggle NB assignment:', error);
    return false;
  }
}
