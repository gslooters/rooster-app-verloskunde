// lib/services/daytype-staffing-storage.ts
import { DayTypeStaffing, DayTypeStaffingInput, DAYS_OF_WEEK } from '@/lib/types/daytype-staffing';
import { getAllServices } from './diensten-storage';

const STORAGE_KEY = 'rooster_daytype_staffing';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function getAllDayTypeStaffing(): DayTypeStaffing[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading daytype staffing:', error);
    return [];
  }
}

export function saveAllDayTypeStaffing(staffingRules: DayTypeStaffing[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staffingRules));
  } catch (error) {
    console.error('Error saving daytype staffing:', error);
    throw new Error('Kon bezettingsregels niet opslaan');
  }
}

export function getStaffingRule(dienstId: string, dagSoort: number): DayTypeStaffing | null {
  const allRules = getAllDayTypeStaffing();
  return allRules.find(rule => rule.dienstId === dienstId && rule.dagSoort === dagSoort) || null;
}

export function upsertStaffingRule(input: DayTypeStaffingInput): DayTypeStaffing {
  if (input.minBezetting < 0 || input.minBezetting > 8) {
    throw new Error('Minimum bezetting moet tussen 0 en 8 zijn');
  }
  if (input.maxBezetting < 0 || input.maxBezetting > 9) {
    throw new Error('Maximum bezetting moet tussen 0 en 9 zijn');
  }
  if (input.minBezetting > input.maxBezetting) {
    throw new Error('Minimum bezetting kan niet hoger zijn dan maximum bezetting');
  }
  if (input.dagSoort < 0 || input.dagSoort > 6) {
    throw new Error('Ongeldige dag van de week');
  }

  const allRules = getAllDayTypeStaffing();
  const existingIndex = allRules.findIndex(rule => 
    rule.dienstId === input.dienstId && rule.dagSoort === input.dagSoort
  );

  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    const updatedRule: DayTypeStaffing = {
      ...allRules[existingIndex],
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      updated_at: now
    };
    allRules[existingIndex] = updatedRule;
    saveAllDayTypeStaffing(allRules);
    return updatedRule;
  } else {
    const newRule: DayTypeStaffing = {
      id: generateId(),
      dienstId: input.dienstId,
      dagSoort: input.dagSoort,
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      created_at: now,
      updated_at: now
    };
    allRules.push(newRule);
    saveAllDayTypeStaffing(allRules);
    return newRule;
  }
}

export function initializeDefaultStaffingRules(): DayTypeStaffing[] {
  const services = getAllServices();
  const existingRules = getAllDayTypeStaffing();
  // Beschermende check: als er al regels zijn, niet opnieuw initialiseren
  if (existingRules.length > 0) {
    return existingRules;
  }

  const allRules: DayTypeStaffing[] = [];
  const now = new Date().toISOString();
  
  services.forEach(service => {
    DAYS_OF_WEEK.forEach(day => {
      let defaultMax = 2;
      if (service.code.toLowerCase() === 's' || service.code.toLowerCase() === 'standby') {
        defaultMax = 1;
      }
      const newRule: DayTypeStaffing = {
        id: generateId(),
        dienstId: service.id,
        dagSoort: day.index,
        minBezetting: 0,
        maxBezetting: defaultMax,
        created_at: now,
        updated_at: now
      };
      allRules.push(newRule);
    });
  });
  
  saveAllDayTypeStaffing(allRules);
  return allRules;
}

export function deleteStaffingRule(id: string): void {
  const allRules = getAllDayTypeStaffing();
  const filteredRules = allRules.filter(rule => rule.id !== id);
  saveAllDayTypeStaffing(filteredRules);
}

export function deleteStaffingRulesForService(dienstId: string): void {
  const allRules = getAllDayTypeStaffing();
  const filteredRules = allRules.filter(rule => rule.dienstId !== dienstId);
  saveAllDayTypeStaffing(filteredRules);
}

export function resetToDefaults(): DayTypeStaffing[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return initializeDefaultStaffingRules();
}

export function exportStaffingRules(): string {
  const allRules = getAllDayTypeStaffing();
  return JSON.stringify(allRules, null, 2);
}

export function importStaffingRules(jsonData: string): void {
  try {
    const rules = JSON.parse(jsonData) as DayTypeStaffing[];
    if (!Array.isArray(rules)) {
      throw new Error('Import data moet een array zijn');
    }
    rules.forEach((rule, index) => {
      if (!rule.id || !rule.dienstId || typeof rule.dagSoort !== 'number' || 
          typeof rule.minBezetting !== 'number' || typeof rule.maxBezetting !== 'number') {
        throw new Error(`Ongeldige regel op index ${index}`);
      }
    });
    saveAllDayTypeStaffing(rules);
  } catch (error) {
    console.error('Error importing staffing rules:', error);
    throw new Error('Kon bezettingsregels niet importeren: ' + (error as Error).message);
  }
}
