// ... (bovenliggende imports zijn identiek)

// ... andere bestaande code ...

export async function autofillUnavailability(rosterId: string, start_date: string): Promise<boolean> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 START: autofillUnavailability (Optie A FIX)');
  console.log('='.repeat(80));
  console.log('📋 Parameters:', { rosterId, start_date });
  
  try {
    const designData = await loadRosterDesignData(rosterId);
    if (!designData) { 
      console.error('❌ FOUT: Geen designData gevonden voor rosterId:', rosterId);
      return false; 
    }
    
    console.log('✅ DesignData geladen:', {
      rosterId: designData.rosterId,
      aantalMedewerkers: designData.employees.length
    });
    
    const startDate = new Date(start_date + 'T00:00:00');
    console.log('📅 Periode:', {
      start: start_date,
      dagen: 35,
      eind: new Date(startDate.getTime() + 34 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    
    // Analyseer roostervrijDagen data
    const medewerkersMetRoostervrijDagen = designData.employees.filter(
      emp => (emp as any).roostervrijDagen && (emp as any).roostervrijDagen.length > 0
    );
    
    console.log('\n📊 Roostervrij dagen analyse:');
    console.log('   Totaal medewerkers:', designData.employees.length);
    console.log('   Met roostervrijDagen:', medewerkersMetRoostervrijDagen.length);
    
    if (medewerkersMetRoostervrijDagen.length === 0) {
      console.warn('⚠️  WAARSCHUWING: Geen enkele medewerker heeft roostervrijDagen ingesteld!');
      console.warn('   → Geen NB records zullen worden aangemaakt');
      console.warn('   → Check medewerkers configuratie in de app');
      return true; // Niet een fout, gewoon geen data
    }
    
    // Log detail per medewerker
    medewerkersMetRoostervrijDagen.forEach(emp => {
      console.log(`   • ${(emp as any).voornaam}: ${(emp as any).roostervrijDagen.join(', ')}`);
    });
    
    let totalNBCreated = 0;
    let totalErrors = 0;
    console.log('\n🔄 Start NB bulk insert...');
    console.log('-'.repeat(80));
    for (const emp of designData.employees) {
      const roostervrijDagen: string[] = (emp as any).roostervrijDagen || [];
      if (!roostervrijDagen.length) continue;
      if (!designData.unavailabilityData[emp.id]) { designData.unavailabilityData[emp.id] = {}; }
      console.log(`\n👤 Medewerker: ${(emp as any).voornaam} (${emp.id})`);
      console.log(`   Roostervrij dagen: ${roostervrijDagen.join(', ')}`);
      let nbCountForEmployee = 0;
      for (let i = 0; i < 35; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dagCode = getWeekdayCode(currentDate);
        const dateISO = currentDate.toISOString().split('T')[0];
        const isRoostervrijDag = roostervrijDagen.includes(dagCode);
        if (isRoostervrijDag) {
          // ✅ GEBRUIK originalEmployeeId indien aanwezig
          const employeeId = (emp as any).originalEmployeeId || emp.id;
          console.log(`   📍 NB insert (${employeeId}): ${dateISO} (${dagCode})`);
          try {
            const result = await upsertNBAssignment(rosterId, employeeId, dateISO);
            if (result && result.id) {
              console.log(`      ✅ Success - ID: ${result.id}`);
              nbCountForEmployee++;
              totalNBCreated++;
              if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
                designData.unavailabilityData[emp.id][dateISO] = true;
              }
            } else {
              console.error(`      ❌ FOUT: Geen resultaat van upsertNBAssignment`);
              totalErrors++;
            }
          } catch (error) {
            console.error(`      ❌ EXCEPTION bij NB insert:`, error);
            totalErrors++;
          }
        } else {
          if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
            designData.unavailabilityData[emp.id][dateISO] = false;
          }
        }
      }
      console.log(`   📊 Totaal NB voor deze medewerker: ${nbCountForEmployee}`);
    }
    const jsonSaved = await saveRosterDesignData(designData);
    console.log('\n' + '='.repeat(80));
    console.log('✅ EIND: autofillUnavailability (Optie A FIX)');
    console.log('='.repeat(80));
    console.log('📊 STATISTIEKEN:');
    console.log(`   Totaal NB records aangemaakt: ${totalNBCreated}`);
    console.log(`   Totaal errors: ${totalErrors}`);
    console.log(`   JSON data opgeslagen: ${jsonSaved ? 'Ja' : 'Nee'}`);
    console.log('='.repeat(80) + '\n');
    if (totalErrors > 0) {
      console.error(`⚠️  WAARSCHUWING: ${totalErrors} errors tijdens NB initialisatie!`);
      console.error('   Check Supabase logs en database permissions');
    }
    if (totalNBCreated === 0 && medewerkersMetRoostervrijDagen.length > 0) {
      console.error('❌ KRITIEK: Geen NB records aangemaakt terwijl medewerkers roostervrijDagen hebben!');
      console.error('   Dit wijst op een database probleem');
    }
    return jsonSaved;
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ FATALE FOUT in autofillUnavailability (Optie A FIX)');
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('='.repeat(80) + '\n');
    throw error; 
  }
}
// ... overige code blijft ongewijzigd ...
