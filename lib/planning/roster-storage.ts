// lib/planning/roster-storage.ts
// Update: Toegevoegde period staffing initialisatie bij roster creatie

import { initializePeriodStaffingForRoster, deletePeriodStaffingForRoster } from '../services/period-day-staffing-storage';

// Note: Dit is een placeholder file om de integratie te demonstreren
// De echte roster-storage.ts moet worden aangepast met deze functies:

/**
 * INTEGRATIE INSTRUCTIE voor lib/planning/roster-storage.ts:
 * 
 * 1. Voeg deze import toe bovenaan:
 *    import { initializePeriodStaffingForRoster, deletePeriodStaffingForRoster } from '../services/period-day-staffing-storage';
 * 
 * 2. In de createRoster() functie, na het opslaan van het rooster, voeg toe:
 *    
 *    // Initialiseer period staffing
 *    initializePeriodStaffingForRoster(
 *      roster.id,
 *      roster.startDate,
 *      roster.holidays || []
 *    );
 * 
 * 3. In de deleteRoster() functie, voordat het rooster wordt verwijderd, voeg toe:
 *    
 *    // Cleanup period staffing
 *    deletePeriodStaffingForRoster(rosterId);
 */

// Voorbeeld implementatie:
/*
export function createRoster(data: RosterInput): Roster {
  const newRoster = {
    id: generateId(),
    ...data,
    created_at: new Date().toISOString()
  };
  
  // Save roster to storage
  saveRosterToStorage(newRoster);
  
  // ✨ NIEUW: Initialiseer period staffing
  initializePeriodStaffingForRoster(
    newRoster.id,
    newRoster.startDate,
    newRoster.holidays || []
  );
  
  return newRoster;
}

export function deleteRoster(rosterId: string): void {
  // ✨ NIEUW: Cleanup period staffing
  deletePeriodStaffingForRoster(rosterId);
  
  // Delete roster from storage
  removeRosterFromStorage(rosterId);
}
*/
