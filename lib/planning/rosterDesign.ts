export async function autofillUnavailability(rosterId: string, start_date: string): Promise<boolean> {
  const designData = await loadRosterDesignData(rosterId);
  if (!designData) { return false; }
  const startDate = new Date(start_date + 'T00:00:00');
  for (const emp of designData.employees) {
    const roostervrijDagen: string[] = (emp as any).roostervrijDagen || [];
    if (!roostervrijDagen.length) continue;
    if (!designData.unavailabilityData[emp.id]) { designData.unavailabilityData[emp.id] = {}; }
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dagCode = getWeekdayCode(currentDate);
      const dateISO = currentDate.toISOString().split('T')[0];
      const isRoostervrijDag = roostervrijDagen.includes(dagCode);
      if (isRoostervrijDag) {
        // ✅ Vul NB in database bij
        await upsertNBAssignment(rosterId, emp.id, dateISO);
        if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = true;
        }
      } else {
        if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = false;
        }
      }
    }
  }
  return await saveRosterDesignData(designData);
}
