import {
  getPrePlanningData,
  savePrePlanningAssignment,
  deletePrePlanningAssignment,
  getEmployeesWithServices,
  updateAssignmentStatus // TOEGEVOEGD
} from '@/lib/services/preplanning-storage';

...

const handleModalSave = useCallback(async (serviceId: string | null, status: CellStatus) => {
  if (!selectedCell || !rosterId) return;
  try {
    setIsSaving(true);

    let success = false;

    // Status 0: Delete assignment (cel leeg maken)
    if (status === 0) {
      console.log('[PrePlanning] Deleting assignment (status 0)...');
      success = await deletePrePlanningAssignment(
        rosterId,
        selectedCell.employeeId,
        selectedCell.date,
        selectedCell.dagdeel
      );
    }
    // Status 1, 2, 3: Update assignment status
    else {
      console.log(`[PrePlanning] Updating assignment (status ${status})...`);
      success = await updateAssignmentStatus(
        rosterId,
        selectedCell.employeeId,
        selectedCell.date,
        selectedCell.dagdeel,
        status,
        serviceId
      );
    }

    if (!success) {
      throw new Error('Database operatie mislukt');
    }

    console.log('[PrePlanning] Save successful, reloading grid data...');

    // Herlaad assignments data voor grid refresh
    if (startDate && endDate) {
      const updatedAssignments = await getPrePlanningData(rosterId, startDate, endDate);
      setAssignments(updatedAssignments);
      console.log(`[PrePlanning] Grid refreshed: ${updatedAssignments.length} assignments`);
    }

    // Sluit modal na succesvolle save
    setModalOpen(false);
    setSelectedCell(null);

    // Succes feedback later met toast, nu alleen console graag
  } catch (error) {
    console.error('[PrePlanning] Error saving assignment:', error);
    alert('Fout bij opslaan dienst. Probeer opnieuw.');
  } finally {
    setIsSaving(false);
  }
}, [selectedCell, rosterId, startDate, endDate]);

...

<DienstSelectieModal
  isOpen={modalOpen}
  cellData={selectedCell}
  onClose={() => {
    setModalOpen(false);
    setSelectedCell(null);
  }}
  onSave={handleModalSave}
  readOnly={rosterStatus === 'final'}
  isSaving={isSaving} // TOEGEVOEGD
/>
