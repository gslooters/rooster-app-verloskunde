async function toggleUnavailableHandler(empId: string, date: string) {
  if (!rosterId || !designData) {
    console.error('🛑 No rosterId or designData');
    return;
  }

  if (typeof rosterId !== 'string' || typeof empId !== 'string') {
    console.error('🛑 Invalid types:', { rosterId: typeof rosterId, empId: typeof empId });
    return;
  }

  console.log('🔍 Toggle called:', { rosterId, empId, date });

  try {
    const success = await toggleNBAssignment(rosterId, empId, date);

    if (!success) {
      console.error('🛑 Toggle failed');
      alert('NB opslaan mislukt. Check console.');
      return;
    }

    // Reload NB assignments from database
    const nbMap = await getNBAssignmentsByRosterId(rosterId);
    setNbAssignments(nbMap);

    console.log('✅ NB toggle succeeded, UI updated');
  } catch (error) {
    console.error('❌ Toggle exception:', error);
    alert('Fout: ' + error);
  }
}
