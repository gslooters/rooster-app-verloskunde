import { initializePeriodEmployeeStaffing } from '@/lib/services/period-employee-staffing';
// ... andere imports

async function createRosterConfirmed() {
  // ... bestaande code
  // Na roster design initialisatie
  await initializeRosterDesign(rosterId, selectedStart);

  // Init period_employee_staffing
  try {
    const allEmployees = getAllEmployees();
    const activeEmployeeIds = allEmployees.filter(emp => emp.actief).map(emp => emp.id);
    await initializePeriodEmployeeStaffing(rosterId, activeEmployeeIds);
    console.log('[Wizard] Period employee staffing geïnitialiseerd');
  } catch (err) {
    console.error('[Wizard] Fout bij initialiseren period employee staffing:', err);
  }
  // ... verder met navigeren naar dashboard
}