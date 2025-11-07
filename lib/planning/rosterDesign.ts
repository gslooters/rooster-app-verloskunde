// ...rest of file boven deze functie ongewijzigd...

/**
 * Auto-fill NB (Niet Beschikbaar) voor alle medewerkers op basis van roostervrijDagen
 * 
 * Belangrijk: gebruik de roostervrijDagen uit de snapshot (emp), niet uit getAllEmployees/storage
 */
export function autofillUnavailability(rosterId: string, start_date: string): boolean {
  console.log('🚀 Auto-fill NB gestart voor rosterId:', rosterId, 'start_date:', start_date);

  const designData = loadRosterDesignData(rosterId);
  if (!designData) { 
    console.error('❌ Geen design data gevonden voor roster:', rosterId); 
    return false; 
  }

  const startDate = new Date(start_date + 'T00:00:00');
  let totalFilledCells = 0;
  let totalSkippedCells = 0;

  for (const emp of designData.employees) {
    // 🔥 CRITIEK: Gebruik de roostervrijDagen property uit de snapshot employee
    const roostervrijDagen: string[] = (emp as any).roostervrijDagen || [];
    if (!roostervrijDagen || roostervrijDagen.length === 0) {
      console.log(`👤 ${emp.name}: geen roostervrijDagen ingesteld`);
      continue;
    }

    console.log(`👤 ${emp.name}: roostervrijDagen = [${roostervrijDagen.join(', ')}]`);
    if (!designData.unavailabilityData[emp.id]) {
      designData.unavailabilityData[emp.id] = {};
    }

    let empFilledCells = 0;
    let empSkippedCells = 0;
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dagCode = getWeekdayCode(currentDate);
      const dateISO = currentDate.toISOString().split('T')[0];

      if (roostervrijDagen.includes(dagCode)) {
        const bestaandeWaarde = designData.unavailabilityData[emp.id][dateISO];
        if (bestaandeWaarde === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = true;
          empFilledCells++;
        } else {
          empSkippedCells++;
        }
      } else {
        if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = false;
        }
      }
    }
    console.log(`   ✅ Ingevuld: ${empFilledCells} NB cellen | ⏭️  Overgeslagen: ${empSkippedCells} (al ingesteld)`);
    totalFilledCells += empFilledCells;
    totalSkippedCells += empSkippedCells;
  }
  console.log(`✅ Auto-fill voltooid: ${totalFilledCells} NB cellen ingevuld, ${totalSkippedCells} overgeslagen (handmatig ingevoerd)`);
  return saveRosterDesignData(designData);
}

// ...rest van exports onderaan (ongewijzigd)...
